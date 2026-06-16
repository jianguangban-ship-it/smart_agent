import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import DOMPurify from 'dompurify'
import { encodeContent, fileMetaForFilename } from './codeArtifact'

// Additional highlight.js languages not in lowlight's common bundle
import cmake from 'highlight.js/lib/languages/cmake'
import makefile from 'highlight.js/lib/languages/makefile'

// ─── Code-fence filename → <code data-filename> ────────────────────────────────
// Minimal mdast node shape for the dependency-free walk below.
interface MdNode {
  type?: string
  meta?: string | null
  data?: { hProperties?: Record<string, unknown> }
  children?: MdNode[]
}

/**
 * Pull a safe `name.ext` filename token out of a code fence's info string — the
 * text after the language, e.g. ```python quicksort.py → "quicksort.py". Mirrors
 * `detectFilenameHint`'s validation: basename only, no path traversal.
 */
function fenceFilename(meta: string | null | undefined): string | null {
  if (!meta) return null
  const tok = meta.trim().split(/\s+/)[0] || ''
  if (/^[\w.\-/]+\.[A-Za-z0-9]+$/.test(tok) && !tok.includes('..')) {
    return tok.split('/').pop() || null
  }
  return null
}

/**
 * remark transform: copy a code fence's filename (from its info string) onto the
 * emitted `<code>` as `data-filename`, so the artifact card can title itself with
 * it instead of the generic "snippet". AST-based (visits mdast `code` nodes), not
 * a regex on rendered text; dependency-free walk (no `unist-util-visit`).
 */
function remarkCodeFilename() {
  return (tree: MdNode) => {
    const walk = (node: MdNode | undefined): void => {
      if (!node || typeof node !== 'object') return
      if (node.type === 'code' && node.meta) {
        const name = fenceFilename(node.meta)
        if (name) {
          node.data = node.data || {}
          node.data.hProperties = { ...(node.data.hProperties || {}), 'data-filename': name }
        }
      }
      if (Array.isArray(node.children)) for (const child of node.children) walk(child)
    }
    walk(tree)
  }
}

// ─── Unified processor (built once, reused across calls) ───────────────────────
const processor = unified()
  .use(remarkParse)                                    // markdown → mdast
  .use(remarkCodeFilename)                              // ```lang name.ext → <code data-filename>
  .use(remarkMath)                                     // AST-based math ($, $$) — skips code blocks naturally
  .use(remarkGfm)                                      // tables, strikethrough, autolinks, task lists
  .use(remarkBreaks)                                   // \n → <br> (GFM-style)
  .use(remarkRehype, { allowDangerousHtml: true })     // mdast → hast
  .use(rehypeRaw)                                      // parse raw HTML strings into hast nodes
  .use(rehypeKatex, { throwOnError: false } as never)   // render math nodes → KaTeX HTML
  .use(rehypeHighlight, { detect: true, languages: { cmake, makefile } })
  .use(rehypeStringify)                                // hast → HTML string

