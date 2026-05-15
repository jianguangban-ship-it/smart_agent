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

// Additional highlight.js languages not in lowlight's common bundle
import cmake from 'highlight.js/lib/languages/cmake'
import makefile from 'highlight.js/lib/languages/makefile'

// ─── Unified processor (built once, reused across calls) ───────────────────────
const processor = unified()
  .use(remarkParse)                                    // markdown → mdast
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

  // During streaming, trim trailing unclosed math delimiters
  let input = isStreaming ? hideUnclosedMath(text) : text

  // 1. Unwrap LaTeX that the LLM accidentally put in code fences
  input = unwrapLatexFromCodeBlocks(input)

  // 2. Normalize \[...\] → $$...$$, \(...\) → $...$
  input = normalizeMathDelimiters(input)

  // 3. Ensure multiline $$ blocks have $$ on its own line (for remark-math flow)
  input = normalizeDisplayMathBlocks(input)

  // 4. Fix spaced dollar delimiters: $ x $ → $x$
  input = fixSpacedDollarDelimiters(input)

  // 5. Escape | inside math so GFM table parsing doesn't split on them
  input = escapePipesInMath(input)

  // 6. Render through unified/remark/rehype pipeline
  const rawHtml = String(processor.processSync(input))

  // 7. Sanitise
  return DOMPurify.sanitize(rawHtml, PURIFY_CONFIG)
}
