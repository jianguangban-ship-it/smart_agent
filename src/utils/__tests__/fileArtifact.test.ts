import { describe, it, expect, vi } from 'vitest'
import { renderMarkdown } from '../markdown'
import {
  encodeContent,
  decodeContent,
  fileMetaForFilename,
  enhanceFileArtifacts,
  enhanceCodeBlocks,
  handleArtifactClick,
} from '../codeArtifact'

function b64FromHtml(html: string): string {
  const m = html.match(/data-content-b64="([^"]*)"/)
  return m ? m[1] : ''
}

describe('file artifact — verbatim extraction (markdown.ts)', () => {
  const fileMd = [
    ':::file name="report.md"',
    '# Report',
    '',
    '```python',
    'print("inner code is preserved")',
    '```',
    '',
    '| a | b |',
    '|---|---|',
    '| 1 | 2 |',
    '',
    '$$E = mc^2$$',
    ':::',
  ].join('\n')

  it('captures the whole block into ONE .file-artifact placeholder', () => {
    const html = renderMarkdown(fileMd)
    expect((html.match(/class="file-artifact"/g) || []).length).toBe(1)
    expect(html).toContain('data-filename="report.md"')
    expect(html).toContain('data-mime="text/markdown"')
  })

  it('preserves the file body verbatim (incl. inner ```/table/math) in base64', () => {
    const html = renderMarkdown(fileMd)
    const decoded = decodeContent(b64FromHtml(html))
    expect(decoded).toContain('# Report')
    expect(decoded).toContain('```python')
    expect(decoded).toContain('print("inner code is preserved")')
    expect(decoded).toContain('| a | b |')
    expect(decoded).toContain('$$E = mc^2$$')
  })

  it('does NOT render the file body as chat content (no leaked table/katex)', () => {
    const html = renderMarkdown(fileMd)
    // The body is inert base64 — its markdown is not rendered into the chat.
    expect(html).not.toContain('<table')
    expect(html).not.toContain('katex')
    expect(html).not.toContain('inner code is preserved')
  })

  it('renders prose around the file block normally', () => {
    const html = renderMarkdown(`Here is your file:\n\n${fileMd}\n\nDone.`)
    expect(html).toContain('Here is your file')
    expect(html).toContain('Done.')
    expect(html).toContain('class="file-artifact"')
  })
})

describe('file artifact — does NOT touch normal tables / math', () => {
  it('a normal table (no file block) still renders as a table, no chip', () => {
    const html = renderMarkdown('| x | y |\n|---|---|\n| 1 | 2 |')
    expect(html).toContain('<table')
    expect(html).not.toContain('file-artifact')
  })

  it('normal inline + display math still render as KaTeX, no chip', () => {
    const html = renderMarkdown('Inline $a_y$ and block:\n\n$$F = ma$$')
    expect(html).toContain('katex')
    expect(html).not.toContain('file-artifact')
  })

  it('a `:::file` mentioned inside a code fence is left alone', () => {
    const html = renderMarkdown('```\n:::file name="x.md"\nhi\n:::\n```')
    expect(html).not.toContain('class="file-artifact"')
    expect(html).toContain('<pre>')
  })
})

describe('file artifact — streaming (unterminated block)', () => {
  it('shows a pending chip and drops the partial body (no spill)', () => {
    const partial = ':::file name="big.md"\n# Heading\nsome streaming body text'
    const html = renderMarkdown(partial, true)
    expect(html).toContain('file-artifact--pending')
    expect(html).toContain('data-filename="big.md"')
    expect(html).not.toContain('streaming body text')
    expect(html).not.toContain('Heading')
  })
})

describe('file artifact helpers', () => {
  it('encode/decode round-trips UTF-8 (CJK) and backticks', () => {
    const s = '# 标题\n```js\nconst x = `tpl`\n```\n横向加速度 $a_y$'
    expect(decodeContent(encodeContent(s))).toBe(s)
  })

  it('fileMetaForFilename infers from the extension', () => {
    expect(fileMetaForFilename('report.md').mime).toBe('text/markdown')
    expect(fileMetaForFilename('report.md').label).toBe('Markdown')
    expect(fileMetaForFilename('index.html').label).toBe('HTML')
    expect(fileMetaForFilename('weird.zzz').mime).toBe('text/plain')
  })
})

