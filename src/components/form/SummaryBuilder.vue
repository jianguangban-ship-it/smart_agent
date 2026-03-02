<template>
  <div class="summary-builder">
    <h2 class="section-title">
      {{ t('form.taskSummary') }}
      <span class="section-subtitle">· {{ t('form.fivePartInput') }}</span>
    </h2>
    <div class="fields-grid">
      <div class="field">
        <label class="field-label" for="summary-vehicle">{{ t('form.vehicle') }}</label>
        <select id="summary-vehicle" v-model="summary.vehicle" class="input-base field-select">
          <option value="">{{ t('form.select') }}</option>
          <option v-for="v in VEHICLE_OPTIONS" :key="v" :value="v">{{ v }}</option>
        </select>
      </div>
      <div class="field">
        <label class="field-label" for="summary-product">{{ t('form.product') }}</label>
        <select id="summary-product" v-model="summary.product" class="input-base field-select">
          <option value="">{{ t('form.select') }}</option>
          <option v-for="p in PRODUCT_OPTIONS" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>
      <div class="field">
        <label class="field-label" for="summary-layer">{{ t('form.layer') }}</label>
        <select id="summary-layer" v-model="summary.layer" class="input-base field-select">
          <option value="">{{ t('form.select') }}</option>
          <option v-for="l in LAYER_OPTIONS" :key="l" :value="l">{{ l }}</option>
        </select>
      </div>
      <div class="field">
        <label class="field-label" for="summary-component">{{ t('form.component') }}</label>
        <div class="field-input-wrap">
          <input
            id="summary-component"
            type="text"
            v-model="summary.component"
            list="component-history"
            class="input-base field-input"
            :placeholder="t('form.componentPlaceholder')"
            :maxlength="COMPONENT_MAX"
          />
          <datalist id="component-history">
            <option v-for="c in componentHistory" :key="c" :value="c"></option>
          </datalist>
          <span class="field-counter" :style="{ color: counterColor(summary.component.length, COMPONENT_MAX) }">
            {{ summary.component.length }} / {{ COMPONENT_MAX }}
          </span>
        </div>
      </div>
    </div>
    <div class="detail-field">
      <label class="field-label" for="summary-detail">{{ t('form.taskDetail') }}</label>
      <div class="field-input-wrap">
        <input
          id="summary-detail"
          type="text"
          v-model="summary.detail"
          class="input-base field-input"
          :placeholder="t('form.taskDetailPlaceholder')"
          :maxlength="DETAIL_MAX"
        />
        <span class="field-counter" :style="{ color: counterColor(summary.detail.length, DETAIL_MAX) }">
          {{ summary.detail.length }} / {{ DETAIL_MAX }}
        </span>
      </div>
    </div>
    <QualityMeter
      :label="t('form.livePreview')"
      :score="qualityScore"
      :score-color="qualityScoreColor"
      :quality-label="qualityScoreLabel"
      :preview="computedSummary"
      :placeholder="t('form.previewPlaceholder')"
    >
      <template #header-actions>
        <button
          v-if="computedSummary"
          class="copy-btn"
          @click="copySummary"
          :title="t('toast.copied')"
          :aria-label="t('toast.copied')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="2" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-linecap="round"/>
          </svg>
        </button>
      </template>
    </QualityMeter>
  </div>
</template>

<script setup lang="ts">
import type { SummaryState } from '@/types/form'
import { VEHICLE_OPTIONS, PRODUCT_OPTIONS, LAYER_OPTIONS } from '@/config/constants'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import QualityMeter from './QualityMeter.vue'

const props = defineProps<{
  summary: SummaryState
  componentHistory: string[]
  computedSummary: string
  qualityScore: number
  qualityScoreColor: string
  qualityScoreLabel: string
}>()

const COMPONENT_MAX = 50
const DETAIL_MAX = 100

const { t } = useI18n()
const { addToast } = useToast()

function counterColor(len: number, max: number): string {
  const ratio = len / max
  if (ratio >= 1) return 'var(--accent-red)'
  if (ratio >= 0.8) return 'var(--accent-orange)'
  return ''
}

async function copySummary() {
  if (!props.computedSummary) return
  await navigator.clipboard.writeText(props.computedSummary)
  addToast('success', t('toast.copied'), 2000)
}
</script>

<style scoped>
.summary-builder {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}
.section-title {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.section-subtitle {
  font-weight: 400;
  text-transform: none;
}
.fields-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}
.field-label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.field-select,
.field-input {
  font-size: 12px;
  padding: 8px;
}
.detail-field {
  margin-bottom: 8px;
}
.field-input-wrap {
  position: relative;
}
.field-counter {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  opacity: 0.7;
  text-align: right;
  margin-top: 2px;
  transition: color 0.2s;
}
.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.copy-btn:hover {
  color: var(--accent-green);
  border-color: var(--border-color);
  background-color: var(--bg-secondary);
}
.copy-btn svg {
  width: 13px;
  height: 13px;
}

@media (max-width: 768px) {
  .fields-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