// ─── DOMPurify config ──────────────────────────────────────────────────────────
// Allow KaTeX spans, MathML tags, and standard markdown output.
const PURIFY_CONFIG = {
  ADD_TAGS: [
    'eq', 'eqn', 'section', 'annotation',
    // MathML elements KaTeX may produce
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'ms', 'mtext',
    'mfrac', 'msqrt', 'mroot', 'msub', 'msup', 'msubsup', 'munder',
    'mover', 'munderover', 'mtable', 'mtr', 'mtd', 'mspace', 'mpadded',
    // <font color="…"> is emitted by the JIRA quality-check agent for the
    // A/B/C/D badge in agentCheck markdown. Spec §3.4 example shows
    // <font color="#32CD32">**A**</font>. Without this, the badge color is
    // stripped and all grades render the same.
    'font',
  ],
  ADD_ATTR: ['style', 'class', 'aria-hidden', 'encoding', 'xmlns',
             'mathvariant', 'stretchy', 'fence', 'separator', 'accent',
             'lspace', 'rspace', 'linethickness', 'displaystyle',
             'scriptlevel', 'width', 'height', 'depth', 'voffset',
             'columnalign', 'rowalign', 'columnspacing', 'rowspacing',
             'color'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
} satisfies DOMPurify.Config

// ─── Pre-processing helpers ────────────────────────────────────────────────────
// These run BEFORE the unified pipeline to normalise LLM output quirks.
// The AST-based pipeline eliminates the need for code-block extraction/restoration
// and math escape cleaning. Pipe escaping is still needed because GFM table
// parsing splits on | at the block level before remark-math runs inline.

/**
 * Normalise math delimiters so remark-math can parse them.
 *
 * Converts:
 *   \[...\] → $$...$$ (display math)
 *   \(...\) → $...$   (inline math)
 *
 * Also fixes double-escaped backslashes from some LLM outputs (\\[ → \[).
 */
function normalizeMathDelimiters(text: string): string {
  let s = text

  // Fix double-escaped backslashes from LLM output (\\[ → \[, \\( → \()
  // BUT skip \\[<dimension>] which is a LaTeX line break with spacing (e.g. \\[4pt], \\[6mm])
  s = s.replace(/\\\\(\[)(?!\s*[\d.]+\s*(?:pt|mm|cm|em|ex|mu|bp|dd|pc|sp)\s*\])/g, '\\$1')
  s = s.replace(/\\\\(\])/g, '\\$1')
  s = s.replace(/\\\\(\()/g, '\\$1')
  s = s.replace(/\\\\(\))/g, '\\$1')

  // Convert \[...\] → $$...$$ (display math, may span multiple lines)
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_match, inner) => `$$${inner}$$`)

  // Convert \(...\) → $...$ (inline math, single line)
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_match, inner) => `$${inner}$`)

  return s
}

/**
 * Detect LaTeX that the LLM accidentally wrapped in code fences and unwrap it.
 * Pattern: a fenced code block whose content is purely LaTeX (starts with
 * \begin, \frac, \sqrt, or similar) — convert it to a display math block.
 */
function unwrapLatexFromCodeBlocks(text: string): string {
  return text.replace(
    /```(?:latex|tex|math)?\s*\n([\s\S]*?)```/g,
    (_match, inner: string) => {
      const trimmed = inner.trim()
      // Heuristic: if it starts with a LaTeX command, treat as math
      if (/^\\(?:begin|frac|sqrt|sum|int|prod|lim|left|right|vec|hat|bar|dot|ddot|tilde|mathbf|mathrm|text)/.test(trimmed)) {
        return `\n$$\n${trimmed}\n$$\n`
      }
      // Not LaTeX — keep as code block
      return _match
    }
  )
}

/**
 * When $$ display math spans multiple lines but $$ is NOT on its own line
 * (e.g. $$\dot{X} = \begin{bmatrix}...\end{bmatrix}$$), move $$ to its own
 * line so remark-math's flow parser can detect it as display math.
 *
 * Single-line $$...$$ (e.g. $$K = PH^T$$) is left alone — remark-math
 * handles it as inline mathText.
 */
function normalizeDisplayMathBlocks(text: string): string {
  // (?:(?!\$\$)[^\n])+ ensures [^\n]+ stops BEFORE any $$ on the same line,
  // so single-line $$content$$ patterns are NOT consumed as "multiline".
  return text.replace(/\$\$((?:(?!\$\$)[^\n])+\n[\s\S]*?)\$\$/g, (_m, inner) => `$$\n${inner.trim()}\n$$`)
}

/**
 * Fix spaced dollar delimiters that many LLMs produce.
 *
 * remark-math requires $ to be directly adjacent to the content
 * (no space after opening $ or before closing $).
 * LLMs commonly output:  $ \hat{v} $  or  $ S = H P_{k|k-1} H^T + R $
 *
 * This function trims spaces:
 *   $ content $   →  $content$     (inline)
 *   $$ content $$ →  $$content$$   (single-line display only)
 *
 * NOTE: Only matches single-line $$ patterns. Multiline $$...$$ blocks must
 * keep $$ on its own line for remark-math flow (display) detection.
 */
function fixSpacedDollarDelimiters(text: string): string {
  let s = text

  // Display math on single line only: $$ content $$
  // Must NOT collapse multiline blocks (remark-math needs $$ on its own line)
  s = s.replace(/\$\$[ \t]+([^\n]+?)[ \t]+\$\$/g, (_m, inner) => `$$${inner}$$`)

  // Inline math: $ content $ (single line only)
  s = s.replace(/(?<!\$)\$\s+([^$\n]+?)\s+\$(?!\$)/g, (_m, inner) => `$${inner}$`)

  return s
}

