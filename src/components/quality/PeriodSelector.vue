<template>
  <div class="period-selector">
    <div class="kind-toggle" role="tablist" :aria-label="t('view.periodLabel')">
      <button
        type="button"
        role="tab"
        :aria-selected="phaseKind === 'sprint'"
        :class="{ active: phaseKind === 'sprint' }"
        @click="setPhaseKind('sprint')"
      >{{ t('view.phaseSprint') }}</button>
      <button
        type="button"
        role="tab"
        :aria-selected="phaseKind === 'calendar'"
        :class="{ active: phaseKind === 'calendar' }"
        @click="setPhaseKind('calendar')"
      >{{ t('view.phaseCalendar') }}</button>
    </div>

    <label class="filter-item">
      <span class="filter-label">{{ t('view.periodLabel') }}</span>
      <select :value="presetKey" @change="onPreset">
        <template v-if="phaseKind === 'sprint'">
          <option value="current">{{ t('view.presetCurrentSprint') }}</option>
          <option value="last">{{ t('view.presetLastSprint') }}</option>
          <option value="currentPI">{{ t('view.presetCurrentPI') }}</option>
        </template>
        <template v-else>
          <option value="last7">{{ t('view.presetLast7') }}</option>
          <option value="last30">{{ t('view.presetLast30') }}</option>
          <option value="custom">{{ t('view.presetCustom') }}</option>
        </template>
      </select>
    </label>

    <template v-if="phaseKind === 'calendar' && presetKey === 'custom'">
      <label class="filter-item">
        <span class="filter-label">{{ t('view.from') }}</span>
        <input type="date" :value="customFrom" @change="onCustom" data-edge="from" />
      </label>
      <label class="filter-item">
        <span class="filter-label">{{ t('view.to') }}</span>
        <input type="date" :value="customTo" @change="onCustom" data-edge="to" />
      </label>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'
import {
  phaseKind, presetKey, customFrom, customTo,
  setPhaseKind, setPreset, setCustomRange,
  type PresetKey,
} from '@/composables/useTimingPhase'

const { t } = useI18n()

function onPreset(e: Event) {
  setPreset((e.target as HTMLSelectElement).value as PresetKey)
}
function onCustom(e: Event) {
  const el = e.target as HTMLInputElement
  const from = el.dataset.edge === 'from' ? el.value : customFrom.value
  const to = el.dataset.edge === 'to' ? el.value : customTo.value
  setCustomRange(from, to)
}
</script>

<style scoped>
.period-selector {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3);
}
.kind-toggle {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
  align-self: flex-end;
}
.kind-toggle button {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  color: var(--text-muted);
  border: none;
  cursor: pointer;
  font-size: var(--font-sm);
}
.kind-toggle button.active {
  background: var(--accent-blue);
  color: white;
}
.filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
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
</style>
