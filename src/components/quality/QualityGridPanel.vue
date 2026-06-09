<template>
  <section class="quality-panel" :aria-label="t('view.title')">
    <!-- v10.136: panel-header (title + subtitle) removed per UX request.
         The section still carries an aria-label using view.title so screen
         readers continue to announce the panel; the visible title block is
         gone. The PERIOD QUALITY summary row is now the first thing inside
         the panel, sitting directly under the app header. -->
    <QualitySummaryBar
      :summary="summary"
      :filtered-count="filteredTickets.length"
      :total-count="tickets.length"
      :loading="loading"
      @refresh="refresh"
    />

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

      <div v-else class="grid" role="table" :aria-rowcount="filteredTickets.length + 1">
        <!-- Sticky header row — kept as a real grid row above the virtualized
             body so its layout matches the row template byte-for-byte. -->
        <div class="grid-header" role="row">
          <div class="grid-th" role="columnheader">{{ t('view.colStatus') }}</div>
          <div class="grid-th" role="columnheader">{{ t('view.colTeam') }}</div>
          <div class="grid-th" role="columnheader">{{ t('view.colKey') }}</div>
          <div class="grid-th" role="columnheader">{{ t('view.colType') }}</div>
          <div class="grid-th grid-th--summary" role="columnheader">{{ t('view.colSummary') }}</div>
          <div class="grid-th" role="columnheader">{{ t('view.colAssignee') }}</div>
          <div class="grid-th" role="columnheader">{{ t('view.colPoints') }}</div>
          <div class="grid-th" role="columnheader">{{ t('view.colTime') }}</div>
        </div>

        <!-- v10.135: virtualized body. DynamicScroller only mounts the rows
             whose computed scroll position is inside the viewport + buffer,
             keeping DOM mount count constant regardless of dataset size. -->
        <DynamicScroller
          class="grid-body"
          :items="filteredTickets"
          :min-item-size="42"
          key-field="issueKey"
        >
          <template #default="{ item, index, active }">
            <DynamicScrollerItem
              :item="item"
              :active="active"
              :data-index="index"
              :size-dependencies="[item.summary]"
            >
              <QualityRow :ticket="item" @expand="openTicket" />
            </DynamicScrollerItem>
          </template>
        </DynamicScroller>
      </div>
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
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
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

/* v10.136: .panel-header / .panel-title / .panel-subtitle CSS removed
   along with the markup. The section now opens directly with the
   QualitySummaryBar row. */

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
  display: flex;
  flex-direction: column;
  overflow: hidden;          /* DynamicScroller owns its own scrollbar */
  padding: 0 var(--space-5) var(--space-5);
  min-height: 0;             /* let the inner DynamicScroller flex to fill */
}
/* v10.135: switched from <table>/<tbody> to a div-based grid so the body
   can be virtualized. The header is a single grid row above the
   DynamicScroller; both share the same `grid-template-columns` track so
   they line up visually. */
.grid {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.grid-header {
  display: grid;
  grid-template-columns: 200px 200px 200px 200px 1fr 200px 200px 200px;
  background-color: var(--bg-tertiary);
  border-bottom: 2px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 1;
}
.grid-th {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  text-align: center;
}
.grid-th--summary {
  text-align: left;
}
.grid-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
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
