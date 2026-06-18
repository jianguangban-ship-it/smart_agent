import { ref } from 'vue'
import type { LogEntry } from '@/types/logs'

// Client for the Activity log feed. Connects to the SSE endpoint only while the
// page is active (so app boot / other modes pay nothing), parses entries with
// the same fetch + ReadableStream loop used in useLLM.ts, and keeps a bounded
// reactive list. Reconnects with backoff on drop.
const MAX_LIVE = 1000

export function useLogStream() {
  const logs = ref<LogEntry[]>([])
  const connected = ref(false)
  const paused = ref(false)

  let controller: AbortController | null = null
  let retry = 0
  let stopped = true
  const seen = new Set<number>()

  function append(e: LogEntry) {
    if (seen.has(e.id)) return // ring replay can overlap a reconnect
    seen.add(e.id)
    logs.value.push(e)
    if (logs.value.length > MAX_LIVE) {
      const dropped = logs.value.splice(0, logs.value.length - MAX_LIVE)
      for (const d of dropped) seen.delete(d.id)
    }
  }

  async function connect() {
    if (stopped) return
    controller = new AbortController()
    try {
      const res = await fetch('/api/logs/stream', {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      connected.value = true
      retry = 0
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const t = line.trim()
          if (!t.startsWith('data:')) continue // skip ': ping' heartbeats
          try {
            const entry = JSON.parse(t.slice(5).trim()) as LogEntry
            if (!paused.value) append(entry)
          } catch { /* ignore malformed line */ }
        }
      }
    } catch {
      /* network drop / abort — fall through to reconnect */
    } finally {
      connected.value = false
    }
    if (!stopped) {
      retry = Math.min(retry + 1, 6)
      setTimeout(connect, Math.min(1000 * 2 ** retry, 15_000))
    }
  }

  function start() {
    if (!stopped) return
    stopped = false
    connect()
  }

  function stop() {
    stopped = true
    controller?.abort()
    controller = null
    connected.value = false
  }

  /** Page older history from the durable table (entries before the oldest live id). */
  async function loadOlder(): Promise<number> {
    const oldest = logs.value[0]?.id
    const url = `/api/logs?limit=200${oldest ? `&beforeId=${oldest}` : ''}`
    try {
      const res = await fetch(url)
      if (!res.ok) return 0
      const rows = await res.json() as LogEntry[]
      // rows are newest→oldest; prepend in chronological order, skipping dupes.
      const fresh = rows.filter(r => !seen.has(r.id)).reverse()
      for (const r of fresh) seen.add(r.id)
      logs.value = [...fresh, ...logs.value]
      return fresh.length
    } catch {
      return 0
    }
  }

  function clear() {
    logs.value = []
    seen.clear()
  }

  return { logs, connected, paused, start, stop, loadOlder, clear }
}
