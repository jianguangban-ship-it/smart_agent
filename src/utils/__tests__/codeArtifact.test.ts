import { describe, it, expect, vi } from 'vitest'
import {
  fileMetaFor,
  inferLanguage,
  detectFilenameHint,
  buildFilename,
  enhanceCodeBlocks,
  handleArtifactClick,
} from '../codeArtifact'

function codeEl(cls: string, text = ''): Element {
  const c = document.createElement('code')
  if (cls) c.setAttribute('class', cls)
  c.textContent = text
  return c
}

describe('fileMetaFor', () => {
  it('maps known languages incl. aliases', () => {
    expect(fileMetaFor('html')).toMatchObject({ ext: 'html', mime: 'text/html' })
    expect(fileMetaFor('svg')).toMatchObject({ ext: 'svg', mime: 'image/svg+xml' })
    expect(fileMetaFor('md')).toMatchObject({ ext: 'md', mime: 'text/markdown' })
    expect(fileMetaFor('markdown')).toMatchObject({ ext: 'md', mime: 'text/markdown' })
    expect(fileMetaFor('TypeScript')).toMatchObject({ ext: 'ts' })
  })
  it('falls back for unknown / empty', () => {
    expect(fileMetaFor('whoknows')).toMatchObject({ ext: 'txt', mime: 'text/plain' })
    expect(fileMetaFor('')).toMatchObject({ ext: 'txt' })
  })
})

describe('inferLanguage', () => {
  it('reads language-<x> token', () => {
    expect(inferLanguage(codeEl('language-html hljs'))).toBe('html')
    expect(inferLanguage(codeEl('hljs language-python'))).toBe('python')
  })
  it('returns text when no language class', () => {
    expect(inferLanguage(codeEl('hljs'))).toBe('text')
    expect(inferLanguage(codeEl(''))).toBe('text')
    expect(inferLanguage(null)).toBe('text')
  })
})

describe('detectFilenameHint', () => {
  it('detects html/comment, slash, hash hints', () => {
    expect(detectFilenameHint('<!-- file: index.html -->\n<div></div>')).toBe('index.html')
    expect(detectFilenameHint('// app.ts\nconst x = 1')).toBe('app.ts')
    expect(detectFilenameHint('# file: main.py\nprint(1)')).toBe('main.py')
    expect(detectFilenameHint('<!-- src/app/index.html -->')).toBe('index.html')
  })
  it('returns null when no plausible filename', () => {
    expect(detectFilenameHint('const x = 1')).toBeNull()
    expect(detectFilenameHint('// just a comment')).toBeNull()
    expect(detectFilenameHint('')).toBeNull()
  })
})

describe('buildFilename', () => {
  it('numbers blocks and honors hint precedence', () => {
    expect(buildFilename('html', 1, null)).toBe('snippet.html')
    expect(buildFilename('html', 2, null)).toBe('snippet-2.html')
    expect(buildFilename('python', 1, 'main.py')).toBe('main.py')
    expect(buildFilename('nope', 1, null)).toBe('snippet.txt')
  })
})

describe('enhanceCodeBlocks + handleArtifactClick', () => {
  function root(html: string): HTMLElement {
    const d = document.createElement('div')
    d.className = 'coach-response'
    d.innerHTML = html
    return d
  }

  it('injects one toolbar per code block, idempotently', () => {
    const el = root(
      '<pre><code class="language-html hljs">&lt;div&gt;</code></pre>' +
      '<pre><code class="language-python hljs">print(1)</code></pre>'
    )
    enhanceCodeBlocks(el)
    expect(el.querySelectorAll('.code-artifact-bar')).toHaveLength(2)
    expect(el.querySelectorAll('.code-artifact')).toHaveLength(2)
    const langs = [...el.querySelectorAll('.ca-lang')].map(n => n.textContent)
    expect(langs).toEqual(['HTML', 'Python'])

    // Idempotent: re-running adds nothing.
    enhanceCodeBlocks(el)
    expect(el.querySelectorAll('.code-artifact-bar')).toHaveLength(2)
  })

  it('delegated click fires onCopy/onDownload with exact text + meta', () => {
    const el = root('<pre><code class="language-svg hljs">&lt;svg/&gt;</code></pre>')
    enhanceCodeBlocks(el)
    const onCopy = vi.fn()
    const onDownload = vi.fn()
    el.addEventListener('click', e => handleArtifactClick(e, { onCopy, onDownload }))

    el.querySelector<HTMLButtonElement>('.ca-copy')!.click()
    el.querySelector<HTMLButtonElement>('.ca-download')!.click()

    expect(onCopy).toHaveBeenCalledOnce()
    expect(onDownload).toHaveBeenCalledOnce()
    const [copyText, copyMeta] = onCopy.mock.calls[0]
    expect(copyText).toBe('<svg/>')
    expect(copyMeta).toMatchObject({ filename: 'snippet.svg', mime: 'image/svg+xml', lang: 'SVG' })
  })

  it('ignores clicks outside the toolbar', () => {
    const el = root('<pre><code class="language-js hljs">x</code></pre>')
    enhanceCodeBlocks(el)
    const onCopy = vi.fn()
    const onDownload = vi.fn()
    el.addEventListener('click', e => handleArtifactClick(e, { onCopy, onDownload }))
    el.querySelector('code')!.click()
    expect(onCopy).not.toHaveBeenCalled()
    expect(onDownload).not.toHaveBeenCalled()
  })
})
