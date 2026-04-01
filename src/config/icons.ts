/**
 * Centralized emoji / icon registry.
 * Edit this file to change any emoji used across the UI.
 */
export const ICONS = {
  // ─── Coach structured response ────────────────────────────────────────────
  statusPass: '✅',
  statusFail: '❌',
  statusWarn: '⚠️',
  team: '📂',
  assignee: '👤',
  jiraId: '🎫',
  reviewDetails: '📋',

  // ─── Header & navigation ─────────────────────────────────────────────────
  settings: '⚙',

  // ─── Panel titles ─────────────────────────────────────────────────────────
  coachPanel: '',
  reviewPanel: '🔍',
  jiraPanel: '',
  ticketHistory: '🎫',
  hotkeys: '⌨️',

  // ─── DevTools ─────────────────────────────────────────────────────────────
  devWebhook: '',
  devHint: '💡',
  devAgent: '',

  // ─── Settings modal (import / export arrows) ─────────────────────────────
  importArrow: '⬆',
  exportArrow: '⬇',

  // ─── Template chip defaults ───────────────────────────────────────────────
  templateAc: '📋',
  templateOptimize: '✨',
  templateBug: '🐛',
  templateChangeReq: '🔄',
  templateNewChip: '✏️',
} as const

export type IconKey = keyof typeof ICONS
