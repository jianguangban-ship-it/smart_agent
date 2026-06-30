# local-stt — faster-whisper verification server

A minimal OpenAI-compatible STT server wrapping [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
(MIT). Purpose: verify Smart Agent's voice dictation end-to-end while the GWM
proxy's STT upstream is broken (`/v1/audio/translations` returns 500 as of
2026-06-10). **Verification tool, not production** — prod should use the GWM
endpoint once fixed, or a proper container (e.g. Speaches) later.

## Setup (once)

```powershell
cd tools\local-stt
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

## Run

```powershell
cd tools\local-stt
.venv\Scripts\uvicorn server:app --host 127.0.0.1 --port 8100
```

First start downloads the `small` model (~460 MB) into `tools/local-stt/models/`
(a plain directory, NOT the HF hub cache — the hub cache uses symlinks, which
fail on corporate Windows without the symlink privilege: `os.symlink` →
WinError 1). Download goes to huggingface.co through your system proxy.

NOTE: do NOT set `HF_ENDPOINT=https://hf-mirror.com` — verified to fail with
`FileMetadataError` (the mirror's redirect drops HF metadata headers). Plain
huggingface.co via the system proxy works.

Bigger/smaller models: `$env:WHISPER_MODEL = 'base'` (faster) or
`'medium'` / `'large-v3-turbo'` (better, slower on CPU).

## Point Smart Agent at it

Append to `deploy/.env` (and restart `npm run dev:all`):

```
STT_BASE_URL=http://127.0.0.1:8100/v1
STT_API_KEY=
```

Delete both lines to return STT to the GWM proxy.

## Smoke test

```powershell
curl.exe -s -X POST http://127.0.0.1:8100/v1/audio/translations `
  -F "file=@some-audio.wav" -F "model=x"
# -> {"text":"..."}  (spoken language preserved — Chinese stays Chinese)
```

Both `/v1/audio/transcriptions` and `/v1/audio/translations` are served and
both plainly transcribe (the alias just mirrors the GWM `STT_PATH` shape).
`GET /healthz` reports the loaded model.
