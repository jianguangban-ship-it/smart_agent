<template>
  <div class="history-panel">
    <details :open="!!lastCreatedKey || isCreating">
      <summary class="history-summary">
        <span class="summary-title">{{ ICONS.ticketHistory }} {{ t('history.title') }}</span>
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
            <div class="entry-meta">
              <span class="entry-badge">{{ entry.project }}</span>
              <span class="entry-badge">{{ entry.issueType }}</span>
              <span class="entry-date">{{ relativeDate(entry.date) }}</span>
            </div>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'
import { ticketHistory, clearHistory } from '@/composables/useTicketHistory'
import { ICONS } from '@/config/icons'

defineProps<{
  lastCreatedKey?: string
  isCreating?: boolean
}>()

const { t } = useI18n()

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
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
.summary-title { flex: 1; }

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
  grid-template-columns: auto 1fr;
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
}
.entry-key:hover {
  text-decoration: underline;
}

.entry-summary {
  font-size: 11px;
  color: var(--text-primary);
  grid-row: 1;
  grid-column: 2;
  word-break: break-word;
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
  background-color: var(--blue-wash);
  color: var(--accent-blue);
  border: 1px solid var(--blue-subtle);
}

.entry-date {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: auto;
}
</style>