// Middle-dot characters LLMs use for units: · (U+00B7), ⋅ (U+22C5), ∙ (U+2219).
const UNIT_DOT = /[·⋅∙]/

/**
 * KaTeX maps a literal middle dot to the MATH-only command \cdotp. LLMs commonly
 * place it inside \text{…} (e.g. \text{W/m·K}, \text{N·m}), where a math-mode atom
 * can't render → KaTeX shows a red "\cdotp" error. Inside math regions: split
 * \text{A·B} → \text{A}\cdot\text{B} (so \cdot lands in math mode between text
 * groups), then turn any remaining dot (bare, or inside the math-mode \mathrm{})
 * into \cdot. Scoped to $…$ / $$…$$ so prose middle dots (UI counters, etc.) are
 * untouched. Mirrors the escapePipesInMath / fixSpacedDollarDelimiters approach.
 */
function normalizeUnitDotsInMath(text: string): string {
  if (!UNIT_DOT.test(text)) return text
  const fix = (math: string): string => {
    let s = math
    let prev: string
    do {
      prev = s
      s = s.replace(/\\text\{([^{}]*?)[·⋅∙]([^{}]*?)\}/g, '\\text{$1}\\cdot\\text{$2}')
    } while (s !== prev)
    return s.replace(/[·⋅∙]/g, '\\cdot ')
  }
  let out = text.replace(/\$\$([\s\S]*?)\$\$/g, (m) => fix(m))
  out = out.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (m) => fix(m))
  return out
}

/**
 * Escape pipe characters inside math delimiters so GFM table parsing
 * does not split on them. e.g. $P_{k|k-1}$ inside a table row would otherwise
 * break because | is the column separator.
 *
 * Replaces | → \vert inside $...$ and $$...$$ blocks.
 * Runs before the unified pipeline since GFM table parsing happens at the
 * block level before remark-math's inline parsing.
 */
function escapePipesInMath(text: string): string {
  let s = text
  // Display math: $$...$$
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (match) => match.replace(/\|/g, '\\vert '))
  // Inline math: $...$ (not $$)
  s = s.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (match) => match.replace(/\|/g, '\\vert '))
  return s
}

