// Format ISO 8601 strings for the Quality Grid. Locale-aware via the user's browser.
// Returns the original string if the input is unparseable, so the row still renders.
//
// Memoized: `toLocaleString` (+ `new Date`) is comparatively expensive and the
// grid re-renders the same timestamps on every scroll/filter, so a process-wide
// Map cache keyed by the ISO string turns repeats into a lookup. Capped to bound
// memory (timestamps are effectively unique per ticket; the cap is a safety net).
const _cache = new Map<string, string>()
const _CAP = 5000

export function formatTime(iso: string): string {
  const hit = _cache.get(iso)
  if (hit !== undefined) return hit
  const d = new Date(iso)
  const out = isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
  if (_cache.size >= _CAP) _cache.clear()
  _cache.set(iso, out)
  return out
}
