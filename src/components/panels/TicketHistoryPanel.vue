<template>
  <div class="history-panel">
    <details>
      <summary class="history-summary">
        <span class="summary-title">🎫 {{ t('history.title') }}</span>
        <button
          v-if="ticketHistory.length > 0"
          class="clear-btn"
          @click.prevent="clearHistory"
          :title="t('history.clear')"
          :aria-label="t('history.clear')"
        >
          {{ t('history.clear') }}
        </button>
      </summary>

      <div class="history-content">
        <div v-if="ticketHistory.length === 0" class="empty-state">
          {{ t('history.empty') }}
        </div>
        <div v-else class="entry-list">
          <div v-for="entry in ticketHistory" :key="entry.key + entry.date" class="entry-row">
            <a
              class="entry-key"
              :href="'https://jira.gwm.cn/browse/' + entry.key"
              target="_blank"
              rel="noopener noreferrer"
            >{{ entry.key }}</a>
            <span class="entry-summary">{{ truncate(entry.summary, 40) }}</span>
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

const { t } = useI18n()

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  background-color: rgba(88, 166, 255, 0.1);
  color: var(--accent-blue);
  border: 1px solid rgba(88, 166, 255, 0.2);
}

.entry-date {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: auto;
}
</style>
