<template>
  <section class="quality-panel" :aria-label="t('view.title')">
    <header class="panel-header">
      <div class="panel-title">
        <h2>{{ t('view.title') }}</h2>
        <p class="panel-subtitle">{{ t('view.subtitle') }}</p>
      </div>
      <div class="panel-actions">
        <span class="count-label">
          {{ tickets.length === filteredTickets.length
              ? t('view.countLabel').replace('{n}', String(tickets.length))
              : t('view.countFiltered')
                  .replace('{filtered}', String(filteredTickets.length))
                  .replace('{total}', String(tickets.length)) }}
        </span>
        <button class="btn" :disabled="loading" @click="refresh">
          <span v-if="loading">{{ t('view.refreshing') }}</span>
          <span v-else>{{ t('view.refresh') }}</span>
        </button>
      </div>
    </header>

    <QualitySummaryBar :summary="summary" />

    <div class="filter-bar">
      <PeriodSelector />

      <label class="filter-item">
        <span class="filter-label">{{ t('view.filterTeam') }}</span>
        <select v-model="filterTeam">
          <option value="">{{ t('view.allTeams') }}</option>
          <option v-for="opt in teamOptions" :key="opt.key" :value="opt.key">
            {{ opt.key }} — {{ opt.name }}
          </option>
        </select>
      </label>

      <label class="filter-item">
        <span class="filter-label">{{ t('view.filterStatus') }}</span>
        <select v-model="filterStatus">
          <option value="">{{ t('view.allStatuses') }}</option>
          <option value="A">A — {{ t('view.statusA') }}</option>
          <option value="B">B — {{ t('view.statusB') }}</option>
          <option value="C">C — {{ t('view.statusC') }}</option>
          <option value="D">D — {{ t('view.statusD') }}</option>
          <option value="格式异常">格式异常 — {{ t('view.statusFormatError') }}</option>
          <option value="未知">未知 — {{ t('view.statusUnknown') }}</option>
        </select>
      </label>

      <label class="filter-item filter-search">
        <input
          type="search"
          v-model="searchText"
          :placeholder="t('view.search')"
          autocomplete="off"
        />
      </label>
    </div>

    <TrendMatrix :summary="summary" />

    <div class="table-wrap">
      <div v-if="error" class="state-error">
        {{ t('view.fetchError') }} — {{ error }}
      </div>

      <div v-else-if="!loading && tickets.length === 0" class="state-empty">
        <div class="empty-title">{{ t('view.empty') }}</div>
        <div class="empty-hint">{{ t('view.emptyHint') }}</div>
      </div>

      <div v-else-if="!loading && filteredTickets.length === 0" class="state-empty">
        <div class="empty-title">{{ t('view.empty') }}</div>
      </div>

      <table v-else class="grid-table">
        <thead>
          <tr>
            <th>{{ t('view.colStatus') }}</th>
            <th>{{ t('view.colTeam') }}</th>
            <th>{{ t('view.colKey') }}</th>
            <th>{{ t('view.colType') }}</th>
            <th>{{ t('view.colSummary') }}</th>
            <th>{{ t('view.colAssignee') }}</th>
            <th>{{ t('view.colPoints') }}</th>
            <th>{{ t('view.colTime') }}</th>
          </tr>
        </thead>
        <tbody>
          <QualityRow
            v-for="t in filteredTickets"
            :key="t.issueKey"
            :ticket="t"
            @expand="openTicket"
          />
        </tbody>
      </table>
    </div>

    <AgentCheckModal :ticket="selectedTicket" @close="selectedTicket = null" />
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '@/i18n'
import { useQualityGrid } from '@/composables/useQualityGrid'
import QualityRow from './QualityRow.vue'
import AgentCheckModal from './AgentCheckModal.vue'
import PeriodSelector from './PeriodSelector.vue'
import QualitySummaryBar from './QualitySummaryBar.vue'
import TrendMatrix from './TrendMatrix.vue'
import type { QualityTicket } from '@/types/quality'

const { t } = useI18n()

const {
  tickets,
  filteredTickets,
  teamOptions,
  summary,
  loading,
  error,
  filterTeam,
  filterStatus,
  searchText,
  refresh
} = useQualityGrid()

const selectedTicket = ref<QualityTicket | null>(null)
function openTicket(ticket: QualityTicket) {
  selectedTicket.value = ticket
}
</script>

<style scoped>
.quality-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
  min-height: calc(100vh - 200px);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);
}
.panel-title h2 {
  margin: 0;
  font-size: var(--font-xl);
  font-weight: 600;
  color: var(--text-primary);
}
.panel-subtitle {
  margin: var(--space-1) 0 0;
  font-size: var(--font-sm);
  color: var(--text-muted);
}
.panel-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.count-label {
  font-size: var(--font-sm);
  color: var(--text-muted);
}
.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background-color: var(--accent-blue);
  color: white;
  font-size: var(--font-base);
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn:hover:not(:disabled) { opacity: 0.9; }
.btn:disabled { opacity: 0.5; cursor: wait; }

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: 0 var(--space-5);
}
.filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
}
.filter-search {
  flex: 1;
  min-width: 240px;
  justify-content: flex-end;
}
.filter-label {
  font-size: var(--font-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}
.filter-item select,
.filter-item input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background-color: var(--bg-primary, var(--bg-secondary));
  color: var(--text-primary);
  font-size: var(--font-base);
}
.filter-item input:focus,
.filter-item select:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.25);
}

.table-wrap {
  flex: 1;
  overflow: auto;
  padding: 0 var(--space-5) var(--space-5);
}
.grid-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.grid-table thead th {
  position: sticky;
  top: 0;
  background-color: var(--bg-tertiary);
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 2px solid var(--border-color);
  font-size: var(--font-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  z-index: 1;
}

.state-error,
.state-empty {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-muted);
}
.state-error {
  color: var(--accent-red);
}
.empty-title {
  font-size: var(--font-lg);
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}
.empty-hint {
  font-size: var(--font-sm);
  color: var(--text-muted);
}
</style>
