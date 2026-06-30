<template>
  <div class="history-tab">
    <!-- Search & Filter Bar -->
    <div class="history-toolbar">
      <input
        v-model="searchQuery"
        class="history-search"
        type="text"
        :placeholder="t('coach.historySearch')"
      />
      <select v-model="roleFilter" class="history-filter">
        <option value="all">{{ t('coach.historyFilterAll') }}</option>
        <option value="user">{{ t('coach.historyFilterUser') }}</option>
        <option value="assistant">{{ t('coach.historyFilterCoach') }}</option>
      </select>
    </div>

    <!-- Action Bar -->
    <div v-if="filteredRecords.length > 0" class="history-actions">
      <label class="select-all-label">
        <input
          type="checkbox"
          :checked="allSelected"
          :indeterminate="someSelected && !allSelected"
          @change="toggleSelectAll"
        />
      </label>
      <span v-if="selectedIds.size > 0" class="selected-count">
        {{ t('coach.historySelected').replace('{n}', String(selectedIds.size)) }}
      </span>
      <button
        v-if="selectedIds.size > 0"
        class="action-btn action-delete"
        @click="showDeleteConfirm = true"
      >
        {{ t('coach.historyDelete') }}
      </button>
      <button class="action-btn action-download" @click="showDownloadModal = true">
        {{ t('coach.historyDownloadRaw') }}
      </button>
      <!-- Global chat-log buffer usage: count + mini progress bar. Amber near
           the warn threshold, red when the 200-record buffer is full. -->
      <div
        class="buffer-indicator"
        :class="{ 'buffer-warn': isNearCap, 'buffer-full': bufferFull }"
        :title="bufferTitle"
      >
        <span class="buffer-count">{{ recordCount }} / {{ MAX_RECORDS }}</span>
        <span class="buffer-bar" aria-hidden="true">
          <span class="buffer-fill" :style="{ width: bufferPercent + '%' }" />
        </span>
      </div>
      <button class="action-btn action-clear" @click="showClearConfirm = true">
        {{ t('coach.historyClearAll') }}
      </button>
    </div>

    <!-- Session-grouped view (when no search active) -->
    <div v-if="filteredRecords.length > 0 && !isSearching" class="history-list">
      <!-- Grouped sessions -->
      <!-- Collapsed by default so a long history is easy to scan; click a
           header to expand a specific chat-log. -->
      <details
        v-for="group in sessionGroups.grouped"
        :key="group.sessionId"
        class="session-group"
      >
        <summary class="session-header">
          <div class="session-header-left">
            <div class="session-title-row">
              <input
                v-if="editingId === group.sessionId"
                :ref="setRenameRef"
                v-model="editingText"
                class="session-rename-input"
                :placeholder="firstUserPreview(group.records)"
                @click.stop
                @keyup.enter="saveRename"
                @keyup.esc="cancelRename"
                @blur="saveRename"
              />
              <template v-else>
                <span class="session-preview">{{ sessionTitle(group) }}</span>
                <button
                  class="session-rename-btn"
                  :title="t('coach.historyRename')"
                  :aria-label="t('coach.historyRename')"
                  @click.prevent.stop="startRename(group)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                  </svg>
                </button>
              </template>
            </div>
            <span class="session-meta">
              {{ formatTime(group.firstTimestamp) }}
              <span class="session-count">{{ t('coach.historySessionLabel').replace('{n}', String(group.records.length)) }}</span>
            </span>
          </div>
          <div class="session-header-actions">
            <button
              class="session-download-btn"
              :title="t('coach.historyDownloadSession')"
              :aria-label="t('coach.historyDownloadSession')"
              @click.prevent.stop="openSessionDownload(group.sessionId)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            <button
              class="continue-btn"
              @click.prevent="$emit('continueSession', group.sessionId)"
            >
              {{ t('coach.historyContinue') }}
            </button>
          </div>
        </summary>
        <div class="session-records">
          <div
            v-for="record in group.records"
            :key="record.id"
            class="history-record"
            :class="{ 'record-selected': selectedIds.has(record.id) }"
          >
            <input
              type="checkbox"
              :checked="selectedIds.has(record.id)"
              @change="toggleSelect(record.id)"
              class="record-checkbox"
            />
            <div class="record-body">
              <div class="record-badges">
                <span class="role-badge" :class="[`badge-${record.role}`]">
                  {{ record.role === 'user' ? t('coach.userLabel') : t('coach.agentLabel') }}
                </span>
                <span class="record-time">{{ formatTime(record.timestamp) }}</span>
                <span class="record-hash">#{{ record.id }}</span>
                <button
                  v-if="record.role === 'user'"
                  class="replay-btn"
                  @click="$emit('replay', record.content)"
                >
                  {{ t('coach.historyReplay') }}
                </button>
              </div>
              <div class="record-preview">{{ truncate(record.content, 150) }}</div>
            </div>
          </div>
        </div>
      </details>

      <!-- Ungrouped (legacy) records -->
      <details
        v-if="sessionGroups.ungrouped.length > 0"
        class="session-group session-ungrouped"
      >
        <summary class="session-header">
          <div class="session-header-left">
            <span class="session-preview ungrouped-label">{{ t('coach.historyUngrouped') }}</span>
            <span class="session-meta">
              <span class="session-count">{{ t('coach.historySessionLabel').replace('{n}', String(sessionGroups.ungrouped.length)) }}</span>
            </span>
          </div>
        </summary>
        <div class="session-records">
          <div
            v-for="record in sessionGroups.ungrouped"
            :key="record.id"
            class="history-record"
            :class="{ 'record-selected': selectedIds.has(record.id) }"
          >
            <input
              type="checkbox"
              :checked="selectedIds.has(record.id)"
              @change="toggleSelect(record.id)"
              class="record-checkbox"
            />
            <div class="record-body">
              <div class="record-badges">
                <span class="role-badge" :class="[`badge-${record.role}`]">
                  {{ record.role === 'user' ? t('coach.userLabel') : t('coach.agentLabel') }}
                </span>
                <span class="record-time">{{ formatTime(record.timestamp) }}</span>
                <span class="record-hash">#{{ record.id }}</span>
                <button
                  v-if="record.role === 'user'"
                  class="replay-btn"
                  @click="$emit('replay', record.content)"
                >
                  {{ t('coach.historyReplay') }}
                </button>
              </div>
              <div class="record-preview">{{ truncate(record.content, 150) }}</div>
            </div>
          </div>
        </div>
      </details>
    </div>

    <!-- Flat list (search mode) -->
    <div v-else-if="filteredRecords.length > 0 && isSearching" class="history-list">
      <div
        v-for="record in filteredRecords"
        :key="record.id"
        class="history-record"
        :class="{ 'record-selected': selectedIds.has(record.id) }"
      >
        <input
          type="checkbox"
          :checked="selectedIds.has(record.id)"
          @change="toggleSelect(record.id)"
          class="record-checkbox"
        />
        <div class="record-body">
          <div class="record-badges">
            <span class="role-badge" :class="[`badge-${record.role}`]">
              {{ record.role === 'user' ? t('coach.userLabel') : t('coach.agentLabel') }}
            </span>
            <span class="record-time">{{ formatTime(record.timestamp) }}</span>
            <span class="record-hash">#{{ record.id }}</span>
            <button
              v-if="record.role === 'user'"
              class="replay-btn"
              @click="$emit('replay', record.content)"
            >
              {{ t('coach.historyReplay') }}
            </button>
          </div>
          <div class="record-preview">{{ truncate(record.content, 150) }}</div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="history-empty">
      <p class="empty-title">{{ t('coach.historyEmpty') }}</p>
      <p class="empty-sub">{{ t('coach.historyEmptySub') }}</p>
    </div>

    <!-- Confirm Delete Dialog -->
    <ConfirmDialog
      v-if="showDeleteConfirm"
      :title="t('coach.confirmDeleteTitle')"
      :message="t('coach.confirmDeleteMsg').replace('{n}', String(selectedIds.size))"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />

    <!-- Confirm Clear All Dialog -->
    <ConfirmDialog
      v-if="showClearConfirm"
      :title="t('coach.confirmClearTitle')"
      :message="t('coach.confirmClearMsg').replace('{n}', String(recordCount))"
      @confirm="handleClearAll"
      @cancel="showClearConfirm = false"
    />

    <!-- Download Modal -->
    <DownloadModal
      v-if="showDownloadModal"
      :record-count="downloadTargetCount"
      @select="handleDownload"
      @cancel="closeDownloadModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { CoachHistoryRecord, CoachChannel } from '@/types/api'
