<template>
  <div class="chats-page">
    <!-- Header: title + (initial) Select/New, or (selecting) bulk action bar. -->
    <header class="chats-head">
      <h1 class="chats-title">{{ t('coach.chatsNav') }}</h1>

      <div v-if="!selecting" class="chats-head-actions">
        <button type="button" class="chats-btn chats-btn-ghost chats-btn-select" @click="enterSelect">{{ t('coach.chatsSelect') }}</button>
        <button type="button" class="chats-btn chats-btn-primary chats-btn-newchat" @click="$emit('new-chat')">{{ t('coach.exploreNewChat') }}</button>
      </div>

      <div v-else class="chats-head-actions">
        <span class="chats-selected-count">{{ fmt('coach.chatsSelected', selectedIds.size) }}</span>
        <button type="button" class="chats-btn chats-btn-ghost chats-btn-download" :disabled="selectedIds.size === 0" @click="showDownloadModal = true">{{ t('coach.historyDownloadRaw') }}</button>
        <button type="button" class="chats-btn chats-btn-ghost chats-btn-selectall" @click="selectAll">{{ t('coach.chatsSelectAll') }}</button>
        <button type="button" class="chats-btn chats-btn-ghost chats-btn-moveproject" disabled :title="t('coach.chatsComingSoon')">{{ t('coach.chatsMoveToProject') }}</button>
        <button type="button" class="chats-btn chats-btn-ghost chats-btn-danger" :disabled="selectedIds.size === 0" @click="showDeleteConfirm = true">{{ t('coach.chatDelete') }}</button>
        <button type="button" class="chats-btn chats-btn-plain chats-btn-cancel" @click="cancelSelect">{{ t('coach.chatsCancel') }}</button>
      </div>
    </header>

    <!-- Search -->
    <div class="chats-search-wrap">
      <svg class="chats-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input v-model="query" type="text" class="chats-search" :placeholder="t('coach.searchPlaceholder')" />
    </div>

    <!-- List -->
    <div class="chats-list">
      <p v-if="filtered.length === 0" class="chats-empty">{{ t('coach.exploreNoChats') }}</p>
      <div
        v-for="g in filtered"
        :key="g.sessionId"
        class="chats-row"
        :class="{ selected: selecting && selectedIds.has(g.sessionId) }"
        @click="onRowClick(g.sessionId)"
      >
        <input
          v-if="selecting"
          type="checkbox"
          class="chats-checkbox"
          :checked="selectedIds.has(g.sessionId)"
          @click.stop="toggle(g.sessionId)"
        />
        <span class="chats-row-title">{{ title(g) }}</span>
        <span class="chats-row-date">{{ relativeDate(g.lastTimestamp) }}</span>
      </div>
    </div>

    <DownloadModal
      v-if="showDownloadModal"
      :record-count="selectedIds.size"
      @select="handleDownload"
      @cancel="showDownloadModal = false"
    />
    <ConfirmDialog
      v-if="showDeleteConfirm"
      :title="t('coach.confirmDeleteTitle')"
      :message="fmt('coach.confirmDeleteMsg', selectedIds.size)"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from '@/i18n'
import {
  recordsForChannel, getSessionGroups, getSessionName, getSessionRecords,
  deleteSession, exportRecords, exportSessionsZip, sanitizeFilename,
  type SessionGroup,
} from '@/composables/useCoachHistory'
import type { CoachHistoryRecord } from '@/types/api'
import DownloadModal from '@/components/coach/DownloadModal.vue'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'

const emit = defineEmits<{ select: [sessionId: string]; 'new-chat': [] }>()
const { t, isZh } = useI18n()

// `{n}`-style interpolation (this project's t() returns the raw string).
function fmt(key: string, n: number): string {
  return t(key).replace('{n}', String(n))
}

function firstUserPreview(records: CoachHistoryRecord[]): string {
  const first = records.find(r => r.role === 'user')
  const text = first?.content || '...'
  return text.length <= 80 ? text : text.slice(0, 80) + '...'
}
function title(g: SessionGroup): string {
  return getSessionName(g.sessionId) ?? firstUserPreview(g.records)
}

