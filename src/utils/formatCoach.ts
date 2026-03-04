import { useI18n } from '@/i18n'
import katex from 'katex'

// Hoist to module scope — avoids creating new closures on every streaming token
const { t } = useI18n()

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Extract math delimiters from RAW text (before HTML escaping), replace with
// placeholders. This must run BEFORE escapeHtml so that < > inside TeX are
// preserved for KaTeX, and BEFORE markdown formatting so \n→<br> doesn't
// corrupt TeX content.
function extractMath(rawText: string): { text: string; restore: (html: string) => string } {
  const slots: string[] = []
  const placeholder = (i: number) => `\x00MATH${i}\x00`

  function collect(tex: string, display: boolean, fallback: string): string {
    try {
      // AI models often pre-escape * and _ for Markdown safety (e.g. i_d^{\*}),
      // but \* and \_ are not valid LaTeX math commands.
      // Strip these Markdown escapes so KaTeX receives clean TeX (e.g. i_d^{*}).
      const clean = tex.trim()
        .replace(/\\\*/g, '*')
        .replace(/\\_(?![a-zA-Z])/g, '_')  // \_ → _ only when not part of a command like \_text
      slots.push(katex.renderToString(clean, { displayMode: display, throwOnError: false }))
    } catch {
      slots.push(fallback)
    }
    return placeholder(slots.length - 1)
  }

  let t = rawText
  // Display math: $$ ... $$ and \[ ... \] (must come before inline)
  t = t.replace(/\$\$([\s\S]+?)\$\$/g, (m, tex) => collect(tex, true, m))
  t = t.replace(/\\\[([\s\S]+?)\\\]/g, (m, tex) => collect(tex, true, m))
  // Inline math: \( ... \) and single $ ... $ (not $$)
  t = t.replace(/\\\(([\s\S]+?)\\\)/g, (m, tex) => collect(tex, false, m))
  t = t.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (m, tex) => collect(tex, false, m))

  return {
    text: t,
    restore: (html: string) => html.replace(/\x00MATH(\d+)\x00/g, (_, i) => slots[+i] ?? '')
  }
}