import { useI18n } from '@/i18n'
import {
  coachHistory,
  recordCount,
  isNearCap,
  MAX_RECORDS,
  searchRecords,
  deleteRecords,
  clearHistory,
  exportRecords,
  exportSessionsZip,
  sanitizeFilename,
  formatTime,
  getSessionGroups,
  recordsForChannel,
  getSessionName,
  setSessionName,
  type SessionGroup
} from '@/composables/useCoachHistory'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'
import DownloadModal from '@/components/coach/DownloadModal.vue'

const props = withDefaults(defineProps<{
  /** Which conversation channel this history view is scoped to. */
  channel?: CoachChannel
}>(), { channel: 'task' })

const emit = defineEmits<{
  replay: [content: string]
  continueSession: [sessionId: string]
}>()
const { t } = useI18n()

// ─── Search & Filter ────────────────────────────────────────────────────────
const searchQuery = ref('')
const roleFilter = ref<'all' | 'user' | 'assistant'>('all')
let _debounceTimer: number | null = null
const debouncedQuery = ref('')

watch(searchQuery, (val) => {
  if (_debounceTimer) clearTimeout(_debounceTimer)
  _debounceTimer = window.setTimeout(() => {
    debouncedQuery.value = val
  }, 150)
})

const isSearching = computed(() => debouncedQuery.value.trim() !== '' || roleFilter.value !== 'all')

