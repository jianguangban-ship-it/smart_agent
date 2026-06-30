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
  startNewSession,
  isSessionStarred,
  toggleSessionStar,
  deleteSession,
  getSessionRecords,
} from '@/composables/useCoachHistory'

const STARRED_KEY = 'coach-starred-sessions'

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k])
  clearHistory()
})

describe('starred sessions + deleteSession', () => {
  it('toggles and persists a session star', () => {
    startNewSession('explore')
    const rec = addRecord('user', 'hello', 'explore')
    expect(isSessionStarred(rec.sessionId!)).toBe(false)

    toggleSessionStar(rec.sessionId!)
    expect(isSessionStarred(rec.sessionId!)).toBe(true)
    expect(JSON.parse(storage[STARRED_KEY])[rec.sessionId!]).toBe(true)

    toggleSessionStar(rec.sessionId!)
    expect(isSessionStarred(rec.sessionId!)).toBe(false)
  })

  it('deleteSession removes every record of the chat', () => {
    startNewSession('explore')
    const r1 = addRecord('user', 'first', 'explore')
    addRecord('assistant', 'reply', 'explore')
    expect(getSessionRecords(r1.sessionId!)).toHaveLength(2)

    deleteSession(r1.sessionId!)
    expect(getSessionRecords(r1.sessionId!)).toHaveLength(0)
  })

  it('deleting a session prunes its star', () => {
    startNewSession('explore')
    const rec = addRecord('user', 'hello', 'explore')
    toggleSessionStar(rec.sessionId!)
    deleteSession(rec.sessionId!)
    expect(isSessionStarred(rec.sessionId!)).toBe(false)
  })

  it('clearHistory wipes all stars', () => {
    startNewSession('explore')
    const rec = addRecord('user', 'hello', 'explore')
    toggleSessionStar(rec.sessionId!)
    clearHistory()
    expect(isSessionStarred(rec.sessionId!)).toBe(false)
    expect(storage[STARRED_KEY]).toBeUndefined()
  })
})