function formatMarkdownText(text: string): string {
  if (!text) return ''
  const math = extractMath(text)
  let t = escapeHtml(math.text)

  // Markdown escape sequences → HTML entities (before bold/italic regex)
  // Prevents \* from pairing with other * and triggering bold formatting
  t = t.replace(/\\\*/g, '&#42;')
  t = t.replace(/\\_/g, '&#95;')
  t = t.replace(/\\\\/g, '&#92;')

  // Headers
  t = t.replace(/^### (.+)$/gm, '<h4 class="coach-h4">$1</h4>')
  t = t.replace(/^## (.+)$/gm, '<h3 class="coach-h3">$1</h3>')

  // Response-boundary divider (between accumulated coach turns)
  t = t.replace(/^===COACH_TURN===$/gm, '<hr class="coach-response-divider">')

  // Horizontal rule (within a single response)
  t = t.replace(/^---+$/gm, '<hr class="coach-hr">')

  // Bold
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong class="coach-bold">$1</strong>')
  t = t.replace(/__(.+?)__/g, '<strong class="coach-bold">$1</strong>')

  // Inline code
  t = t.replace(/`([^`]+)`/g, '<code class="coach-code">$1</code>')

  // Status icons
  t = t.replace(/🔴/g, '<span class="coach-icon-error">🔴</span>')
  t = t.replace(/🟢/g, '<span class="coach-icon-success">🟢</span>')
  t = t.replace(/🟡/g, '<span class="coach-icon-warning">🟡</span>')
  t = t.replace(/❌/g, '<span class="coach-icon-error">❌</span>')
  t = t.replace(/✅/g, '<span class="coach-icon-success">✅</span>')
  t = t.replace(/⚠️/g, '<span class="coach-icon-warning">⚠️</span>')

  // List items
  t = t.replace(/^[-*]\s+(.+)$/gm, '<div class="coach-list-item"><span class="coach-list-bullet">•</span> $1</div>')
  t = t.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="coach-list-item"><span class="coach-list-num">$1.</span> $2</div>')

  // Paragraphs
  t = t.replace(/\n\n+/g, '</p><p class="coach-para">')
  t = t.replace(/\n/g, '<br>')
  // Strip <br> injected between block-level elements (div, h3, h4, hr) — those create
  // unwanted empty lines because every \n was blindly converted above
  t = t.replace(/(<\/div>|<\/h[34]>|<hr[^>]*>)<br>/g, '$1')
  t = t.replace(/<br>(<div|<h[34])/g, '$1')
  t = '<p class="coach-para">' + t + '</p>'
  t = t.replace(/<p class="coach-para"><\/p>/g, '')

  return math.restore(t)
}

function formatCommentList(comment: string): string {
  if (!comment) return ''
  const text = escapeHtml(comment)
  const items = text.split(/(?=\d+\.\s)/)

  if (items.length > 1) {
    let html = '<div class="coach-issues-list">'
    for (const item of items) {
      const trimmed = item.trim()
      if (!trimmed) continue
      const match = trimmed.match(/^(\d+)\.\s*(.+?)(?:；|;|$)/s)
      if (match) {
        const num = match[1]
        let content = match[2] || trimmed.replace(/^\d+\.\s*/, '')
        content = content.replace(/[；;]\s*$/, '')
        content = content.replace(
          /(缺少|缺失|未提供|未明确|未关联|未提及|未说明|未定义|不明确)/g,
          '<span class="coach-highlight-error">$1</span>'
        )
        html += `<div class="coach-issue-item">
          <span class="coach-issue-num">${num}</span>
          <span class="coach-issue-text">${content}</span>
        </div>`
      }
    }
    html += '</div>'
    return html
  }
  return `<p>${text}</p>`
}

export function formatCoachResponse(data: unknown): string {
  if (!data) return ''

  let item: Record<string, unknown> | null = null
  if (Array.isArray(data)) {
    item = data[0] as Record<string, unknown>
  } else if (typeof data === 'object' && data !== null) {
    item = data as Record<string, unknown>
  } else {
    return escapeHtml(String(data))
  }

  if (!item) return ''

  const hasStructuredFields = item.status || item.comment || item.markdown_msg || item.team

  if (!hasStructuredFields) {
    const text = (item.raw_content || item.message || item.output || item.content || item.text || '') as string
    if (text) return formatMarkdownText(text)
  }

  // Build structured output
  let html = ''

  if (item.status) {
    const status = item.status as string
    const cls = status === 'PASS' ? 'coach-status-pass' :
                status === 'FAIL' ? 'coach-status-fail' : 'coach-status-warn'
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️'
    html += `<div class="coach-status-badge ${cls}">${icon} ${escapeHtml(status)}</div>`
  }

  if (item.team) {
    html += `<div class="coach-info-row">
      <span class="coach-info-label">📂 ${t('coach.team')}:</span>
      <span class="coach-info-value">${escapeHtml(item.team as string)}</span>
    </div>`
  }

  if (item.assignee) {
    html += `<div class="coach-info-row">
      <span class="coach-info-label">👤 ${t('coach.assignee')}:</span>
      <span class="coach-info-value">${escapeHtml(item.assignee as string)}</span>
    </div>`
  }

  if (item.jira_id) {
    html += `<div class="coach-info-row">
      <span class="coach-info-label">🎫 JIRA ID:</span>
      <span class="coach-info-value">${escapeHtml(item.jira_id as string)}</span>
    </div>`
  }

  if (item.markdown_msg) {
    html += `<div class="coach-main-message">${formatMarkdownText(item.markdown_msg as string)}</div>`
  }

  if (item.comment) {
    html += `<div class="coach-comment-section">
      <div class="coach-comment-title">📋 ${t('coach.reviewDetails')}</div>
      <div class="coach-comment-content">${formatCommentList(item.comment as string)}</div>
    </div>`
  }

  if (item.raw_content && !item.markdown_msg && !item.comment) {
    html += `<div class="coach-main-message">${formatMarkdownText(item.raw_content as string)}</div>`
  }

  return html || '<div class="coach-empty">No content available</div>'
}
