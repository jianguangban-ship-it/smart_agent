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
  /** Human label (e.g. 'C'). */
  lang: string
  /** highlight.js language token (e.g. 'c'); for the viewer's syntax highlight. */
  langToken?: string
  /** Line count (set in card mode; 0 for inline blocks). */
  lines?: number
}

export interface ArtifactHandlers {
  onCopy: (text: string, meta: ArtifactMeta) => void
  onDownload: (text: string, meta: ArtifactMeta) => void
  /** Open the artifact in the right-side viewer (card mode only). */
  onOpen?: (text: string, meta: ArtifactMeta) => void
}

/** Labels for injected artifact UI (localized by the caller). */
export interface ArtifactLabels {
  copy: string
  download: string
  /** "View" / open affordance shown on a collapsed card. */
  open?: string
  /** Interpolates a line count, e.g. n => `${n} lines`. */
  lines?: (n: number) => string
  /** Shown on a still-streaming file chip (e.g. "Generating…"). */
  generating?: string
}

// ─── UTF-8-safe base64 (file artifact content travels in a data attribute) ──────
export function encodeContent(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
export function decodeContent(b64: string): string {
  if (!b64) return ''
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * Code blocks with at least this many lines collapse into a download card
 * (Explore only) instead of rendering the full block inline.
 */
export const LONG_CODE_LINE_THRESHOLD = 40

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

/** File metadata from a filename's extension (e.g. `report.md` → Markdown). */
export function fileMetaForFilename(filename: string): FileMeta {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  return LANG_FILE_MAP[ext] ?? FALLBACK
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

/** Make arbitrary text (incl. CJK) a safe, capped filename part. Empty → ''. */
function safeNamePart(text: string): string {
  return text
    .replace(/[/\\:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim()
}

/**
 * Nearest preceding heading (H1–H6) text for a block, used to name an artifact
 * card when the model gave no `:::file`/fence/comment name. Scans previous
 * siblings, then climbs a few levels (handles flat + lightly-nested markdown).
 */
function nearestHeading(start: Element): string | null {
  let node: Element | null = start
  let hops = 0
  while (node && hops < 4) {
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (/^H[1-6]$/.test(sib.tagName)) {
        const t = (sib.textContent || '').trim()
        if (t) return t
      }
    }
    node = node.parentElement
    hops++
  }
  return null
}

export interface EnhanceOptions {
  /** When true, code blocks ≥ LONG_CODE_LINE_THRESHOLD collapse into a card. */
  collapseLong?: boolean
  labels?: ArtifactLabels
}

function makeBtn(action: string, cls: string, text: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = `ca-btn ${cls}`
  b.setAttribute('data-art-action', action)
  b.textContent = text
  return b
}

/**
 * Enhance each `<pre><code>` in `root`. Short blocks get an inline Copy/Download
 * toolbar. When `opts.collapseLong` is set, blocks ≥ LONG_CODE_LINE_THRESHOLD
 * lines collapse into a download CARD (the `<pre>` stays in the DOM but hidden,
 * so Copy/Download/open still read its text). Idempotent per element
 * (`data-artifact` guard). Safe to call on every (re-)render — v-html wipes the
 * subtree so this re-runs against fresh DOM.
 */
export function enhanceCodeBlocks(root: HTMLElement | null, opts: EnhanceOptions = {}): void {
  if (!root) return
  const labels = opts.labels
  const copyText = labels?.copy ?? 'Copy'
  const downloadText = labels?.download ?? 'Download'
  const codes = root.querySelectorAll('pre > code')
  let blockNumber = 0

  codes.forEach(code => {
    const pre = code.parentElement as HTMLElement | null
    if (!pre || pre.dataset.artifact === '1') return
    blockNumber++

    const lang = inferLanguage(code)
    const meta = fileMetaFor(lang)
    const raw = code.textContent || ''
    // Name priority: a fence-supplied name (```lang name.ext → data-filename, set
    // by the markdown pipeline on the <code> or its <pre>), then a first-line
    // comment hint, then the nearest section heading above the block, else
    // "snippet".
    const fenceName = (code as HTMLElement).dataset?.filename || pre.dataset.filename || null
    const headingPart = nearestHeading(pre)
    const headingName = headingPart ? (safeNamePart(headingPart) || null) : null
    const hint = fenceName
      || detectFilenameHint(raw)
      || (headingName ? `${headingName}.${meta.ext}` : null)
    const filename = buildFilename(lang, blockNumber, hint)
    const lineCount = raw.replace(/\n$/, '').split('\n').length

    pre.dataset.artifact = '1'
    pre.dataset.filename = filename
    pre.dataset.mime = meta.mime
    pre.dataset.lang = meta.label
    pre.dataset.langToken = lang
    pre.dataset.lines = String(lineCount)

    const wrapper = document.createElement('div')
    pre.parentNode?.insertBefore(wrapper, pre)

    if (opts.collapseLong && lineCount >= LONG_CODE_LINE_THRESHOLD) {
      // ── Card mode: collapse the long block ───────────────────────────────
      wrapper.className = 'code-artifact code-artifact--card'

      const card = document.createElement('div')
      card.className = 'ca-card'
      card.setAttribute('data-art-action', 'open')
      card.setAttribute('role', 'button')
      card.setAttribute('tabindex', '0')
      if (labels?.open) card.title = labels.open

      const icon = document.createElement('div')
      icon.className = 'ca-card-icon'
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'

      const info = document.createElement('div')
      info.className = 'ca-card-info'
      const title = document.createElement('div')
      title.className = 'ca-card-title'
      title.textContent = filename
      const sub = document.createElement('div')
      sub.className = 'ca-card-sub'
      const linesLabel = labels?.lines ? labels.lines(lineCount) : `${lineCount} lines`
      sub.textContent = `${meta.label} · ${linesLabel}`
      info.appendChild(title)
      info.appendChild(sub)

      const actions = document.createElement('div')
      actions.className = 'ca-card-actions'
      actions.appendChild(makeBtn('copy', 'ca-copy', copyText))
      actions.appendChild(makeBtn('download', 'ca-download', downloadText))

      card.appendChild(icon)
      card.appendChild(info)
      card.appendChild(actions)

      wrapper.appendChild(card)
      wrapper.appendChild(pre) // kept in DOM (hidden via CSS) for copy/download/open
      return
    }

    // ── Inline mode: Copy/Download toolbar above the block ─────────────────
    wrapper.className = 'code-artifact'
    const bar = document.createElement('div')
    bar.className = 'code-artifact-bar'

    const langSpan = document.createElement('span')
    langSpan.className = 'ca-lang'
    langSpan.textContent = meta.label

    bar.appendChild(langSpan)
    bar.appendChild(makeBtn('copy', 'ca-copy', copyText))
    bar.appendChild(makeBtn('download', 'ca-download', downloadText))

    wrapper.appendChild(bar)
    wrapper.appendChild(pre)
  })
}

const FILE_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
const SPINNER_SVG = '<svg class="fa-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'

/**
 * Render `.file-artifact` placeholders (emitted by markdown.ts's file-block
 * pre-extraction) into download CARDS. A `--pending` placeholder (file still
 * streaming) shows a spinner + filename and NO actions; a complete one shows
 * Copy/Download and is clickable to open. Idempotent (`data-enhanced` guard).
 * Card markup mirrors the long-code card so it reuses `.ca-card` styles.
 */
export function enhanceFileArtifacts(root: HTMLElement | null, opts: EnhanceOptions = {}): void {
  if (!root) return
  const labels = opts.labels
  root.querySelectorAll<HTMLElement>('.file-artifact').forEach(el => {
    if (el.dataset.enhanced === '1') return
    el.dataset.enhanced = '1'

    const filename = el.dataset.filename || 'file.txt'
    const pending = el.classList.contains('file-artifact--pending')

    const card = document.createElement('div')
    card.className = 'ca-card fa-card'

    const icon = document.createElement('div')
    icon.className = 'ca-card-icon'
    icon.innerHTML = pending ? SPINNER_SVG : FILE_ICON_SVG

    const info = document.createElement('div')
    info.className = 'ca-card-info'
    const title = document.createElement('div')
    title.className = 'ca-card-title'
    title.textContent = filename
    const sub = document.createElement('div')
    sub.className = 'ca-card-sub'
    if (pending) {
      sub.textContent = labels?.generating ?? 'Generating…'
    } else {
      const lineCount = Number(el.dataset.lines) || 0
      const label = el.dataset.lang || fileMetaForFilename(filename).label
      const linesLabel = labels?.lines ? labels.lines(lineCount) : `${lineCount} lines`
      sub.textContent = `${label} · ${linesLabel}`
    }
    info.appendChild(title)
    info.appendChild(sub)

    card.appendChild(icon)
    card.appendChild(info)

    if (!pending) {
      card.setAttribute('data-art-action', 'open')
      card.setAttribute('role', 'button')
      card.setAttribute('tabindex', '0')
      if (labels?.open) card.title = labels.open
      const actions = document.createElement('div')
      actions.className = 'ca-card-actions'
      actions.appendChild(makeBtn('copy', 'ca-copy', labels?.copy ?? 'Copy'))
      actions.appendChild(makeBtn('download', 'ca-download', labels?.download ?? 'Download'))
      card.appendChild(actions)
    }

    el.appendChild(card)
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

  // File artifact (download chip): content lives base64 in a data attribute.
  const fileArt = btn.closest('.file-artifact') as HTMLElement | null
  if (fileArt) {
    if (fileArt.classList.contains('file-artifact--pending')) return
    const text = decodeContent(fileArt.dataset.contentB64 || '')
    const filename = fileArt.dataset.filename || 'file.txt'
    const meta: ArtifactMeta = {
      filename,
      mime: fileArt.dataset.mime || 'text/plain',
      lang: fileArt.dataset.lang || fileMetaForFilename(filename).label,
      langToken: fileArt.dataset.langToken || 'text',
      lines: Number(fileArt.dataset.lines) || 0,
    }
    const act = btn.getAttribute('data-art-action')
    if (act === 'copy') handlers.onCopy(text, meta)
    else if (act === 'download') handlers.onDownload(text, meta)
    else if (act === 'open') handlers.onOpen?.(text, meta)
    return
  }

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
    langToken: pre.dataset.langToken || 'text',
    lines: Number(pre.dataset.lines) || 0,
  }
  const action = btn.getAttribute('data-art-action')
  if (action === 'copy') handlers.onCopy(text, meta)
  else if (action === 'download') handlers.onDownload(text, meta)
  else if (action === 'open') handlers.onOpen?.(text, meta)
}