// All Explore chats, newest-first, filtered by the search box (title + message text).
const query = ref('')
const sessions = computed(() => getSessionGroups(recordsForChannel('explore')).grouped)
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return sessions.value
  return sessions.value.filter(g => {
    const hay = (title(g) + ' ' + g.records.map(r => r.content).join(' ')).toLowerCase()
    return hay.includes(q)
  })
})

// ── Selection mode ────────────────────────────────────────────────────────────
const selecting = ref(false)
const selectedIds = ref<Set<string>>(new Set())

function enterSelect() { selecting.value = true; selectedIds.value = new Set() }
function cancelSelect() { selecting.value = false; selectedIds.value = new Set() }
function toggle(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}
function selectAll() {
  selectedIds.value = new Set(filtered.value.map(g => g.sessionId))
}
function onRowClick(id: string) {
  if (selecting.value) toggle(id)
  else emit('select', id)
}

// ── Delete + DownloadRaw (reuse the existing export/delete plumbing) ───────────
const showDeleteConfirm = ref(false)
const showDownloadModal = ref(false)

function handleDelete() {
  selectedIds.value.forEach(id => deleteSession(id))
  showDeleteConfirm.value = false
  cancelSelect()
}
function handleDownload(format: 'json' | 'markdown' | 'both') {
  const exports = [...selectedIds.value]
    .map(id => {
      const g = sessions.value.find(s => s.sessionId === id)
      return { name: g ? title(g) : 'chat', records: getSessionRecords(id) }
    })
    .filter(s => s.records.length > 0)
  if (exports.length <= 1) {
    exportRecords(exports[0]?.records ?? [], format, exports[0] ? sanitizeFilename(exports[0].name) : undefined)
  } else {
    exportSessionsZip(exports, format)
  }
  showDownloadModal.value = false
}

// ── Relative date: "Today / Yesterday / N days ago", else "Jun 20" ────────────
function relativeDate(ts: number): string {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const day = 86_400_000
  const diffDays = Math.floor((startOfToday.getTime() - ts) / day)
  if (ts >= startOfToday.getTime()) return t('coach.timeToday')
  if (diffDays < 1) return t('coach.timeYesterday')
  if (diffDays < 7) return fmt('coach.chatsDaysAgo', diffDays)
  const d = new Date(ts)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat(isZh.value ? 'zh-CN' : 'en-US', {
    month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }),
  }).format(d)
}
</script>

<style scoped>
.chats-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-5) 0;
  box-sizing: border-box;
}
.chats-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}
.chats-title {
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.chats-head-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.chats-selected-count {
  font-size: var(--font-sm);
  color: var(--text-muted);
  margin-right: var(--space-1);
}
.chats-btn {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s;
}
.chats-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.chats-btn-ghost {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--border-color);
}
.chats-btn-ghost:hover:not(:disabled) { background: var(--bg-secondary); }
.chats-btn-primary {
  background: var(--text-primary);
  color: var(--bg-primary);
}
.chats-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.chats-btn-plain {
  background: transparent;
  color: var(--text-muted);
}
.chats-btn-plain:hover:not(:disabled) { color: var(--text-primary); }
.chats-btn-download { color: var(--accent-red); }
.chats-btn-danger { color: var(--accent-red); }

/* Search */
.chats-search-wrap {
  position: relative;
  margin-bottom: var(--space-3);
}
.chats-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--text-muted);
  pointer-events: none;
}
.chats-search {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px 12px 42px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 15px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.chats-search:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px var(--blue-subtle, rgba(96, 165, 250, 0.15));
}

/* List */
.chats-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.chats-empty {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-sm);
}
.chats-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.15s;
}
.chats-row:hover { background: var(--bg-tertiary); }
.chats-row.selected { background: var(--blue-subtle, rgba(96, 165, 250, 0.10)); }
.chats-checkbox {
  flex-shrink: 0;
  accent-color: var(--accent-blue);
  cursor: pointer;
}
.chats-row-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  color: var(--text-primary);
}
.chats-row-date {
  flex-shrink: 0;
  font-size: var(--font-sm);
  color: var(--text-muted);
}
</style>
