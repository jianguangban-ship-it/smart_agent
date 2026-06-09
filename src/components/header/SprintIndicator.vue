<template>
  <div class="sprint-wrap" ref="wrapRef">
    <button
      class="sprint-pill"
      :class="{
        'sprint-pill--ending': isLastTwoDays,
        'sprint-pill--drp': isDRP,
        'sprint-pill--idle': !currentSprint,
      }"
      :title="pillTitle"
      :aria-label="pillTitle"
      @click="popoverOpen = !popoverOpen"
    >
      <svg class="sprint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 12h14"/>
      </svg>
      <span class="sprint-label">{{ pillLabel }}</span>
      <span v-if="currentSprint" class="sprint-progress">
        <span class="sprint-progress-fill" :style="{ width: progressPercent + '%' }"></span>
      </span>
    </button>

    <Transition name="popover-fade">
      <div v-if="popoverOpen && currentSprint" class="sprint-popover" @click.stop>
        <div class="popover-row popover-title">{{ currentSprint.name }}<span v-if="isDRP" class="popover-drp">· {{ t('sprint.drpBadge') }}</span></div>
        <div class="popover-row popover-window">
          <span class="popover-key">{{ t('sprint.popoverWindow') }}</span>
          <span class="popover-val">{{ formatRange(currentSprint.start, currentSprint.end) }}</span>
        </div>
        <div class="popover-row popover-day">
          <span class="popover-key">{{ t('sprint.popoverDay') }}</span>
          <span class="popover-val">{{ dayOfSprint }} / {{ sprintLengthDays }} · {{ daysRemaining }} {{ t('sprint.daysLeft') }}</span>
        </div>
        <div class="popover-row popover-cadence">
          <span class="popover-key">{{ t('sprint.popoverCadence') }}</span>
          <code class="popover-code">{{ cadenceString }}</code>
          <button class="popover-copy" :title="t('sprint.popoverCopy')" @click="copyCadence">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="2" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div v-if="nextSprint" class="popover-row popover-next">
          <span class="popover-key">{{ t('sprint.popoverNext') }}</span>
          <span class="popover-val">{{ nextSprint.name }} · {{ formatShort(nextSprint.start) }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/utils/clipboard'
import {
  currentSprint,
  dayOfSprint,
  sprintLengthDays,
  daysRemaining,
  progressPercent,
  isDRP,
  isLastTwoDays,
  cadenceString,
  nextSprint,
  scheduleStatus,
} from '@/composables/useSprint'

const { t, isZh } = useI18n()
const { addToast } = useToast()

const popoverOpen = ref(false)
const wrapRef = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent) {
  if (!popoverOpen.value) return
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    popoverOpen.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

const pillLabel = computed(() => {
  const s = currentSprint.value
  if (!s) {
    return scheduleStatus.value === 'before-first' ? t('sprint.beforeFirst') : t('sprint.afterLast')
  }
  return `${s.name} · D${dayOfSprint.value}/${sprintLengthDays.value} · ${t('sprint.endsLabel')} ${formatShort(s.end)}`
})

const pillTitle = computed(() =>
  currentSprint.value ? `${cadenceString.value} — ${t('sprint.popoverHint')}` : pillLabel.value
)

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六']

function formatShort(d: Date): string {
  const wd = isZh.value ? `周${WEEKDAYS_ZH[d.getDay()]}` : WEEKDAYS_EN[d.getDay()]
  return isZh.value
    ? `${wd} ${d.getMonth() + 1}/${d.getDate()}`
    : `${wd} ${d.getMonth() + 1}/${d.getDate()}`
}

function formatRange(a: Date, b: Date): string {
  return `${formatShort(a)} ${pad2(a.getHours())}:${pad2(a.getMinutes())} → ${formatShort(b)} ${pad2(b.getHours())}:${pad2(b.getMinutes())}`
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

async function copyCadence() {
  if (!cadenceString.value) return
  const ok = await copyText(cadenceString.value)
  if (ok) addToast('success', t('toast.copied'))
  else addToast('error', t('toast.copyFailed'))
}
</script>

<style scoped>
.sprint-wrap {
  position: relative;
  display: inline-flex;
}

.sprint-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--accent-green);
  border-radius: var(--radius-md, 6px);
  background: color-mix(in srgb, var(--accent-green) 12%, var(--bg-tertiary));
  color: var(--accent-green);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-mono, monospace);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  white-space: nowrap;
}
.sprint-pill:hover {
  background: color-mix(in srgb, var(--accent-green) 22%, var(--bg-tertiary));
}
.sprint-pill--ending {
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  background: color-mix(in srgb, var(--accent-orange) 14%, var(--bg-tertiary));
}
.sprint-pill--ending:hover {
  background: color-mix(in srgb, var(--accent-orange) 24%, var(--bg-tertiary));
}
.sprint-pill--drp {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  background: color-mix(in srgb, var(--accent-blue) 14%, var(--bg-tertiary));
}
.sprint-pill--drp:hover {
  background: color-mix(in srgb, var(--accent-blue) 24%, var(--bg-tertiary));
}
.sprint-pill--idle {
  border-color: var(--border-color);
  color: var(--text-muted);
  background: var(--bg-tertiary);
}

.sprint-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.sprint-label {
  letter-spacing: 0.02em;
}

.sprint-progress {
  display: inline-block;
  width: 48px;
  height: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, currentColor 18%, transparent);
  overflow: hidden;
  flex-shrink: 0;
}
.sprint-progress-fill {
  display: block;
  height: 100%;
  background: currentColor;
  transition: width 0.4s ease;
}

/* Popover */
.sprint-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 110;
  min-width: 280px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 6px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  font-size: 12px;
  color: var(--text-primary);
  font-family: var(--font-sans, system-ui, sans-serif);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.popover-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.popover-title {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-primary);
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color);
}
.popover-drp {
  margin-left: 6px;
  color: var(--accent-blue, #2563eb);
  font-weight: 500;
}
.popover-key {
  color: var(--text-muted);
  min-width: 64px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.popover-val {
  color: var(--text-primary);
}
.popover-code {
  flex: 1;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  padding: 2px 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  color: var(--accent-blue, #2563eb);
}
.popover-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.popover-copy:hover {
  color: var(--accent-blue, #2563eb);
  border-color: var(--accent-blue, #2563eb);
}
.popover-copy svg {
  width: 12px;
  height: 12px;
}

.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .sprint-progress-fill,
  .sprint-pill {
    transition: none;
  }
  .popover-fade-enter-active,
  .popover-fade-leave-active {
    transition: none;
  }
}
</style>
