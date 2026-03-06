<template>
  <div class="json-viewer">
    <div class="jv-toolbar" v-if="copyable">
      <button class="jv-copy-btn" @click="copyJson" :title="t('toast.copied')">
        <svg class="jv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      </button>
      <button class="jv-action-btn" @click="expandAll" :title="t('dev.expandAll')">
        <svg class="jv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <button class="jv-action-btn" @click="collapseAll" :title="t('dev.collapseAll')">
        <svg class="jv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>
    </div>
    <div class="jv-root">
      <JsonNode :value="parsed" :depth="0" :expand-depth="expandDepth" :generation="generation" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import JsonNode from './JsonNode.vue'

const props = withDefaults(defineProps<{
  data: unknown
  copyable?: boolean
}>(), {
  copyable: true
})

const { t } = useI18n()
const { addToast } = useToast()

const expandDepth = ref(2)
const generation = ref(0)

const parsed = computed(() => {
  if (!props.data) return props.data
  if (typeof props.data === 'string') {
    try { return JSON.parse(props.data) } catch { return props.data }
  }
  return props.data
})

function expandAll() {
  expandDepth.value = 999
  generation.value++
}

function collapseAll() {
  expandDepth.value = 0
  generation.value++
}

function copyJson() {
  const text = typeof props.data === 'string' ? props.data : JSON.stringify(props.data, null, 2)
  navigator.clipboard.writeText(text).then(() => {
    addToast('success', t('toast.copied'))
  })
}
</script>

<style scoped>
.json-viewer {
  position: relative;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.6;
}
.jv-toolbar {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 1;
  display: flex;
  gap: 2px;
}
.jv-copy-btn,
.jv-action-btn {
  padding: 3px;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.jv-copy-btn:hover,
.jv-action-btn:hover {
  color: var(--accent-blue);
  border-color: var(--accent-blue);
}
.jv-icon {
  width: 13px;
  height: 13px;
}
.jv-root {
  overflow-x: auto;
}
</style>
