// Per-code-block file artifacts for chat responses.
//
// The markdown AST pipeline (markdown.ts / formatCoach.ts) stays pure: it emits
// `<pre><code class="language-x hljs">…</code></pre>`. This module enhances the
// ALREADY-rendered DOM (post-v-html) with a Copy/Download toolbar and resolves
// click intent via event delegation. No markdown is regex-parsed here — we only
// inspect rendered DOM and a single extracted first line of code (flat text).

export interface FileMeta {
  ext: string
  mime: string
  /** Short human label shown in the toolbar (e.g. "HTML"). */
  label: string
}

export interface ArtifactMeta {
  filename: string
  mime: string
  lang: string
}

export interface ArtifactHandlers {
  onCopy: (text: string, meta: ArtifactMeta) => void
  onDownload: (text: string, meta: ArtifactMeta) => void
}

// language (lowercased) → file metadata. Aliases are explicit keys.
const LANG_FILE_MAP: Record<string, FileMeta> = {
  html: { ext: 'html', mime: 'text/html', label: 'HTML' },
  xml: { ext: 'xml', mime: 'application/xml', label: 'XML' },
  svg: { ext: 'svg', mime: 'image/svg+xml', label: 'SVG' },
  javascript: { ext: 'js', mime: 'text/javascript', label: 'JavaScript' },
  js: { ext: 'js', mime: 'text/javascript', label: 'JavaScript' },
  typescript: { ext: 'ts', mime: 'text/typescript', label: 'TypeScript' },
  ts: { ext: 'ts', mime: 'text/typescript', label: 'TypeScript' },
  tsx: { ext: 'tsx', mime: 'text/typescript', label: 'TSX' },
  jsx: { ext: 'jsx', mime: 'text/javascript', label: 'JSX' },
  json: { ext: 'json', mime: 'application/json', label: 'JSON' },
  css: { ext: 'css', mime: 'text/css', label: 'CSS' },
  scss: { ext: 'scss', mime: 'text/css', label: 'SCSS' },
  python: { ext: 'py', mime: 'text/x-python', label: 'Python' },
  py: { ext: 'py', mime: 'text/x-python', label: 'Python' },
  bash: { ext: 'sh', mime: 'text/x-sh', label: 'Shell' },
  sh: { ext: 'sh', mime: 'text/x-sh', label: 'Shell' },
  shell: { ext: 'sh', mime: 'text/x-sh', label: 'Shell' },
  zsh: { ext: 'sh', mime: 'text/x-sh', label: 'Shell' },
  yaml: { ext: 'yml', mime: 'text/yaml', label: 'YAML' },
  yml: { ext: 'yml', mime: 'text/yaml', label: 'YAML' },
  sql: { ext: 'sql', mime: 'text/plain', label: 'SQL' },
  markdown: { ext: 'md', mime: 'text/markdown', label: 'Markdown' },
  md: { ext: 'md', mime: 'text/markdown', label: 'Markdown' },
  vue: { ext: 'vue', mime: 'text/plain', label: 'Vue' },
  java: { ext: 'java', mime: 'text/x-java', label: 'Java' },
  go: { ext: 'go', mime: 'text/x-go', label: 'Go' },
  rust: { ext: 'rs', mime: 'text/x-rust', label: 'Rust' },
  rs: { ext: 'rs', mime: 'text/x-rust', label: 'Rust' },
  c: { ext: 'c', mime: 'text/x-c', label: 'C' },
  cpp: { ext: 'cpp', mime: 'text/x-c++src', label: 'C++' },
  'c++': { ext: 'cpp', mime: 'text/x-c++src', label: 'C++' },
}

const FALLBACK: FileMeta = { ext: 'txt', mime: 'text/plain', label: 'Text' }

export function normalizeLang(lang: string): string {
  return (lang || '').trim().toLowerCase()
}

export function fileMetaFor(lang: string): FileMeta {
  return LANG_FILE_MAP[normalizeLang(lang)] ?? FALLBACK
}

/** Read the `language-<x>` token off a rendered <code> element. */
export function inferLanguage(codeEl: Element | null): string {
  if (!codeEl) return 'text'
  const cls = codeEl.getAttribute('class') || ''
  for (const token of cls.split(/\s+/)) {
    if (token.startsWith('language-')) {
      const l = token.slice('language-'.length).trim()
      if (l) return l.toLowerCase()
    }
  }
  return 'text'
}

