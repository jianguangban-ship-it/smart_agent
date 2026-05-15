<template>
  <tr class="row" @click="$emit('expand', ticket)" tabindex="0" @keydown.enter="$emit('expand', ticket)">
    <td class="cell-status"><StatusBadge :status="ticket.status" /></td>
    <td class="cell-team">
      <span class="team-key">{{ ticket.team_key }}</span>
      <span class="team-name">{{ ticket.team }}</span>
    </td>
    <td class="cell-key">
      <a
        :href="`https://jira.gwm.cn/browse/${ticket.issueKey}`"
        target="_blank"
        rel="noopener"
        @click.stop
      >{{ ticket.issueKey }}</a>
    </td>
    <td class="cell-type">{{ ticket.issueType }}</td>
    <td class="cell-summary" :title="ticket.summary">{{ ticket.summary }}</td>
    <td class="cell-assignee">{{ ticket.displayName }}</td>
    <td class="cell-points">{{ ticket.points }}</td>
    <td class="cell-time">{{ formatTime(ticket.timestamp) }}</td>
  </tr>
</template>

<script setup lang="ts">
import StatusBadge from './StatusBadge.vue'
import { formatTime } from '@/utils/formatTime'
import type { QualityTicket } from '@/types/quality'

defineProps<{ ticket: QualityTicket }>()
defineEmits<{ expand: [ticket: QualityTicket] }>()
</script>

<style scoped>
.row {
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
td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-color);
  font-size: var(--font-base);
  color: var(--text-primary);
  vertical-align: middle;
}
.cell-status { width: 60px; }
.cell-team {
  width: 160px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.team-key {
  font-weight: 600;
  font-size: var(--font-sm);
  color: var(--text-primary);
}
.team-name {
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.cell-key {
  width: 110px;
  font-family: var(--font-mono, monospace);
}
.cell-key a {
  color: var(--accent-blue);
  text-decoration: none;
  font-weight: 500;
}
.cell-key a:hover { text-decoration: underline; }
.cell-type {
  width: 70px;
  color: var(--text-secondary);
  font-size: var(--font-sm);
}
.cell-summary {
  max-width: 0; /* with table-layout: fixed this lets text-overflow work */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}
.cell-assignee {
  width: 150px;
  color: var(--text-secondary);
  font-size: var(--font-sm);
}
.cell-points {
  width: 50px;
  text-align: center;
  font-weight: 600;
  color: var(--text-primary);
}
.cell-time {
  width: 150px;
  color: var(--text-muted);
  font-size: var(--font-sm);
  white-space: nowrap;
}
</style>
