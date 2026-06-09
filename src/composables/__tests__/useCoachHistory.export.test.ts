import { describe, it, expect, beforeAll, vi } from 'vitest'

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

import { sanitizeFilename, exportAsJson } from '../useCoachHistory'
import type { CoachHistoryRecord } from '@/types/api'

describe('sanitizeFilename', () => {
  it('strips filesystem-illegal characters', () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a b c d e f g h i j')
  })
  it('collapses whitespace and trims', () => {
    expect(sanitizeFilename('  hello    world  ')).toBe('hello world')
  })
  it('caps the length to 60 characters', () => {
    expect(sanitizeFilename('x'.repeat(100)).length).toBe(60)
  })
  it('falls back to "chat" when empty after cleaning', () => {
    expect(sanitizeFilename('   ///   ')).toBe('chat')
  })
})

describe('exportAsJson custom filename', () => {
  it('uses the provided baseName for the download filename', () => {
    // Spy on the anchor the exporter creates to capture the download name.
    const anchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement
    const createEl = vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n)
    vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n)
    const G = globalThis as { URL: { createObjectURL: unknown; revokeObjectURL: unknown } }
    G.URL.createObjectURL = vi.fn(() => 'blob:x')
    G.URL.revokeObjectURL = vi.fn()

    const records: CoachHistoryRecord[] = [{ id: 'a1', role: 'user', content: 'hi', timestamp: 1 }]
    exportAsJson(records, 'My Label')
    expect(anchor.download).toBe('My Label.json')

    createEl.mockRestore()
  })
})
