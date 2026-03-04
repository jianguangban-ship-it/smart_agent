import { describe, it, expect, vi } from 'vitest'

// Mock i18n before importing the module under test
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    setLang: () => {},
    currentLang: { value: 'en' },
    isZh: { value: false }
  })
}))

import { formatCoachResponse } from '../formatCoach'

describe('formatCoachResponse', () => {
  it('returns empty string for null', () => {
    expect(formatCoachResponse(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatCoachResponse(undefined)).toBe('')
  })

  it('escapes and returns primitives', () => {
    const result = formatCoachResponse('hello <world>')
    expect(result).toContain('&lt;world&gt;')
  })

  describe('unstructured (message field)', () => {
    it('wraps plain text in coach-para', () => {
      const result = formatCoachResponse({ message: 'hello' })
      expect(result).toContain('<p class="coach-para">')
      expect(result).toContain('hello')
    })

    it('converts **bold** to strong', () => {
      const result = formatCoachResponse({ message: '**bold**' })
      expect(result).toContain('<strong class="coach-bold">bold</strong>')
    })

    it('converts `code` to code element', () => {
      const result = formatCoachResponse({ message: '`myFunc`' })
      expect(result).toContain('<code class="coach-code">myFunc</code>')
    })

    it('converts ## to h3', () => {
      const result = formatCoachResponse({ message: '## Title' })
      expect(result).toContain('<h3 class="coach-h3">Title</h3>')
    })

    it('converts ### to h4', () => {
      const result = formatCoachResponse({ message: '### Subtitle' })
      expect(result).toContain('<h4 class="coach-h4">Subtitle</h4>')
    })

    it('converts --- to hr', () => {
      const result = formatCoachResponse({ message: '---' })
      expect(result).toContain('<hr class="coach-hr">')
    })

    it('converts bullet list items', () => {
      const result = formatCoachResponse({ message: '- item one' })
      expect(result).toContain('coach-list-item')
      expect(result).toContain('coach-list-bullet')
    })

    it('converts numbered list items', () => {
      const result = formatCoachResponse({ message: '1. first item' })
      expect(result).toContain('coach-list-item')
      expect(result).toContain('coach-list-num')
    })
  })

  describe('structured fields', () => {
    it('renders PASS status badge', () => {
      const result = formatCoachResponse({ status: 'PASS' })
      expect(result).toContain('coach-status-pass')
      expect(result).toContain('PASS')
    })

    it('renders FAIL status badge', () => {
      const result = formatCoachResponse({ status: 'FAIL' })
      expect(result).toContain('coach-status-fail')
      expect(result).toContain('FAIL')
    })

    it('renders WARN status badge', () => {
      const result = formatCoachResponse({ status: 'WARN' })
      expect(result).toContain('coach-status-warn')
    })

    it('renders team info row', () => {
      const result = formatCoachResponse({ status: 'PASS', team: 'Alpha' })
      expect(result).toContain('coach-info-row')
      expect(result).toContain('Alpha')
    })

    it('renders comment as issue list', () => {
      const result = formatCoachResponse({ status: 'FAIL', comment: '1. issue one; 2. issue two' })
      expect(result).toContain('coach-issues-list')
    })

    it('renders markdown_msg in main-message', () => {
      const result = formatCoachResponse({ status: 'PASS', markdown_msg: '**good**' })
      expect(result).toContain('coach-main-message')
      expect(result).toContain('coach-bold')
    })
  })

  describe('LaTeX math rendering', () => {
    it('renders inline math with $...$ delimiters', () => {
      const result = formatCoachResponse({ message: 'Set $i_d^* = 0$ for FOC' })
      expect(result).toContain('katex')
      expect(result).not.toContain('\\*')
    })

    it('strips markdown-escaped \\* inside math delimiters', () => {
      const result = formatCoachResponse({ message: 'Use $i_d^{\\*} = 0$ control' })
      expect(result).toContain('katex')
      expect(result).not.toContain('\\*')
    })

    it('strips markdown-escaped \\_ inside math delimiters', () => {
      const result = formatCoachResponse({ message: 'Variable $x\\_1 + x\\_2$' })
      expect(result).toContain('katex')
    })
  })

  describe('response boundary divider', () => {
    it('renders ===COACH_TURN=== as response-divider (not coach-hr)', () => {
      const result = formatCoachResponse({ message: 'answer one\n\n===COACH_TURN===\n\nanswer two' })
      expect(result).toContain('coach-response-divider')
      expect(result).not.toContain('coach-hr')
    })

    it('renders --- as coach-hr', () => {
      const result = formatCoachResponse({ message: '---' })
      expect(result).toContain('coach-hr')
      expect(result).not.toContain('coach-response-divider')
    })
  })

  describe('array input', () => {
    it('uses first element of array', () => {
      const result = formatCoachResponse([{ status: 'PASS' }])
      expect(result).toContain('coach-status-pass')
    })

    it('returns empty for empty array', () => {
      expect(formatCoachResponse([])).toBe('')
    })
  })
})
