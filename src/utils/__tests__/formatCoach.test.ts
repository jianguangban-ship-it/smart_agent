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
    it('wraps plain text in paragraph', () => {
      const result = formatCoachResponse({ message: 'hello' })
      expect(result).toContain('<p>')
      expect(result).toContain('hello')
    })

    it('converts **bold** to strong', () => {
      const result = formatCoachResponse({ message: '**bold**' })
      expect(result).toContain('<strong>')
      expect(result).toContain('bold')
    })

    it('converts `code` to code element', () => {
      const result = formatCoachResponse({ message: '`myFunc`' })
      expect(result).toContain('<code>')
      expect(result).toContain('myFunc')
    })

    it('converts ## to h2', () => {
      const result = formatCoachResponse({ message: '## Title' })
      expect(result).toContain('<h2>')
      expect(result).toContain('Title')
    })

    it('converts ### to h3', () => {
      const result = formatCoachResponse({ message: '### Subtitle' })
      expect(result).toContain('<h3>')
      expect(result).toContain('Subtitle')
    })

    it('converts --- to hr', () => {
      const result = formatCoachResponse({ message: '---' })
      expect(result).toContain('<hr>')
    })

    it('converts bullet list items', () => {
      const result = formatCoachResponse({ message: '- item one' })
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>')
    })

    it('converts numbered list items', () => {
      const result = formatCoachResponse({ message: '1. first item' })
      expect(result).toContain('<ol>')
      expect(result).toContain('<li>')
    })

    it('renders markdown tables as HTML tables', () => {
      const table = [
        '| Name | Age |',
        '|------|-----|',
        '| Alice | 30 |',
        '| Bob | 25 |',
      ].join('\n')
      const result = formatCoachResponse({ message: table })
      expect(result).toContain('<table>')
      expect(result).toContain('<thead>')
      expect(result).toContain('<th>')
      expect(result).toContain('Alice')
      expect(result).toContain('Bob')
    })

    it('renders code blocks with pre and code', () => {
      const msg = '```js\nconsole.log("hi")\n```'
      const result = formatCoachResponse({ message: msg })
      expect(result).toContain('<pre>')
      expect(result).toContain('<code')
    })

    it('syntax-highlights C++ code blocks', () => {
      const msg = '```cpp\nint main() {\n  return 0;\n}\n```'
      const result = formatCoachResponse({ message: msg })
      expect(result).toContain('hljs')
      expect(result).toContain('hljs-keyword')
    })

    it('syntax-highlights Python code blocks', () => {
      const msg = '```python\ndef hello():\n    print("world")\n```'
      const result = formatCoachResponse({ message: msg })
      expect(result).toContain('hljs')
      expect(result).toContain('hljs-keyword')
    })

    it('renders blockquotes', () => {
      const result = formatCoachResponse({ message: '> quoted text' })
      expect(result).toContain('<blockquote>')
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
      expect(result).toContain('<strong>')
    })
  })

  describe('LaTeX math rendering', () => {
    it('renders inline math with $...$ delimiters', () => {
      const result = formatCoachResponse({ message: 'Set $i_d^* = 0$ for FOC' })
      expect(result).toContain('katex')
    })

    it('strips markdown-escaped \\* inside math delimiters', () => {
      const result = formatCoachResponse({ message: 'Use $i_d^{\\*} = 0$ control' })
      expect(result).toContain('katex')
    })

    it('strips markdown-escaped \\_ inside math delimiters', () => {
      const result = formatCoachResponse({ message: 'Variable $x\\_1 + x\\_2$' })
      expect(result).toContain('katex')
    })
  })

  describe('response boundary divider', () => {
    it('renders ===COACH_TURN=== as response-divider', () => {
      const result = formatCoachResponse({ message: 'answer one\n\n===COACH_TURN===\n\nanswer two' })
      expect(result).toContain('coach-response-divider')
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
