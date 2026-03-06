<template>
  <!-- Primitive value -->
  <span v-if="!isExpandable" class="jv-primitive">
    <span :class="valueClass">{{ displayValue }}</span>
  </span>

  <!-- Object / Array -->
  <span v-else class="jv-node">
    <span class="jv-toggle" :class="{ 'jv-open': isOpen }" @click="isOpen = !isOpen">
      <svg class="jv-caret" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l8 7-8 7z"/></svg>
    </span>
    <span class="jv-bracket" @click="isOpen = !isOpen">{{ openBracket }}</span>
    <!-- Collapsed preview -->
    <template v-if="!isOpen">
      <span class="jv-preview" @click="isOpen = true">{{ collapsedPreview }}</span>
      <span class="jv-bracket">{{ closeBracket }}</span>
    </template>
    <!-- Expanded children -->
    <template v-if="isOpen">
      <div class="jv-children">
        <div v-for="(entry, idx) in entries" :key="entry.key" class="jv-row">
          <span class="jv-indent" />
          <span v-if="isObject" class="jv-key">{{ entry.key }}</span>
          <span v-if="isObject" class="jv-colon">: </span>
          <span v-if="!isObject" class="jv-index">{{ entry.key }}</span>
          <JsonNode
            :value="entry.val"
            :depth="depth + 1"
            :expand-depth="expandDepth"
            :generation="generation"
          />
          <span v-if="idx < entries.length - 1" class="jv-comma">,</span>
        </div>
      </div>
      <span class="jv-bracket jv-close-bracket">{{ closeBracket }}</span>
    </template>
    <span class="jv-meta">{{ meta }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  value: unknown
  depth: number
  expandDepth: number
  generation: number
}>()

const isObject = computed(() => props.value !== null && typeof props.value === 'object' && !Array.isArray(props.value))
const isArray = computed(() => Array.isArray(props.value))
const isExpandable = computed(() => isObject.value || isArray.value)

const isOpen = ref(props.depth < props.expandDepth)

// React to expand/collapse all
watch(() => props.generation, () => {
  isOpen.value = props.depth < props.expandDepth
})

const entries = computed(() => {
  if (isArray.value) {
    return (props.value as unknown[]).map((val, i) => ({ key: String(i), val }))
  }
  if (isObject.value) {
    return Object.entries(props.value as Record<string, unknown>).map(([key, val]) => ({ key, val }))
  }
  return []
})

const openBracket = computed(() => isArray.value ? '[' : '{')
const closeBracket = computed(() => isArray.value ? ']' : '}')

const meta = computed(() => {
  if (isArray.value) {
    const len = (props.value as unknown[]).length
    return `${len} item${len !== 1 ? 's' : ''}`
  }
  if (isObject.value) {
    const len = Object.keys(props.value as object).length
    return `${len} key${len !== 1 ? 's' : ''}`
  }
  return ''
})

const collapsedPreview = computed(() => {
  if (isArray.value) {
    const arr = props.value as unknown[]
    if (arr.length === 0) return ''
    return '...'
  }
  if (isObject.value) {
    const keys = Object.keys(props.value as object)
    if (keys.length === 0) return ''
    return '...'
  }
  return ''
})

const valueClass = computed(() => {
  const v = props.value
  if (v === null || v === undefined) return 'jv-null'
  if (typeof v === 'string') return 'jv-string'
  if (typeof v === 'number') return 'jv-number'
  if (typeof v === 'boolean') return 'jv-boolean'
  return ''
})

const displayValue = computed(() => {
  const v = props.value
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return `"${v}"`
  return String(v)
})
</script>

<style>
/* Unscoped — recursive component needs inherited styles */
.jv-node {
  display: inline;
}
.jv-primitive {
  display: inline;
}
.jv-toggle {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  width: 14px;
  height: 14px;
  vertical-align: middle;
  color: var(--text-muted);
  transition: transform 0.15s;
}
.jv-toggle:hover {
  color: var(--accent-blue);
}
.jv-caret {
  width: 12px;
  height: 12px;
  transition: transform 0.15s;
  transform: rotate(0deg);
}
.jv-open .jv-caret {
  transform: rotate(90deg);
}
.jv-bracket {
  color: var(--text-muted);
  cursor: pointer;
}
.jv-bracket:hover {
  color: var(--text-primary);
}
.jv-close-bracket {
  display: inline;
}
.jv-preview {
  color: var(--text-muted);
  cursor: pointer;
  font-style: italic;
  opacity: 0.6;
  margin: 0 2px;
}
.jv-preview:hover {
  opacity: 1;
}
.jv-meta {
  color: var(--text-muted);
  font-size: 10px;
  margin-left: 6px;
  opacity: 0.5;
  font-style: italic;
}
.jv-children {
  padding-left: 18px;
  border-left: 1px dashed var(--border-color);
  margin-left: 6px;
}
.jv-row {
  display: block;
  line-height: 1.6;
}
.jv-row:hover {
  background-color: rgba(88, 166, 255, 0.04);
  border-radius: 2px;
}
.jv-indent {
  display: inline;
}
.jv-key {
  color: #d2a8ff;
  font-weight: 500;
}
.jv-index {
  color: var(--text-muted);
  font-size: 10px;
  margin-right: 4px;
  opacity: 0.5;
}
.jv-colon {
  color: var(--text-muted);
}
.jv-comma {
  color: var(--text-muted);
}
.jv-string { color: #a5d6ff; }
.jv-number { color: #79c0ff; }
.jv-boolean { color: #ff7b72; }
.jv-null { color: #8b949e; font-style: italic; }
</style>