/**
 * Best-effort filename from the first non-empty line of the code, when the
 * model leaves a hint like `<!-- file: index.html -->`, `// app.ts`,
 * `# file: main.py`. Operates on ONE extracted line (flat text), never mutates
 * the code, and only accepts a token that already looks like `name.ext`.
 */
export function detectFilenameHint(code: string): string | null {
  const firstLine = (code.split('\n').find(l => l.trim().length > 0) || '').trim()
  if (!firstLine) return null

  let s = firstLine
  const wrapped = s.match(/^(?:<!--|\/\/|#|;|--|\/\*)\s*(.*?)\s*(?:-->|\*\/)?$/)
  if (wrapped) s = wrapped[1]
  s = s.replace(/^(?:file|filename)\s*:\s*/i, '').trim()

  const tok = s.split(/\s+/)[0] || ''
  if (/^[\w.\-/]+\.[A-Za-z0-9]+$/.test(tok) && !tok.includes('..')) {
    return tok.split('/').pop() || null
  }
  return null
}

/** `snippet.ext` for the first block, `snippet-N.ext` thereafter; hint wins. */
export function buildFilename(lang: string, blockNumber: number, hint: string | null): string {
  if (hint) return hint
  const { ext } = fileMetaFor(lang)
  return blockNumber <= 1 ? `snippet.${ext}` : `snippet-${blockNumber}.${ext}`
}

/**
 * Inject a Copy/Download toolbar above each `<pre><code>` in `root`.
 * Idempotent per element (`data-artifact` guard). Safe to call on every
 * (re-)render — v-html wipes the subtree so this re-runs against fresh DOM.
 */
export function enhanceCodeBlocks(root: HTMLElement | null): void {
  if (!root) return
  const codes = root.querySelectorAll('pre > code')
  let blockNumber = 0

  codes.forEach(code => {
    const pre = code.parentElement as HTMLElement | null
    if (!pre || pre.dataset.artifact === '1') return
    blockNumber++

    const lang = inferLanguage(code)
    const meta = fileMetaFor(lang)
    const hint = detectFilenameHint(code.textContent || '')
    const filename = buildFilename(lang, blockNumber, hint)

    pre.dataset.artifact = '1'
    pre.dataset.filename = filename
    pre.dataset.mime = meta.mime
    pre.dataset.lang = meta.label

    const bar = document.createElement('div')
    bar.className = 'code-artifact-bar'

    const langSpan = document.createElement('span')
    langSpan.className = 'ca-lang'
    langSpan.textContent = meta.label

    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'ca-btn ca-copy'
    copyBtn.setAttribute('data-art-action', 'copy')
    copyBtn.textContent = 'Copy'

    const dlBtn = document.createElement('button')
    dlBtn.type = 'button'
    dlBtn.className = 'ca-btn ca-download'
    dlBtn.setAttribute('data-art-action', 'download')
    dlBtn.textContent = 'Download'

    bar.appendChild(langSpan)
    bar.appendChild(copyBtn)
    bar.appendChild(dlBtn)

    const wrapper = document.createElement('div')
    wrapper.className = 'code-artifact'
    pre.parentNode?.insertBefore(wrapper, pre)
    wrapper.appendChild(bar)
    wrapper.appendChild(pre)
  })
}

/** Optional: localize the injected button labels before/after enhancement. */
export function setArtifactLabels(root: HTMLElement | null, copy: string, download: string): void {
  if (!root) return
  root.querySelectorAll<HTMLButtonElement>('.ca-copy').forEach(b => { b.textContent = copy })
  root.querySelectorAll<HTMLButtonElement>('.ca-download').forEach(b => { b.textContent = download })
}

/** Delegated click handler — attach once to the stable response container. */
export function handleArtifactClick(e: Event, handlers: ArtifactHandlers): void {
  const target = e.target as HTMLElement | null
  const btn = target?.closest('[data-art-action]') as HTMLElement | null
  if (!btn) return
  const artifact = btn.closest('.code-artifact')
  if (!artifact) return
  const code = artifact.querySelector('pre > code')
  const pre = artifact.querySelector('pre') as HTMLElement | null
  if (!code || !pre) return

  const text = code.textContent ?? ''
  const meta: ArtifactMeta = {
    filename: pre.dataset.filename || 'snippet.txt',
    mime: pre.dataset.mime || 'text/plain',
    lang: pre.dataset.lang || 'Text',
  }
  const action = btn.getAttribute('data-art-action')
  if (action === 'copy') handlers.onCopy(text, meta)
  else if (action === 'download') handlers.onDownload(text, meta)
}