// History is scoped to the given channel (Task coach uses 'task', Explore
// chat passes 'explore'). Filter at the read boundary; search is global.
const filteredRecords = computed(() => {
  const channelIds = new Set(recordsForChannel(props.channel).map(r => r.id))
  return searchRecords(debouncedQuery.value, roleFilter.value)
    .filter(r => channelIds.has(r.id))
})

const sessionGroups = computed(() =>
  getSessionGroups(filteredRecords.value)
)

// ─── Selection ──────────────────────────────────────────────────────────────
const selectedIds = ref<Set<string>>(new Set())

const allSelected = computed(() =>
  filteredRecords.value.length > 0 && filteredRecords.value.every(r => selectedIds.value.has(r.id))
)
const someSelected = computed(() =>
  filteredRecords.value.some(r => selectedIds.value.has(r.id))
)

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(filteredRecords.value.map(r => r.id))
  }
}

// ─── Actions ────────────────────────────────────────────────────────────────
const showDeleteConfirm = ref(false)
const showClearConfirm = ref(false)
const showDownloadModal = ref(false)
// When set, the download modal targets a single session (named by its label)
// instead of the selected-or-all merge export.
const downloadSessionId = ref<string | null>(null)

const downloadTargetCount = computed(() => {
  if (downloadSessionId.value) {
    const g = sessionGroups.value.grouped.find(g => g.sessionId === downloadSessionId.value)
    return g ? g.records.length : 0
  }
  return selectedIds.value.size > 0 ? selectedIds.value.size : coachHistory.value.length
})

function openSessionDownload(sessionId: string) {
  downloadSessionId.value = sessionId
  showDownloadModal.value = true
}

function closeDownloadModal() {
  showDownloadModal.value = false
  downloadSessionId.value = null
}

function handleDelete() {
  deleteRecords(selectedIds.value)
  selectedIds.value = new Set()
  showDeleteConfirm.value = false
}

function handleClearAll() {
  clearHistory()
  selectedIds.value = new Set()
  showClearConfirm.value = false
}

