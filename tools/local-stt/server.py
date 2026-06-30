"""Local faster-whisper STT server (v10.181) — verification tool, NOT prod.

Exposes the OpenAI-compatible audio API shape that server/routes/transcribe.ts
already speaks, so Smart Agent's voice dictation can be verified end-to-end
while the GWM proxy's STT upstream is broken (500s as of 2026-06-10).

Both /v1/audio/transcriptions and /v1/audio/translations are served and BOTH
plainly transcribe with the spoken language preserved (Chinese in -> Chinese
out). The translations alias exists only so the same STT_PATH config used for
GWM works unchanged against this server.

Run (see README.md):
    .venv\\Scripts\\uvicorn server:app --host 127.0.0.1 --port 8100

Config env vars:
    WHISPER_MODEL    model size/name, default "small" (~460 MB, good ZH/EN)
    WHISPER_DEVICE   "cpu" (default) or "cuda"
    WHISPER_COMPUTE  ctranslate2 compute type, default "int8"
"""
import os
import tempfile

from fastapi import FastAPI, Form, UploadFile
from faster_whisper import WhisperModel
from huggingface_hub import snapshot_download

MODEL_NAME = os.environ.get("WHISPER_MODEL", "small")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8")
MODELS_DIR = os.environ.get(
    "WHISPER_MODEL_DIR", os.path.join(os.path.dirname(__file__), "models")
)

app = FastAPI(title="local-stt (faster-whisper)")


def _resolve_model_path(name: str) -> str:
    """Download to a plain directory instead of the HF hub cache.

    The hub cache builds symlinks, which fail on Windows without the symlink
    privilege (corporate machines: os.symlink -> WinError 1). local_dir
    downloads are real files, no symlinks involved.
    """
    if os.path.isdir(name):
        return name
    repo = name if "/" in name else f"Systran/faster-whisper-{name}"
    target = os.path.join(MODELS_DIR, repo.replace("/", "--"))
    print(f"[local-stt] ensuring model '{repo}' in {target} ...")
    return snapshot_download(repo, local_dir=target)


print(f"[local-stt] loading model '{MODEL_NAME}' ({DEVICE}/{COMPUTE}) — "
      "first run downloads weights ...")
model = WhisperModel(_resolve_model_path(MODEL_NAME), device=DEVICE, compute_type=COMPUTE)
print("[local-stt] model ready")


async def _transcribe(file: UploadFile, language: str | None) -> dict:
    # faster-whisper wants a path or file-like; a temp file keeps PyAV happy
    # with every container the browser's MediaRecorder may send (webm/opus,
    # mp4, ogg) as well as plain wav.
    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        path = tmp.name
    try:
        segments, info = model.transcribe(path, language=language or None)
        text = "".join(s.text for s in segments).strip()
        print(f"[local-stt] {file.filename}: lang={info.language} "
              f"p={info.language_probability:.2f} chars={len(text)}")
        return {"text": text}
    finally:
        os.unlink(path)


@app.post("/v1/audio/transcriptions")
async def transcriptions(
    file: UploadFile,
    model: str = Form(""),          # accepted and ignored (catalog name)
    response_format: str = Form("json"),
    language: str = Form(""),
):
    return await _transcribe(file, language)


@app.post("/v1/audio/translations")
async def translations(
    file: UploadFile,
    model: str = Form(""),
    response_format: str = Form("json"),
    language: str = Form(""),
):
    # Deliberately identical to transcriptions: language preserved. This
    # mirrors what we hope GWM's translations mount does; it is NOT the
    # OpenAI translate-to-English behavior.
    return await _transcribe(file, language)


@app.get("/healthz")
def healthz():
    return {"ok": True, "model": MODEL_NAME, "device": DEVICE}
