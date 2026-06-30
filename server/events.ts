import { EventEmitter } from 'node:events'

// Lightweight in-process signal that the tickets table changed, so the View-mode
// dashboard can refresh in near-real-time (see GET /api/tickets/stream) instead
// of polling. Fired only on an actual upsert — no payload of rows, just a ping.
export interface TicketsChanged {
  issueKey: string
  result: 'created' | 'updated'
}

const emitter = new EventEmitter()
emitter.setMaxListeners(0) // many SSE viewers shouldn't warn

export function emitTicketsChanged(info: TicketsChanged): void {
  emitter.emit('changed', info)
}

export function onTicketsChanged(fn: (info: TicketsChanged) => void): () => void {
  emitter.on('changed', fn)
  return () => emitter.off('changed', fn)
}
