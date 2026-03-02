import { describe, it, expect } from 'vitest'
import { diffWords } from '../diffText'

describe('diffWords', () => {
  it('returns empty string for two empty strings', () => {
    expect(diffWords('', '')).toBe('')
  })

  it('returns plain text when strings are identical', () => {
    const result = diffWords('hello world', 'hello world')
    expect(result).not.toContain('<ins')
    expect(result).not.toContain('<del')
    expect(result).toContain('hello')
    expect(result).toContain('world')
  })

  it('marks added words with <ins>', () => {
    const result = diffWords('hello', 'hello world')
    expect(result).toContain('<ins class="diff-add">world</ins>')
  })

  it('marks deleted words with <del>', () => {
    const result = diffWords('hello world', 'hello')
    expect(result).toContain('<del class="diff-del">world</del>')
  })

  it('marks replacements with both <del> and <ins>', () => {
    const result = diffWords('hello', 'goodbye')
    expect(result).toContain('<del class="diff-del">hello</del>')
    expect(result).toContain('<ins class="diff-add">goodbye</ins>')
  })

  it('escapes HTML entities in output', () => {
    const result = diffWords('a < b', 'a > b')
    // The < and > symbols are escaped to &lt; and &gt; inside diff spans
    expect(result).toContain('&lt;')
    expect(result).toContain('&gt;')
    // Raw < should not appear outside of HTML tags
    expect(result).not.toMatch(/(?<!=")< /)
  })

  it('handles adding to empty string', () => {
    const result = diffWords('', 'hello')
    expect(result).toContain('<ins class="diff-add">hello</ins>')
  })

  it('handles deleting to empty string', () => {
    const result = diffWords('hello', '')
    expect(result).toContain('<del class="diff-del">hello</del>')
  })

  it('preserves whitespace tokens', () => {
    const result = diffWords('a  b', 'a  b')
    // Double space preserved as a whitespace token
    expect(result).toContain('  ')
  })
})
