/**
 * Speech-to-text client (v10.179, voice dictation).
 *
 * Uploads a recorded audio Blob to the server's `/api/llm/transcribe` route
 * as base64 JSON (no multipart dependency; matches the base64-image-in-JSON
 * convention). The server re-encodes to multipart and forwards to the GWM
 * proxy's faster-whisper — the browser never talks to llmproxy directly.
 */

/** Strip the `data:<mime>;base64,` prefix FileReader prepends. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const comma = dataUrl.indexOf(',')
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl)
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Thrown on a non-OK transcribe response. `detail` carries the server's
 * diagnostic (e.g. "STT upstream HTTP 500") so the error toast can tell a
 * broken upstream (500) from a misconfigured path (404) without server logs.
 */
export class STTError extends Error {
  detail: string
  constructor(detail: string) {
    super(detail)
    this.detail = detail
  }
}

/**
 * Transcribe a recorded clip. Resolves the transcript text ('' when the
 * upstream heard nothing). Throws an STTError on failure — the caller maps
 * it to an i18n toast with the detail appended.
 */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const audio = await blobToBase64(blob)

  // Same optional internal-token header as the brokered chat path
  // (useLLM.ts:_callBrokeredLLM).
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const internalToken = import.meta.env.VITE_INTERNAL_API_TOKEN
  if (typeof internalToken === 'string' && internalToken.length > 0) {
    headers['X-Internal-Token'] = internalToken
  }

  const response = await fetch('/api/llm/transcribe', {
    method: 'POST',
    headers,
    body: JSON.stringify({ audio, mime: blob.type || 'audio/webm' })
  })

  if (!response.ok) {
    // The server route replies { error, message } — surface its message
    // (e.g. "STT upstream HTTP 500") as the toast-able detail.
    let detail = ''
    try {
      const body = await response.json() as { message?: unknown }
      if (typeof body.message === 'string') detail = body.message
    } catch { /* non-JSON body */ }
    throw new STTError(detail || `HTTP ${response.status}`)
  }

  const json = await response.json() as { text?: unknown }
  return typeof json.text === 'string' ? json.text : ''
}
