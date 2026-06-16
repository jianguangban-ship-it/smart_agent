<template>
  <section class="quality-panel" :aria-label="t('view.title')">
    <!-- v10.136: panel-header (title + subtitle) removed per UX request.
         The section still carries an aria-label using view.title so screen
         readers continue to announce the panel; the visible title block is
         gone. The PERIOD QUALITY summary row is now the first thing inside
         the panel, sitting directly under the app header. -->
    <!-- v10.189: the Mission Quality bar describes the FILTERED set, same as
         the trend and the list; only the "showing X of Y" count label keeps
         the whole-period reference (totalCount). -->
    <QualitySummaryBar
      :summary="filteredSummary"
      :filtered-count="filteredTickets.length"
      :total-count="tickets.length"
      :loading="loading"
      :last-fetched="lastFetched"
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

    <!-- v10.190: the trend board is a two-page tab strip — the stacked-bar
         matrix and the Quality Trend Modelling chart share one header and one
         collapse (the v10.186 0fr→1fr wrapper moved up here from TrendMatrix).
         Both pages read the FILTERED set (v10.189 semantics). -->
    <div class="trend-wrap" v-if="filteredSummary.total > 0">
      <div class="trend-head">
        <div class="trend-tabs" role="tablist" :aria-label="t('view.trendTitle')">
          <button
            type="button"
            role="tab"
            class="trend-tab"
            :class="{ 'trend-tab--active': trendView === 'matrix' }"
            :aria-selected="trendView === 'matrix' ? 'true' : 'false'"
            @click="setTrendView('matrix')"
          >{{ t('view.trendTitle') }}</button>
          <span class="trend-tab-sep" aria-hidden="true">/</span>
          <button
            type="button"
            role="tab"
            class="trend-tab trend-tab--model"
            :class="{ 'trend-tab--active': trendView === 'model' }"
            :aria-selected="trendView === 'model' ? 'true' : 'false'"
            @click="setTrendView('model')"
          >{{ t('view.modelTitle') }}</button>
        </div>
        <button
          type="button"
          class="collapse-btn"
          :aria-expanded="trendOpen ? 'true' : 'false'"
          :aria-label="t('view.toggleTrend')"
          @click="trendOpen = !trendOpen"
        >
          {{ trendOpen ? '−' : '+' }}
        </button>
      </div>
      <div class="trend-collapse" :class="{ 'is-open': trendOpen }" :inert="!trendOpen">
        <div class="trend-collapse-inner">
          <TrendMatrix v-if="trendView === 'matrix'" :summary="filteredSummary" />
          <QualityTrendModelling v-else :tickets="filteredTickets" :buckets="buckets" />
        </div>
      </div>
    </div>

    <div class="table-wrap">
      <!-- v10.183: full-screen error only when there is nothing to show.
           A failed refetch over already-loaded rows keeps the stale grid
           visible (stale-while-revalidate) and surfaces a slim notice bar
           instead of wiping the screen. -->
      <div v-if="error && tickets.length === 0" class="state-error">
        {{ t('view.fetchError') }} — {{ error }}
      </div>

      <div v-else-if="!loading && tickets.length === 0" class="state-empty">
        <div class="empty-title">{{ t('view.empty') }}</div>
        <div class="empty-hint">{{ t('view.emptyHint') }}</div>
      </div>

      <div v-else-if="!loading && filteredTickets.length === 0" class="state-empty">
        <div class="empty-title">{{ t('view.empty') }}</div>
      </div>

      <template v-else>
      <div v-if="error" class="stale-error" role="alert">
        <span>{{ t('view.fetchError') }} — {{ error }}</span>
        <button class="stale-retry" @click="refresh">{{ t('view.retry') }}</button>
      </div>

      <div
        ref="gridEl"
        class="grid"
        :class="{ 'grid--refreshing': isRefreshing }"
        role="table"
        :aria-rowcount="filteredTickets.length + 1"
        :aria-busy="initialLoading ? 'true' : undefined"
        @keydown="onKeydown"
      >
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

        <!-- v10.184: initial fetch shows shimmer placeholders under the real
             sticky header instead of a blank body; swaps to the scroller the
             moment data lands. Refetches never come through here — they keep
             the stale rows (see grid--refreshing). -->
        <div v-if="initialLoading" class="grid-body" :aria-label="t('view.loading')">
          <QualityRowSkeleton v-for="i in 8" :key="i" />
        </div>

        <!-- v10.135: virtualized body. DynamicScroller only mounts the rows
             whose computed scroll position is inside the viewport + buffer,
             keeping DOM mount count constant regardless of dataset size. -->
        <DynamicScroller
          v-else
          ref="scrollerRef"
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
      </template>
    </div>

    <AgentCheckModal :ticket="selectedTicket" @close="selectedTicket = null" />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from '@/i18n'