function handleDownload(format: 'json' | 'markdown' | 'both') {
  if (downloadSessionId.value) {
    // Single session → export only its records, filename = the session label.
    const group = sessionGroups.value.grouped.find(g => g.sessionId === downloadSessionId.value)
    if (group) {
      exportRecords(group.records, format, sanitizeFilename(sessionTitle(group)))
    }
  } else {
    // Bulk: split the selected-or-all records into one file PER chat, named by
    // the chat title, delivered as a single .zip (one plain file if only 1 chat).
    const targetIds = selectedIds.value.size > 0
      ? selectedIds.value
      : new Set(coachHistory.value.map(r => r.id))
    const sessions = sessionGroups.value.grouped
      .map(g => ({ name: sessionTitle(g), records: g.records.filter(r => targetIds.has(r.id)) }))
      .filter(s => s.records.length > 0)
    // Defensive: any selected records not in a session group (legacy, no sessionId)
    // → one fallback file so nothing is silently dropped.
    const covered = new Set(sessions.flatMap(s => s.records.map(r => r.id)))
    const leftover = coachHistory.value.filter(r => targetIds.has(r.id) && !covered.has(r.id))
    if (leftover.length) sessions.push({ name: 'coach-history', records: leftover })

    if (sessions.length <= 1) {
      exportRecords(sessions[0]?.records ?? [], format, sessions[0] ? sanitizeFilename(sessions[0].name) : undefined)
    } else {
      exportSessionsZip(sessions, format)
    }
  }
  closeDownloadModal()
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '...'
}

function firstUserPreview(records: CoachHistoryRecord[]): string {
  const first = records.find(r => r.role === 'user')
  return truncate(first?.content || '...', 60)
}

// ─── Session rename (chat-log header) ────────────────────────────────────────
// Header shows the user's custom name when set, else the first-message preview.
function sessionTitle(group: SessionGroup): string {
  return getSessionName(group.sessionId) ?? firstUserPreview(group.records)
}

const editingId = ref<string | null>(null)
const editingText = ref('')
const renameInputEl = ref<HTMLInputElement | null>(null)
function setRenameRef(el: unknown) {
  if (el) renameInputEl.value = el as HTMLInputElement
}

function startRename(group: SessionGroup) {
  editingId.value = group.sessionId
  editingText.value = getSessionName(group.sessionId) ?? ''
  nextTick(() => {
    renameInputEl.value?.focus()
    renameInputEl.value?.select()
  })
}
function saveRename() {
  if (editingId.value === null) return
  setSessionName(editingId.value, editingText.value)
  editingId.value = null
  editingText.value = ''
}
function cancelRename() {
  editingId.value = null
  editingText.value = ''
}

// ─── Buffer indicator ────────────────────────────────────────────────────────
// Global chat-log buffer usage (all channels), vs the 200-record cap.
const bufferPercent = computed(() => Math.min(100, Math.round((recordCount.value / MAX_RECORDS) * 100)))
const bufferFull = computed(() => recordCount.value >= MAX_RECORDS)
const bufferTitle = computed(() =>
  t('coach.historyBufferTitle')
    .replace('{n}', String(recordCount.value))
    .replace('{max}', String(MAX_RECORDS))
)
</script>

<style scoped>
.history-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Toolbar */
.history-toolbar {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);
}
.history-search {
  flex: 1;
  padding: 5px 10px;
  font-size: 11px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
}
.history-search:focus {
  border-color: var(--accent-blue);
}
.history-filter {
  padding: 5px 8px;
  font-size: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
}

