<template>
  <div class="trend-wrap" v-if="summary.total > 0">
    <div class="trend-head">
      <span class="trend-title">{{ t('view.trendTitle') }}</span>
      <button type="button" class="collapse-btn" @click="open = !open">
        {{ open ? '−' : '+' }}
      </button>
    </div>
    <div v-if="open" class="trend-scroll">
      <table class="trend-table">
        <thead>
          <tr>
            <th class="team-col">{{ t('view.colTeam') }}</th>
            <th v-for="b in summary.bucketLabels" :key="b">{{ b }}</th>
            <th class="total-col">Σ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.team_key" :class="{ 'all-row': row.team_key === '*' }">
            <td class="team-col" :title="row.team">
              {{ row.team_key === '*' ? t('view.allTeamsRow') : row.team_key }}
            </td>
            <td v-for="(cell, i) in row.cells" :key="i">
              <div class="bar" :title="tooltip(cell)" :aria-label="tooltip(cell)">
                <template v-if="cell.total > 0">
                  <span
                    v-for="seg in segments(cell)"
                    :key="seg.status"
                    class="seg"
                    :style="{ width: seg.pct + '%', backgroundColor: seg.color }"
                  ></span>
                </template>
                <span v-else class="bar-empty">·</span>
              </div>
              <div class="bar-n">{{ cell.total || '' }}</div>
            </td>
            <td class="total-col">{{ row.total }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from '@/i18n'
import { colorForStatus } from '@/types/quality'
import type { PeriodSummary, MatrixRow, MatrixCell, StatusCounts } from '@/composables/useQualityGrid'

const props = defineProps<{ summary: PeriodSummary }>()
const { t } = useI18n()
const open = ref(true)

const CANONICAL = ['A', 'B', 'C', 'D', '格式异常', '未知']

function statusesOf(counts: StatusCounts): string[] {
  const present = Object.keys(counts)
  const canon = CANONICAL.filter(s => present.includes(s))
  const drift = present.filter(s => !CANONICAL.includes(s)).sort()
  return [...canon, ...drift]
}

function segments(cell: MatrixCell) {
  return statusesOf(cell.counts).map(status => ({
    status,
    color: colorForStatus(status),
    pct: (cell.counts[status] / cell.total) * 100,
  }))
}

function tooltip(cell: MatrixCell): string {
  if (cell.total === 0) return '0'
  return statusesOf(cell.counts).map(s => `${s}:${cell.counts[s]}`).join('  ')
}

// Synthetic "all teams" row: per-bucket sum across every team row.
const allRow = computed<MatrixRow>(() => {
  const labels = props.summary.bucketLabels
  const cells: MatrixCell[] = labels.map(label => ({ bucketLabel: label, counts: {}, total: 0 }))
  let total = 0
  for (const row of props.summary.matrix) {
    row.cells.forEach((c, i) => {
      const dst = cells[i]
      for (const [s, n] of Object.entries(c.counts)) {
        dst.counts[s] = (dst.counts[s] ?? 0) + n
      }
      dst.total += c.total
    })
    total += row.total
  }
  return { team_key: '*', team: 'all', cells, total }
})

const rows = computed<MatrixRow[]>(() => [...props.summary.matrix, allRow.value])
</script>

<style scoped>
.trend-wrap {
  padding: 0 var(--space-5) var(--space-3);
}
.trend-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 0;
}
.trend-title {
  font-size: var(--font-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
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
.trend-scroll {
  overflow-x: auto;
}
.trend-table {
  border-collapse: collapse;
  width: 100%;
  font-size: var(--font-xs);
}
.trend-table th,
.trend-table td {
  padding: var(--space-1) var(--space-2);
  border-bottom: 1px solid var(--border-color);
  text-align: center;
  white-space: nowrap;
}
.trend-table th {
  color: var(--text-muted);
  font-weight: 700;
}
.team-col {
  text-align: left;
  font-weight: 600;
  color: var(--text-primary);
  position: sticky;
  left: 0;
  background: var(--bg-secondary);
}
.total-col {
  font-weight: 700;
  color: var(--text-primary);
}
.all-row td {
  border-top: 2px solid var(--border-color);
  font-weight: 700;
}
.bar {
  display: flex;
  height: 10px;
  min-width: 48px;
  border-radius: 2px;
  overflow: hidden;
  background: var(--bg-tertiary);
}
.seg {
  height: 100%;
}
.bar-empty {
  color: var(--text-muted);
  width: 100%;
  text-align: center;
  line-height: 10px;
}
.bar-n {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