import { useQualityGrid, setGridActive } from '@/composables/useQualityGrid'
import { useGridKeyboardNav } from '@/composables/useGridKeyboardNav'
import { buckets } from '@/composables/useTimingPhase'
import QualityRow from './QualityRow.vue'
import QualityRowSkeleton from './QualityRowSkeleton.vue'
import AgentCheckModal from './AgentCheckModal.vue'
import PeriodSelector from './PeriodSelector.vue'
import QualitySummaryBar from './QualitySummaryBar.vue'
import TrendMatrix from './TrendMatrix.vue'
import QualityTrendModelling from './QualityTrendModelling.vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import type { QualityTicket } from '@/types/quality'

const { t } = useI18n()

// v10.194: the panel stays mounted across mode switches (v-show in App.vue);
// `active` says whether View is the visible mode. Gates the composable's
// auto-refresh and triggers a stale-refetch when the user returns.
const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true })
watch(() => props.active, v => setGridActive(v), { immediate: true })

const {
  tickets,
  filteredTickets,
  teamOptions,
  filteredSummary,
  loading,
  isRefreshing,
  lastFetched,
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

// v10.190: trend board page — matrix (per-team trend) or model (Quality
// Trend Modelling). Read in setup (not module scope) so each mount sees the
// stubbed localStorage in tests; persistence failures are non-fatal.
type TrendView = 'matrix' | 'model'
const TREND_TAB_KEY = 'view-trend-tab'
function loadTrendView(): TrendView {
  try {
    return localStorage.getItem(TREND_TAB_KEY) === 'model' ? 'model' : 'matrix'
  } catch {
    return 'matrix'
  }
}
const trendView = ref<TrendView>(loadTrendView())
function setTrendView(v: TrendView) {
  trendView.value = v
}
watch(trendView, v => {
  try { localStorage.setItem(TREND_TAB_KEY, v) } catch { /* private mode — no persistence */ }
})
const trendOpen = ref(true)

// v10.185: ArrowUp/Down roving focus through the virtualized rows, Enter
// opens the detail modal. One delegated listener on .grid — rows are
// recycled DOM, so per-row listeners would go stale.
const gridEl = ref<HTMLElement | null>(null)
// Minimal structural type for the DynamicScroller template ref — its full
// type is a generic function component, which InstanceType can't unwrap.
const scrollerRef = ref<{ scrollToItem: (index: number) => void } | null>(null)
const { onKeydown } = useGridKeyboardNav<QualityTicket>({
  items: filteredTickets,
  scroller: scrollerRef,
  container: gridEl,
  onActivate: openTicket,
})

// First fetch with nothing on screen yet — the only state that shows
// skeleton rows. Subsequent fetches keep stale rows (isRefreshing).
const initialLoading = computed(() => loading.value && tickets.value.length === 0)
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

/* v10.190: trend-board header + collapse, migrated from TrendMatrix.vue so
   both pages (matrix / modelling) share them. */
.trend-wrap {
  padding: 0 var(--space-5) var(--space-3);
}
.trend-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 0;
}
.trend-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.trend-tab {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  font-size: var(--font-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}
.trend-tab--active {
  color: var(--text-primary);
  text-decoration: underline;
  text-underline-offset: 4px;
}
/* Per the design snapshot: the modelling page name is red in both states. */
.trend-tab--model {
  color: var(--accent-red);
}
.trend-tab--model.trend-tab--active {
  color: var(--accent-red);
}
.trend-tab-sep {
  color: var(--text-muted);
  font-weight: 700;
}
.collapse-btn {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  line-height: 1;
}
.trend-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease;
}
.trend-collapse.is-open {
  grid-template-rows: 1fr;
}
.trend-collapse-inner {
  overflow: hidden;
  min-height: 0;
}
@media (prefers-reduced-motion: reduce) {
  .trend-collapse {
    transition: none;
  }
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
  /* v10.193: a real floor (not 0) — if the viewport ever measures 0/unbounded,
     vue-virtual-scroller "renders all items at once", which at production row
     counts (1000+) used to throw and freeze the app. The flex-shrink override
     is preserved; the floor guarantees a measurable, scrollable viewport. */
  min-height: 240px;
  overflow-y: auto;
}
/* v10.183: stale-while-revalidate — during a refetch the old rows stay on
   screen and only the body dims; the sticky header stays crisp and the list
   remains scrollable. */
.grid--refreshing .grid-body {
  opacity: 0.65;
  transition: opacity 0.2s ease;
}

.stale-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-2);
  border: 1px solid var(--accent-red);
  border-radius: var(--radius-sm);
  background-color: rgba(248, 81, 73, 0.08);
  color: var(--accent-red);
  font-size: var(--font-sm);
}
.stale-retry {
  flex-shrink: 0;
  padding: 2px var(--space-3);
  border: 1px solid var(--accent-red);
  border-radius: var(--radius-sm);
  background: none;
  color: var(--accent-red);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: background-color 0.15s;
}
.stale-retry:hover {
  background-color: rgba(248, 81, 73, 0.15);
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