/* Action bar */
.history-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-color);
  font-size: 10px;
}
.select-all-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}
.selected-count {
  color: var(--text-muted);
}
.action-btn {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.action-btn:hover { opacity: 0.8; }
.action-delete {
  color: var(--accent-red);
  background: var(--red-subtle);
}
.action-download {
  color: var(--accent-blue);
  background: var(--blue-subtle);
}
.action-clear {
  margin-left: auto;
  color: var(--accent-red);
  background: transparent;
}

/* Buffer indicator (global chat-log usage vs the 200-record cap) */
.buffer-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--text-muted);
  cursor: default;
}
.buffer-count {
  font-family: var(--font-mono);
  white-space: nowrap;
}
.buffer-bar {
  width: 48px;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-secondary);
  overflow: hidden;
}
.buffer-fill {
  display: block;
  height: 100%;
  background: var(--accent-blue);
  border-radius: 2px;
  transition: width 0.2s ease;
}
.buffer-warn .buffer-fill { background: var(--accent-orange); }
.buffer-warn .buffer-count { color: var(--accent-orange); }
.buffer-full .buffer-fill { background: var(--accent-red); }
.buffer-full .buffer-count { color: var(--accent-red); font-weight: 600; }

/* Record list */
.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px;
}

/* Session groups */
.session-group {
  margin-bottom: 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background-color: var(--bg-tertiary);
  cursor: pointer;
  list-style: none;
  gap: 8px;
}
.session-header::-webkit-details-marker {
  display: none;
}
.session-header::before {
  content: '\25B6';
  font-size: 8px;
  color: var(--text-muted);
  transition: transform 0.15s;
  flex-shrink: 0;
}
details[open] > .session-header::before {
  transform: rotate(90deg);
}
.session-header-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.session-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.session-preview {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Pencil rename trigger — hidden until the session card is hovered. */
.session-rename-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
}
.session-header:hover .session-rename-btn {
  opacity: 0.7;
}
.session-rename-btn:hover {
  opacity: 1;
  color: var(--accent-blue);
  background: var(--bg-secondary);
}
.session-rename-btn svg {
  width: 12px;
  height: 12px;
}
.session-rename-input {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-blue);
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
}
.ungrouped-label {
  color: var(--text-muted);
  font-style: italic;
}
.session-meta {
  font-size: 9px;
  color: var(--text-muted);
  display: flex;
  gap: 8px;
}
.session-count {
  padding: 0 4px;
  border-radius: 4px;
  background-color: var(--bg-secondary);
}
.session-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
/* Per-session download trigger — hidden until the session card is hovered
   (mirrors the rename pencil), revealed for focus/keyboard users too. */
.session-download-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
}
.session-header:hover .session-download-btn,
.session-download-btn:focus-visible {
  opacity: 0.7;
}
.session-download-btn:hover {
  opacity: 1;
  color: var(--accent-blue);
  background: var(--bg-secondary);
}
.session-download-btn svg {
  width: 13px;
  height: 13px;
}
.continue-btn {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-green);
  background-color: var(--green-subtle);
  color: var(--accent-green);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.continue-btn:hover {
  background-color: var(--accent-green);
  color: white;
}
.session-records {
  padding: 4px 6px;
}

/* Record cards */
.history-record {
  display: flex;
  gap: 8px;
  padding: 8px;
  margin-bottom: 4px;
  border-radius: var(--radius-md);
  background-color: var(--bg-tertiary);
  transition: all 0.15s;
}
.record-selected {
  background-color: var(--blue-wash, var(--bg-secondary));
  border: 1px solid var(--accent-blue);
}
.history-record:not(.record-selected) {
  border: 1px solid transparent;
}
.record-checkbox {
  margin-top: 2px;
  accent-color: var(--accent-blue);
  flex-shrink: 0;
}
.record-body {
  flex: 1;
  min-width: 0;
}
.record-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 3px;
}
.role-badge {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
}
.badge-user {
  background-color: var(--green-subtle);
  color: var(--accent-green);
}
.badge-assistant {
  background-color: var(--blue-subtle);
  color: var(--accent-blue);
}
.record-time {
  font-size: 9px;
  color: var(--text-muted);
}
.record-hash {
  font-size: 8px;
  color: var(--text-muted);
  opacity: 0.6;
  font-family: var(--font-mono);
}
.replay-btn {
  margin-left: auto;
  font-size: 9px;
  color: var(--accent-blue);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0 4px;
}
.replay-btn:hover {
  text-decoration: underline;
}
.record-preview {
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Empty state */
.history-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
}
.empty-title {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.empty-sub {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.7;
}
</style>