// Strong LaTeX commands that, on their own, strongly imply a line is an equation.
const STRONG_LATEX_CMD = /\\(?:frac|dfrac|tfrac|sum|int|iint|oint|prod|sqrt|begin|left|right|lim|binom|overline|underline|vec|hat|partial|nabla|cdot|times|approx|leq|geq|neq)\b/
// Any backslash-command (used together with an `ident =` equation shape).
const ANY_LATEX_CMD = /\\[a-zA-Z]+/
// CJK range — lines containing Chinese chars are left to the delimiter pipeline
// (block-wrapping them risks swallowing prose).
const CJK = /[、-〿㐀-䶿一-鿿豈-﫿！-￯]/
// Markdown structural line starts we must never wrap.
const MD_STRUCTURE = /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?|-{3,}\s*$|`{3,})/

/**
 * Auto-wrap bare (un-delimited) block-level LaTeX equations in `$$ … $$` so
 * KaTeX can render output from models that ignore the "use $ delimiters"
 * instruction (e.g. `J = \sum_{i=1}^{N} \left\vert … \right\vert_Q^2`).
 *
 * Conservative by design — only whole lines that *look like an equation* and
 * carry almost no prose are wrapped, so ordinary text (incl. Windows paths,
 * tables, code, Chinese prose) is never touched. Inline bare LaTeX inside a
 * sentence is intentionally NOT handled here (relies on the system prompt).
 */
function wrapBareLatex(text: string, isStreaming: boolean): string {
  const lines = text.split('\n')
  const endsWithNewline = text.endsWith('\n')
  let inFence = false
  let inDisplay = false   // inside an open multiline $$ … $$ block

  const out = lines.map((line, idx) => {
    // Track fenced code blocks (``` / ~~~) — never wrap inside them.
    if (/^\s*(?:```|~~~)/.test(line)) { inFence = !inFence; return line }
    if (inFence) return line

    // Track multiline $$ display blocks: an odd count of $$ on a line toggles
    // the open/closed state. Never wrap lines belonging to such a block — the
    // inner lines have no $ of their own but are still math.
    const wasInDisplay = inDisplay
    const ddCount = (line.match(/\$\$/g) || []).length
    if (ddCount % 2 === 1) inDisplay = !inDisplay
    if (wasInDisplay) return line

    // Skip the final, still-streaming line so a half-equation doesn't flash.
    if (isStreaming && !endsWithNewline && idx === lines.length - 1) return line

    const trimmed = line.trim()
    if (!trimmed) return line
    if (line.includes('$')) return line          // already (partly) delimited
    if (line.includes('|')) return line          // likely a GFM table row
    if (line.startsWith('    ') || line.startsWith('\t')) return line // indented code
    if (CJK.test(line)) return line
    if (MD_STRUCTURE.test(line)) return line

    const hasStrong = STRONG_LATEX_CMD.test(trimmed)
    const isEquation = /^[A-Za-z\\][\w\\]*\s*(?:=|:=|\\(?:approx|leq|geq|neq|equiv|propto))/.test(trimmed) && ANY_LATEX_CMD.test(trimmed)
    if (!hasStrong && !isEquation) return line

    // Prose guard: count natural-language words (≥3 letters) that are NOT part of
    // a LaTeX command. If the line reads mostly as prose, leave it alone.
    const withoutCmds = trimmed.replace(/\\[a-zA-Z]+/g, ' ')
    const proseWords = (withoutCmds.match(/[A-Za-z]{3,}/g) || []).length
    if (proseWords > 2) return line

    // Repair double-escaped commands within this line only (\\vert → \vert),
    // leaving genuine `\\` row breaks (followed by space / single-letter) alone.
    const cleaned = trimmed.replace(/\\\\([a-zA-Z]{2,})/g, '\\$1')
    return `$$${cleaned}$$`
  })

  return out.join('\n')
}

// ─── File artifact extraction (`:::file name="…"` … `:::`) ─────────────────────
// LLMs that ignore delimiters break fenced-code "files" (a Markdown file's own
// ``` closes the outer fence → truncation/spill). We capture file blocks VERBATIM
// before the markdown pipeline using a line-anchored marker (remark-directive's
// `:::` container convention) so inner ``` / tables / math can never break them,
// and so normal inline math/tables (which never start a line with `:::`) are
// untouched. Content rides in an inert base64 data attribute on a placeholder div.

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function parseFileName(rest: string): string {
  const q = rest.match(/name\s*=\s*"([^"]+)"/) || rest.match(/name\s*=\s*'([^']+)'/)
  if (q) return q[1].trim()
  const bare = rest.replace(/[{}]/g, ' ').trim()
  const tok = bare.split(/\s+/).find(x => /\.[A-Za-z0-9]+$/.test(x))
  return tok || 'file.txt'
}

/**
 * Replace `:::file …` / `:::` blocks with an inert `.file-artifact` placeholder
 * (rendered into a download chip post-v-html by codeArtifact.ts). Fence-aware so
 * a `:::file` mentioned inside a ``` code block is left alone. During streaming an
 * unterminated block becomes a `--pending` chip and its partial body is dropped,
 * so nothing spills into the chat before the file is complete.
 */
