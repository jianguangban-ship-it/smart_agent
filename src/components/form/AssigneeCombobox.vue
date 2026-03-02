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
      :placeholder="selectedName || placeholder"
      role="combobox"
      :aria-expanded="isOpen"
      aria-autocomplete="list"
      aria-controls="assignee-listbox"
      :aria-activedescendant="isOpen && highlightedIndex >= 0 ? `assignee-opt-${highlightedIndex}` : undefined"
    />
    <svg class="combobox-arrow" :class="{ open: isOpen }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
    </svg>

    <Transition name="dropdown">
      <div v-if="isOpen" class="combobox-dropdown" id="assignee-listbox" role="listbox">
        <div class="combobox-group-header">
          {{ groupLabel }} - {{ filtered.length }} {{ resultsLabel }}
        </div>
        <template v-if="filtered.length > 0">
          <div
            v-for="(user, index) in filtered"
            :key="user.id + '-' + index"
            @click="selectUser(user)"
            @mouseenter="highlightedIndex = index"
            class="combobox-option"
            :class="{
              highlighted: highlightedIndex === index,
              selected: modelValue === user.id
            }"
            role="option"
            :id="`assignee-opt-${index}`"
            :aria-selected="modelValue === user.id"
          >
            <div class="avatar" :style="{ backgroundColor: getAvatarColor(user.id) }">
              {{ getInitials(user.name) }}
            </div>
            <div class="option-info">
              <div class="option-name" v-html="highlightMatch(user.name, searchTerm)"></div>
              <div class="option-id" v-html="highlightMatch(user.id, searchTerm)"></div>
            </div>
            <span v-if="user.role" class="option-role">{{ user.role }}</span>
          </div>
        </template>
        <div v-else class="combobox-empty">
          {{ noResultsLabel }} "{{ searchTerm }}"
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { TeamMember } from '@/types/team'
import { useCombobox } from '@/composables/useCombobox'

const props = defineProps<{
  modelValue: string
  items: TeamMember[]
  placeholder?: string
  selectedName?: string
  groupLabel?: string
  resultsLabel?: string
  noResultsLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const containerRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()

const { searchTerm, isOpen, highlightedIndex, filtered, open, close, onInput, onKeydown, highlightMatch } =
  useCombobox(() => props.items)

function selectUser(user: TeamMember) {
  emit('update:modelValue', user.id)
  close()
}

function handleKeydown(e: KeyboardEvent) {
  onKeydown(e, selectUser)
}

const AVATAR_COLORS = [
  'var(--accent-blue)',
  'var(--accent-green)',
  'var(--accent-purple)',
  'var(--accent-orange)',
  'var(--accent-red)',
]

function getAvatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  // Handle "吴亮 (Wu Liang)" style — take first CJK char + first latin letter
  const cjk = name.match(/[\u4e00-\u9fff]/)?.[0] ?? ''
  const latin = name.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? ''
  if (cjk) return cjk + (latin || '')
  // Pure latin: first letters of first two words
  const words = name.trim().split(/\s+/)
  return words.slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.combobox {
  position: relative;
}
.combobox-input {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  padding: 10px 36px 10px 14px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 100%;
  font-family: var(--font-sans);
}
.combobox-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
}
.combobox-input::placeholder {
  color: var(--text-muted);
}
.combobox-arrow {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--text-muted);
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}
.combobox-arrow.open {
  transform: translateY(-50%) rotate(180deg);
}
.combobox-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  max-height: 240px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.combobox-group-header {
  padding: 8px 14px 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  background-color: var(--bg-primary);
  position: sticky;
  top: 0;
}
.combobox-option {
  padding: 10px 14px;
  cursor: pointer;
  transition: background-color 0.15s;
  display: flex;
  align-items: center;
  gap: 10px;
}
.combobox-option:hover,
.combobox-option.highlighted {
  background-color: var(--bg-tertiary);
}
.combobox-option.selected {
  background-color: rgba(88, 166, 255, 0.15);
}
.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: white;
  flex-shrink: 0;
  letter-spacing: 0;
}
.option-info {
  flex: 1;
  min-width: 0;
}
.option-name {
  font-size: 13px;
  color: var(--text-primary);
}
.option-id {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
.option-role {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  white-space: nowrap;
}
.combobox-empty {
  padding: 12px 14px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
