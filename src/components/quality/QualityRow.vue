<template>
  <!-- v10.185: Enter is handled by the panel's delegated keyboard nav
       (useGridKeyboardNav) instead of per-row — recycled rows would
       double-fire, and Enter on the JIRA link must keep its default. -->
  <div
    class="row"
    role="row"
    tabindex="0"
    @click="$emit('expand', ticket)"
  >
    <div class="cell cell-status" role="cell"><StatusBadge :status="ticket.status" /></div>
    <div class="cell cell-team" role="cell">
      <span class="team-key">{{ ticket.team_key }}</span>
      <span class="team-name">{{ ticket.team }}</span>
    </div>
    <div class="cell cell-key" role="cell">
      <a
        :href="`https://jira.gwm.cn/browse/${ticket.issueKey}`"
        target="_blank"
        rel="noopener"
        @click.stop
      >{{ ticket.issueKey }}</a>
    </div>
    <div class="cell cell-type" role="cell">{{ ticket.issueType }}</div>
    <div class="cell cell-summary" role="cell" :title="ticket.summary">{{ ticket.summary }}</div>
    <div class="cell cell-assignee" role="cell">{{ ticket.displayName }}</div>
    <div class="cell cell-points" role="cell">{{ ticket.points }}</div>
    <div class="cell cell-time" role="cell">{{ formatTime(ticket.timestamp) }}</div>
  </div>
</template>

<script setup lang="ts">
import StatusBadge from './StatusBadge.vue'
import { formatTime } from '@/utils/formatTime'
import type { QualityTicket } from '@/types/quality'

defineProps<{ ticket: QualityTicket }>()
defineEmits<{ expand: [ticket: QualityTicket] }>()
</script>

<style scoped>
/* v10.135: switched root from <tr><td> to <div role="row"><div role="cell">
   so the body can be virtualized by vue-virtual-scroller. Browser
   table-layout doesn't play well with virtual scrolling — the rows need to
   be free-floating positioned elements, which contradicts <tbody>. The
   ARIA roles preserve semantic intent for screen readers; the visual layout
   is reproduced exactly via CSS grid with column tracks that mirror the
   sticky <thead><th> widths declared in QualityGridPanel.vue. */
.row {
  display: grid;
  grid-template-columns: 200px 200px 200px 200px 1fr 200px 200px 200px;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.12s ease;
}
.row:hover {
  background-color: var(--bg-tertiary);
}
.row:focus {
  outline: 2px solid var(--accent-blue);
  outline-offset: -2px;
}
.cell {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-base);
  color: var(--text-primary);
  min-width: 0; /* allow children to text-overflow inside grid tracks */
}
/* All cells centered by default except Summary, which stays left-aligned
   because long ticket titles read better that way (and matches the sticky
   header's .col-summary exemption). */
.cell-status,
.cell-team,
.cell-key,
.cell-type,
.cell-assignee,
.cell-points,
.cell-time {
  text-align: center;
}

.team-key,
.team-name {
  display: block;
}
.team-key {
  font-weight: 600;
  font-size: var(--font-sm);
  color: var(--text-primary);
}
.team-name {
  margin-top: 2px;
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.cell-key {
  font-family: var(--font-mono, monospace);
}
.cell-key a {
  color: var(--accent-blue);
  text-decoration: none;
  font-weight: 500;
}
.cell-key a:hover { text-decoration: underline; }

.cell-type {
  color: var(--text-secondary);
  font-size: var(--font-sm);
}

.cell-summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.cell-assignee {
  color: var(--text-secondary);
  font-size: var(--font-sm);
}

.cell-points {
  font-weight: 600;
  color: var(--text-primary);
}

.cell-time {
  color: var(--text-muted);
  font-size: var(--font-sm);
  white-space: nowrap;
}
</style>
