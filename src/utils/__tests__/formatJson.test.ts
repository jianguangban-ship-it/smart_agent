import { describe, it, expect } from 'vitest'
import { formatJson } from '../formatJson'

describe('formatJson', () => {
  it('returns empty string for null', () => {
    expect(formatJson(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatJson(undefined)).toBe('')
  })

  it('highlights numbers in objects', () => {
    const result = formatJson({ count: 42 })
    expect(result).toContain('json-number')
    expect(result).toContain('42')
  })

  it('highlights string values', () => {
    const result = formatJson({ name: 'hello' })
    expect(result).toContain('json-string')
    expect(result).toContain('hello')
  })

  it('highlights booleans', () => {
    const result = formatJson({ active: true })
    expect(result).toContain('json-boolean')
    expect(result).toContain('true')
  })

  it('highlights null values', () => {
    const result = formatJson({ value: null })
    expect(result).toContain('json-null')
  })

  it('handles string input (parses as-is)', () => {
    const result = formatJson('{"a": 1}')
    expect(result).toContain('json-number')
    expect(result).toContain('json-string')
  })

  it('escapes HTML entities', () => {
    const result = formatJson({ html: '<b>bold</b>' })
    expect(result).toContain('&lt;')
    expect(result).toContain('&gt;')
  })
})
