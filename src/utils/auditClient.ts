import type { LogLevel } from '@/types/logs'

// Record a client-side action in the Activity log. Used for the JIRA
// create/update, which is submitted browser→n8n and so never reaches our
// server through the normal request path. Fire-and-forget: never blocks the UI
// and swallows all errors (logging must not break the user's action).
export function logClientEvent(
  evt: string,
  opts: { level?: LogLevel; msg?: string; detail?: Record<string, unknown> } = {}
): void {
  try {
    void fetch('/api/logs/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evt, level: opts.level, msg: opts.msg, detail: opts.detail }),
      keepalive: true
    }).catch(() => { /* ignore — best-effort */ })
  } catch {
    /* ignore */
  }
}
