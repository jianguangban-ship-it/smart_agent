<template>
  <div class="points-picker" role="group" aria-label="Story Points" ref="pickerRef" @keydown="pickerRoving.handleKeydown">
    <button
      v-for="point in points"
      :key="point"
      @click="selectPreset(point)"
      class="point-btn"
      :class="{ active: !hasCustom && modelValue === point }"
    >
      {{ point }}
    </button>

    <input
      v-model="customRaw"
      @input="onCustomInput"
      type="text"
      inputmode="numeric"
      class="point-input"
      :class="{ active: hasCustom }"
      placeholder="?"
      maxlength="3"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { FIBONACCI_POINTS } from '@/config/constants'
import { useRovingIndex } from '@/composables/useRovingIndex'

const props = defineProps<{
  modelValue: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const pickerRef = ref<HTMLElement>()
const pickerRoving = useRovingIndex(pickerRef)

const points = FIBONACCI_POINTS

const isPreset = (v: number) =>
  (FIBONACCI_POINTS as readonly number[]).includes(v)

// Pre-populate if the stored value is already a custom number
const customRaw = ref(
  props.modelValue > 0 && !isPreset(props.modelValue)
    ? String(props.modelValue)
    : ''
)

const hasCustom = computed(() => customRaw.value.trim() !== '')

function selectPreset(point: number) {
  customRaw.value = ''
  emit('update:modelValue', point)
}

function onCustomInput() {
  const raw = customRaw.value.replace(/[^\d]/g, '')
  customRaw.value = raw          // strip non-digits in place
  const n = parseInt(raw, 10)
  if (raw === '' ) return        // cleared — leave current value as-is
  if (!isNaN(n) && n > 0) emit('update:modelValue', n)
}
</script>

<style scoped>
.points-picker {
  display: flex;
  gap: 6px;
  align-items: center;
}

.point-btn {
  width: 40px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  font-size: 14px;
  font-weight: 500;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  transition: all 0.2s;
  flex-shrink: 0;
  cursor: pointer;
}
.point-btn.active {
  background-color: var(--accent-blue);
  border-color: var(--accent-blue);
  color: white;
}
.point-btn:hover:not(.active) {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.point-input {
  width: 56px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  outline: none;
  transition: all 0.2s;
  flex-shrink: 0;
  padding: 0;
}
.point-input::placeholder {
  color: var(--text-muted);
  font-weight: 400;
}
.point-input:focus {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}
.point-input.active {
  background-color: var(--accent-blue);
  border-color: var(--accent-blue);
  color: white;
}
.point-input.active::placeholder {
  color: rgba(255, 255, 255, 0.6);
}
</style>
