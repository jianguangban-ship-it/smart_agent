// Format ISO 8601 strings for the Quality Grid. Locale-aware via the user's browser.
// Returns the original string if the input is unparseable, so the row still renders.
export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