function extractFileBlocks(text: string, _isStreaming: boolean): string {
  if (!text.includes(':::file')) return text
  const lines = text.split('\n')
  const out: string[] = []
  let inFence = false
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*(?:```|~~~)/.test(line)) { inFence = !inFence; out.push(line); i++; continue }
    const open = !inFence ? /^\s*:::file\b(.*)$/.exec(line) : null
    if (!open) { out.push(line); i++; continue }

    const filename = parseFileName(open[1])
    // Scan for the closing ::: line; capture body verbatim.
    let j = i + 1
    const body: string[] = []
    let closed = false
    while (j < lines.length) {
      if (/^\s*:::\s*$/.test(lines[j])) { closed = true; break }
      body.push(lines[j]); j++
    }

    if (!closed) {
      // Unterminated (mid-stream): pending chip, drop the partial body entirely.
      out.push('', `<div class="file-artifact file-artifact--pending" data-filename="${escapeAttr(filename)}"></div>`, '')
      return out.join('\n')
    }

    const content = body.join('\n')
    const meta = fileMetaForFilename(filename)
    const lineCount = content === '' ? 0 : content.replace(/\n$/, '').split('\n').length
    out.push(
      '',
      `<div class="file-artifact" data-filename="${escapeAttr(filename)}" data-mime="${escapeAttr(meta.mime)}" data-lang="${escapeAttr(meta.label)}" data-lang-token="${escapeAttr(meta.ext)}" data-lines="${lineCount}" data-content-b64="${encodeContent(content)}"></div>`,
      ''
    )
    i = j + 1
  }

  return out.join('\n')
}

/**
 * During streaming, strip trailing unclosed math delimiters to prevent raw
 * LaTeX tokens from flashing. Only trims from the END of the text.
 */
function hideUnclosedMath(text: string): string {
  // Trailing \[ without \]  — trim from last \[
  const lastBracketOpen = text.lastIndexOf('\\[')
  const lastBracketClose = text.lastIndexOf('\\]')
  if (lastBracketOpen >= 0 && lastBracketOpen > lastBracketClose) {
    return text.substring(0, lastBracketOpen)
  }

  // Trailing \( without \)
  const lastParenOpen = text.lastIndexOf('\\(')
  const lastParenClose = text.lastIndexOf('\\)')
  if (lastParenOpen >= 0 && lastParenOpen > lastParenClose) {
    return text.substring(0, lastParenOpen)
  }

  // Trailing unclosed $$ — count occurrences; if odd, trim from last $$
  const ddMatches = text.match(/\$\$/g)
  if (ddMatches && ddMatches.length % 2 !== 0) {
    return text.substring(0, text.lastIndexOf('$$'))
  }

  return text
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Render a markdown string to sanitised HTML.
 * Handles GFM tables, lists, code, bold/italic, headings, math, etc.
 */
export function renderMarkdown(text: string, isStreaming = false): string {
  if (!text) return ''

  // 0. Extract `:::file …` blocks VERBATIM into inert placeholders BEFORE any
  // other pass, so file bodies (which may contain ``` / tables / math) are never
  // parsed, and an unterminated block mid-stream becomes a pending chip (no spill).
  let input = extractFileBlocks(text, isStreaming)

  // During streaming, trim trailing unclosed math delimiters
  if (isStreaming) input = hideUnclosedMath(input)

  // 1. Unwrap LaTeX that the LLM accidentally put in code fences
  input = unwrapLatexFromCodeBlocks(input)

  // 2. Normalize \[...\] → $$...$$, \(...\) → $...$
  input = normalizeMathDelimiters(input)

  // 2b. Auto-wrap bare (un-delimited) block equations so models that ignore the
  // "$ delimiters" instruction still render (e.g. `J = \sum ... \right\vert_Q^2`).
  input = wrapBareLatex(input, isStreaming)

  // 3. Ensure multiline $$ blocks have $$ on its own line (for remark-math flow)
  input = normalizeDisplayMathBlocks(input)

  // 4. Fix spaced dollar delimiters: $ x $ → $x$
  input = fixSpacedDollarDelimiters(input)

  // 4b. Fix literal middle dots in math (·/⋅/∙) — KaTeX maps them to math-only
  // \cdotp, which errors inside \text{…} (e.g. \text{W/m·K}). Convert to \cdot.
  input = normalizeUnitDotsInMath(input)

  // 5. Escape | inside math so GFM table parsing doesn't split on them
  input = escapePipesInMath(input)

  // 6. Render through unified/remark/rehype pipeline
  let rawHtml = String(processor.processSync(input))

  // 6b. Wrap each table in a horizontal-scroll container so wide (math-heavy)
  // tables scroll instead of stretching the panel. GFM tables don't nest, so the
  // flat replace is safe. `<div class>` is allowed by PURIFY_CONFIG below.
  rawHtml = rawHtml
    .replace(/<table(\s[^>]*)?>/g, '<div class="table-scroll"><table$1>')
    .replace(/<\/table>/g, '</table></div>')

  // 7. Sanitise
  return DOMPurify.sanitize(rawHtml, PURIFY_CONFIG)
}
