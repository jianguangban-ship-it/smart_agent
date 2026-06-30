<template>
  <div class="combobox" ref="containerRef">
    <input
      ref="inputRef"
      type="text"
      v-model="searchTerm"
      @focus="open"
      @input="onInput"
      @keydown="handleKeydown"
      class="combobox-input"
      :class="{ 'has-selection': modelValue && !searchTerm }"
      :placeholder="modelValue || placeholder"
      role="combobox"
      :aria-expanded="isOpen"
      aria-autocomplete="list"
      aria-controls="code-listbox"
    />
    <svg class="combobox-arrow" :class="{ open: isOpen }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
    </svg>

    <Transition name="dropdown">
      <div v-if="isOpen" class="combobox-dropdown" id="code-listbox" role="listbox">
        <div class="combobox-group-header">
          {{ groupLabel }} — {{ filtered.length }} {{ resultsLabel }}
        </div>
        <template v-if="filtered.length > 0">
          <div
            v-for="(opt, index) in filtered"
            :key="opt.code + '-' + index"
            @click="select(opt)"
            @mouseenter="highlightedIndex = index"
            class="combobox-option"
            :class="{ highlighted: highlightedIndex === index, selected: modelValue === opt.code }"
            role="option"
            :aria-selected="modelValue === opt.code"
          >
            <div class="option-info">
              <div class="option-code" v-html="highlightMatch(opt.code, searchTerm)"></div>
              <div class="option-meta">
                <span v-html="highlightMatch(opt.productLine || '—', searchTerm)"></span>
                <span class="option-sep">·</span>
                <span v-html="highlightMatch(opt.projectNo || '—', searchTerm)"></span>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="combobox-empty">{{ noResultsLabel }} "{{ searchTerm }}"</div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

export interface CodeOption {
  code: string
  productLine: string
  projectNo: string
}

const props = defineProps<{
  modelValue: string
  items: CodeOption[]
  placeholder?: string
  groupLabel?: string
  resultsLabel?: string
  noResultsLabel?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const containerRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const searchTerm = ref('')
const isOpen = ref(false)
const highlightedIndex = ref(0)

const filtered = computed(() => {
  const term = searchTerm.value.toLowerCase().trim()
  if (!term) return props.items
  return props.items.filter(o =>
    o.code.toLowerCase().includes(term) ||
    o.productLine.toLowerCase().includes(term) ||
    o.projectNo.toLowerCase().includes(term)
  )
})

function open() { isOpen.value = true; searchTerm.value = ''; highlightedIndex.value = 0 }
function close() { isOpen.value = false; searchTerm.value = '' }
function onInput() { if (!isOpen.value) isOpen.value = true; highlightedIndex.value = 0 }

function select(opt: CodeOption) {
  emit('update:modelValue', opt.code)
  close()
}

function handleKeydown(e: KeyboardEvent) {
  if (!isOpen.value) {
    if (e.key === 'ArrowDown' || e.key === 'Enter') { open(); e.preventDefault() }
    return
  }
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      if (highlightedIndex.value < filtered.value.length - 1) highlightedIndex.value++
      break
    case 'ArrowUp':
      e.preventDefault()
      if (highlightedIndex.value > 0) highlightedIndex.value--
      break
    case 'Enter':
      e.preventDefault()
      if (filtered.value[highlightedIndex.value]) select(filtered.value[highlightedIndex.value])
      break
    case 'Escape':
      close()
      break
  }
}

function highlightMatch(text: string, search: string): string {
  const escaped = escapeHtml(text)
  if (!search || !search.trim()) return escaped
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return escaped.replace(new RegExp(`(${escapedSearch})`, 'gi'), '<span class="highlight-match">$1</span>')
}
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) close()
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<style scoped>
.combobox { position: relative; }
.combobox-input {
  background-color: var(--bg-secondary); border: 1px solid var(--border-color);
  color: var(--text-primary); border-radius: var(--radius-md);
  padding: 8px 32px 8px 8px; font-size: 12px; width: 100%;
  font-family: var(--font-sans); transition: border-color 0.2s, box-shadow 0.2s;
}
.combobox-input:focus { outline: none; border-color: var(--accent-blue); box-shadow: 0 0 0 3px var(--blue-subtle); }
.combobox-input::placeholder { color: var(--text-muted); }
.combobox-input.has-selection::placeholder { color: var(--text-primary); }
.combobox-arrow {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  pointer-events: none; color: var(--text-muted); width: 14px; height: 14px; transition: transform 0.2s;
}
.combobox-arrow.open { transform: translateY(-50%) rotate(180deg); }
.combobox-dropdown {
  position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px;
  background-color: var(--bg-secondary); border: 1px solid var(--border-color);
  border-radius: var(--radius-md); max-height: 260px; overflow-y: auto; z-index: 1000; box-shadow: var(--shadow-panel);
}
.combobox-group-header {
  padding: 8px 12px 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--text-muted); background-color: var(--bg-primary); position: sticky; top: 0;
}
.combobox-option { padding: 8px 12px; cursor: pointer; transition: background-color 0.15s; }
.combobox-option:hover, .combobox-option.highlighted { background-color: var(--bg-tertiary); }
.combobox-option.selected { background-color: var(--blue-subtle); }
.option-code { font-size: 12px; font-family: var(--font-mono); color: var(--text-primary); }
.option-meta { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
.option-sep { margin: 0 4px; }
.combobox-empty { padding: 12px; text-align: center; color: var(--text-muted); font-size: 12px; }
</style>