describe('file artifact — DOM enhancement + click handling', () => {
  function makeRoot(b64: string, pending = false): HTMLElement {
    const root = document.createElement('div')
    const cls = pending ? 'file-artifact file-artifact--pending' : 'file-artifact'
    root.innerHTML = `<div class="${cls}" data-filename="a.md" data-mime="text/markdown" data-lang="Markdown" data-lines="2" data-content-b64="${b64}"></div>`
    return root
  }

  it('builds a download card for a complete file artifact', () => {
    const root = makeRoot(encodeContent('# hi\nbody'))
    enhanceFileArtifacts(root, { labels: { copy: 'Copy', download: 'Download', open: 'View' } })
    expect(root.querySelector('.fa-card')).toBeTruthy()
    expect(root.querySelector('.ca-download')).toBeTruthy()
    expect(root.querySelector('.ca-card-title')?.textContent).toBe('a.md')
  })

  it('builds a pending card with no actions', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div class="file-artifact file-artifact--pending" data-filename="a.md"></div>'
    enhanceFileArtifacts(root, { labels: { copy: 'Copy', download: 'Download', generating: 'Generating…' } })
    expect(root.querySelector('.fa-card')).toBeTruthy()
    expect(root.querySelector('.ca-download')).toBeFalsy()
    expect(root.querySelector('.ca-card-sub')?.textContent).toBe('Generating…')
  })

  it('download click yields the decoded content + meta', () => {
    const root = makeRoot(encodeContent('# hi\nbody'))
    enhanceFileArtifacts(root, { labels: { copy: 'Copy', download: 'Download' } })
    const btn = root.querySelector('.ca-download') as HTMLElement
    const onDownload = vi.fn()
    handleArtifactClick({ target: btn } as unknown as Event, { onCopy: vi.fn(), onDownload })
    expect(onDownload).toHaveBeenCalledTimes(1)
    const [text, meta] = onDownload.mock.calls[0]
    expect(text).toBe('# hi\nbody')
    expect(meta.filename).toBe('a.md')
    expect(meta.mime).toBe('text/markdown')
  })
})

describe('code artifact — fence filename → card name (drops "snippet")', () => {
  const longBody = Array.from({ length: 45 }, (_, i) => `line_${i} = ${i}`).join('\n')

  it('renderMarkdown copies a fence filename onto the rendered code block', () => {
    const html = renderMarkdown('```python quicksort.py\nprint(1)\n```')
    expect(html).toContain('data-filename="quicksort.py"')
  })

  it('ignores a fence info string with no valid filename', () => {
    expect(renderMarkdown('```python\nprint(1)\n```')).not.toContain('data-filename')
    expect(renderMarkdown('```python notafile\nprint(1)\n```')).not.toContain('data-filename')
  })

  it('titles a collapsed long-code card with the fence filename', () => {
    const root = document.createElement('div')
    root.innerHTML = renderMarkdown('```python quicksort.py\n' + longBody + '\n```')
    enhanceCodeBlocks(root, { collapseLong: true })
    expect(root.querySelector('.code-artifact--card .ca-card-title')?.textContent).toBe('quicksort.py')
  })

  it('falls back to snippet.* when no name is given', () => {
    const root = document.createElement('div')
    root.innerHTML = renderMarkdown('```python\n' + longBody + '\n```')
    enhanceCodeBlocks(root, { collapseLong: true })
    expect(root.querySelector('.code-artifact--card .ca-card-title')?.textContent).toBe('snippet.py')
  })
})

describe('code artifact — heading-derived card name (fallback before "snippet")', () => {
  const longHtml = '<div>\n' + Array.from({ length: 45 }, (_, i) => `  <p>row ${i}</p>`).join('\n') + '\n</div>'

  it('names a collapsed card from the nearest preceding heading', () => {
    const root = document.createElement('div')
    root.innerHTML = renderMarkdown('# Creating Switch State Transition HTML with SVG Diagrams\n\nIntro text.\n\n```html\n' + longHtml + '\n```')
    enhanceCodeBlocks(root, { collapseLong: true })
    expect(root.querySelector('.code-artifact--card .ca-card-title')?.textContent)
      .toBe('Creating Switch State Transition HTML with SVG Diagrams.html')
  })

  it('preserves a CJK heading as the filename', () => {
    const root = document.createElement('div')
    root.innerHTML = renderMarkdown('## 开关状态转换\n\n```html\n' + longHtml + '\n```')
    enhanceCodeBlocks(root, { collapseLong: true })
    expect(root.querySelector('.code-artifact--card .ca-card-title')?.textContent).toBe('开关状态转换.html')
  })

  it('a fence filename still wins over the heading', () => {
    const root = document.createElement('div')
    root.innerHTML = renderMarkdown('# Some Heading\n\n```html page.html\n' + longHtml + '\n```')
    enhanceCodeBlocks(root, { collapseLong: true })
    expect(root.querySelector('.code-artifact--card .ca-card-title')?.textContent).toBe('page.html')
  })
})
