import MarkdownIt from 'markdown-it'
import texmath from 'markdown-it-texmath'
import katex from 'katex'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'

// Register languages — tree-shaken, only these are bundled
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import python from 'highlight.js/lib/languages/python'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import java from 'highlight.js/lib/languages/java'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import sql from 'highlight.js/lib/languages/sql'
import cmake from 'highlight.js/lib/languages/cmake'
import makefile from 'highlight.js/lib/languages/makefile'

hljs.registerLanguage('c', c)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('python', python)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('java', java)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('cmake', cmake)
hljs.registerLanguage('makefile', makefile)

const md = new MarkdownIt({
  html: true,          // allow raw HTML — DOMPurify handles sanitisation
  linkify: true,
  typographer: false,
  breaks: true,        // \n → <br> (GFM-style)
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch { /* fall through */ }
    }
    // No language specified or unknown — try auto-detection
    try {
      return hljs.highlightAuto(str).value
    } catch { /* fall through */ }
    return '' // use markdown-it's default escaping
  }
})

md.use(texmath, {
  engine: katex,
  delimiters: ['dollars', 'brackets'],   // $...$, $$...$$, \(...\), \[...\]
  katexOptions: { throwOnError: false },
})

// Sanitise HTML output — allow KaTeX spans, math tags, and standard markdown output
const PURIFY_CONFIG = {
  // Keep everything markdown-it + KaTeX can produce
  ADD_TAGS: ['eq', 'eqn', 'section', 'annotation'],
  ADD_ATTR: ['style', 'class', 'aria-hidden', 'encoding', 'xmlns'],
  // block dangerous stuff
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
} satisfies DOMPurify.Config

/**
 * Render a markdown string to sanitised HTML.
 * Handles GFM tables, lists, code, bold/italic, headings, math, etc.
 */
export function renderMarkdown(text: string): string {
  if (!text) return ''

  // AI models sometimes pre-escape * and _ for Markdown safety inside math.
  // markdown-it-texmath already handles raw delimiters correctly, but the
  // escaped variants (\*, \_) can break math parsing. Clean them inside
  // math contexts before markdown-it processes the text.
  let cleaned = text
    .replace(/(\$\$[\s\S]+?\$\$)/g, (m) => m.replace(/\\\*/g, '*').replace(/\\_/g, '_'))
    .replace(/(\$[^$\n]+?\$)/g, (m) => m.replace(/\\\*/g, '*').replace(/\\_/g, '_'))
    .replace(/(\\\[[\s\S]+?\\\])/g, (m) => m.replace(/\\\*/g, '*').replace(/\\_/g, '_'))
    .replace(/(\\\([\s\S]+?\\\))/g, (m) => m.replace(/\\\*/g, '*').replace(/\\_/g, '_'))

  const rawHtml = md.render(cleaned)
  return DOMPurify.sanitize(rawHtml, PURIFY_CONFIG)
}

/** Expose the md instance for advanced usage if needed */
export { md }
