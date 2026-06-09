// Clipboard helper with a legacy fallback for non-secure contexts.
// `navigator.clipboard` is undefined when the page is served over plain HTTP
// from anything other than localhost/127.0.0.1 — which is exactly how the
// deployed Smart Agent is reached at GWM (http://<lan-ip>:5181/). Fall back
// to a transient <textarea> + document.execCommand('copy') in that case.
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission denied / focus issue — try legacy path.
    }
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.opacity = '0'
    ta.style.pointerEvents = 'none'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
