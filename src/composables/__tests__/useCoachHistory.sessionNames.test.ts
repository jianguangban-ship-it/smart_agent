import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
    key: () => null, length: 0,
  } as Storage
})

import {
  addRecord,
  clearHistory,
  deleteRecords,
  startNewSession,
  getSessionName,
  setSessionName,
} from '@/composables/useCoachHistory'

const SESSION_NAMES_KEY = 'coach-session-names'

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  clearHistory()
})

describe('session names (chat-log rename)', () => {
  it('sets, reads, and persists a custom session name', () => {
    startNewSession('explore')
    const rec = addRecord('user', 'hello', 'explore')
    setSessionName(rec.sessionId!, '  My research chat  ')
    expect(getSessionName(rec.sessionId!)).toBe('My research chat')   // trimmed
    expect(JSON.parse(storage[SESSION_NAMES_KEY])[rec.sessionId!]).toBe('My research chat')
  })

  it('clears the name when set to blank (reverts to auto-preview)', () => {
    startNewSession('explore')
    const rec = addRecord('user', 'hello', 'explore')
    setSessionName(rec.sessionId!, 'Named')
    setSessionName(rec.sessionId!, '   ')
    expect(getSessionName(rec.sessionId!)).toBeUndefined()
  })

  it('clearHistory wipes all session names', () => {
    startNewSession('explore')
    const rec = addRecord('user', 'hello', 'explore')
    setSessionName(rec.sessionId!, 'Named')
    clearHistory()
    expect(getSessionName(rec.sessionId!)).toBeUndefined()
    expect(storage[SESSION_NAMES_KEY]).toBeUndefined()
  })

  it('deleteRecords prunes the name once a session has no records left', () => {
    startNewSession('explore')
    const rec = addRecord('user', 'hello', 'explore')
    setSessionName(rec.sessionId!, 'Named')
    deleteRecords(new Set([rec.id]))
    expect(getSessionName(rec.sessionId!)).toBeUndefined()
  })

  it('keeps the name while the session still has other records', () => {
    startNewSession('explore')
    const r1 = addRecord('user', 'first', 'explore')
    const r2 = addRecord('assistant', 'reply', 'explore')
    setSessionName(r1.sessionId!, 'Named')
    deleteRecords(new Set([r2.id]))
    expect(getSessionName(r1.sessionId!)).toBe('Named')
  })
})
