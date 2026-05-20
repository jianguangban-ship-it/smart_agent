<template>
  <div class="history-panel">
    <details :open="!!lastCreatedKey || isCreating">
      <summary class="history-summary">
        <span class="summary-title">
          <!-- Disclosure chevron — rotates 90° when <details> is open. -->
          <svg class="summary-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 6 15 12 9 18" />
          </svg>
          {{ ICONS.ticketHistory }} {{ t('history.title') }}
        </span>
        <span class="summary-right">
          <Transition name="badge-fade" mode="out-in">
            <span v-if="isCreating && !lastCreatedKey" key="creating" class="creating-badge">
              <span class="creating-spinner"></span>
              {{ t('panel.jiraCreating') }}
            </span>
            <span v-else-if="lastCreatedKey" key="created" class="created-badge">
              <span class="created-dot"></span>
              {{ t('status.created') }}
            </span>
          </Transition>
          <button
            v-if="ticketHistory.length > 0"
            class="clear-btn"
            @click.prevent="clearHistory"
            :title="t('history.clear')"
            :aria-label="t('history.clear')"
          >
            {{ t('history.clear') }}
          </button>
        </span>
      </summary>

      <div class="history-content">
        <div v-if="ticketHistory.length === 0" class="empty-state">
          {{ t('history.empty') }}
        </div>
        <div v-else class="entry-list">
          <div
            v-for="entry in ticketHistory"
            :key="entry.key + entry.date"
            class="entry-row"
            :class="{ 'entry-new': entry.key === lastCreatedKey }"
          >
            <a
              class="entry-key"
              :href="'https://jira.gwm.cn/browse/' + entry.key"
              target="_blank"
              rel="noopener noreferrer"
            >{{ entry.key }}</a>
            <span class="entry-summary">{{ entry.summary }}</span>
            <button
              class="entry-remove"
              @click.prevent="removeTicket(entry.key, entry.date)"
              :title="t('history.removeEntry')"
              :aria-label="t('history.removeEntry')"
            >×</button>
            <div class="entry-meta">
              <span class="entry-badge entry-badge--project">{{ entry.project }}</span>
              <span class="entry-badge entry-badge--type">{{ entry.issueType }}</span>
              <span class="entry-date">{{ relativeDate(entry.date) }}</span>
            </div>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from '@/i18n'
import { ticketHistory, clearHistory, removeTicket } from '@/composables/useTicketHistory'
import { ICONS } from '@/config/icons'

defineProps<{
  lastCreatedKey?: string
  isCreating?: boolean
}>()

const { t } = useI18n()

// Tick `now` once per minute so relative dates ("3m ago" → "4m ago" → "1h
// ago") update without requiring an unrelated re-render. Referencing
// `now.value` inside relativeDate registers the dependency on the template.
const now = ref(Date.now())
let tickId: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  tickId = setInterval(() => { now.value = Date.now() }, 60_000)
})
onBeforeUnmount(() => {
  if (tickId !== null) clearInterval(tickId)
})

function relativeDate(iso: string): string {
  const diff = now.value - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('history.justNow')
  if (mins < 60) return `${mins}${t('history.minsAgo')}`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}${t('history.hoursAgo')}`
  return `${Math.floor(hrs / 24)}${t('history.daysAgo')}`
}
</script>

<style scoped>
.history-panel {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 12px;
}
.history-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  list-style: none;
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 12px;
}
.history-summary::-webkit-details-marker { display: none; }
.summary-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}
.summary-chevron {
  width: 12px;
  height: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 0.18s ease;
}
details[open] > .history-summary .summary-chevron { transform: rotate(90deg); }

.summary-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Created badge */
.created-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--accent-green);
  padding: 1px 8px;
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--accent-green) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-green) 25%, transparent);
}
.created-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--accent-green);
}

/* Creating badge */
.creating-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--accent-orange, #e0982e);
  padding: 1px 8px;
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--accent-orange, #e0982e) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-orange, #e0982e) 25%, transparent);
}
.creating-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid color-mix(in srgb, var(--accent-orange, #e0982e) 30%, transparent);
  border-top-color: var(--accent-orange, #e0982e);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.badge-fade-enter-active { animation: badgeIn 0.3s ease-out; }
.badge-fade-leave-active { animation: badgeIn 0.3s ease-out reverse; }
@keyframes badgeIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

.clear-btn {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.clear-btn:hover {
  color: var(--accent-red);
  border-color: var(--accent-red);
}

.history-content {
  padding: 8px 12px 10px;
  border-top: 1px solid var(--border-color);
}

.empty-state {
  color: var(--text-muted);
  text-align: center;
  padding: 8px 0;
  font-size: 11px;
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.entry-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto auto;
  gap: 2px 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  transition: border-color 0.3s, box-shadow 0.3s;
}
.entry-row.entry-new {
  border-color: var(--accent-green);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-green) 20%, transparent);
}

.entry-key {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-blue);
  grid-row: 1;
  grid-column: 1;
  white-space: nowrap;
  text-decoration: none;
  align-self: center;
}
.entry-key:hover {
  text-decoration: underline;
}

.entry-summary {
  font-size: 11px;
  color: var(--text-primary);
  grid-row: 1;
  grid-column: 2;
  /* Clamp long JIRA summaries to two lines so row height stays predictable. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

/* Per-entry × — appears on row hover/focus to avoid visual clutter at rest. */
.entry-remove {
  grid-row: 1;
  grid-column: 3;
  align-self: start;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background-color 0.15s;
}
.entry-row:hover .entry-remove,
.entry-remove:focus-visible {
  opacity: 1;
}
.entry-remove:hover {
  color: var(--accent-red);
  background-color: color-mix(in srgb, var(--accent-red) 12%, transparent);
}

.entry-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  grid-row: 2;
  grid-column: 1 / -1;
  flex-wrap: wrap;
}

.entry-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
}
/* Project = "where" → blue (matches entry-key). */
.entry-badge--project {
  background-color: var(--blue-wash);
  color: var(--accent-blue);
  border: 1px solid var(--blue-subtle);
}
/* Issue type = "what kind" → purple, visually distinct from Project. */
.entry-badge--type {
  background-color: color-mix(in srgb, var(--accent-purple) 10%, transparent);
  color: var(--accent-purple);
  border: 1px solid color-mix(in srgb, var(--accent-purple) 25%, transparent);
}

.entry-date {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: auto;
}
</style>
