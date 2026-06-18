<template>
  <div class="logs-panel">
    <header class="logs-head">
      <div>
        <h1 class="lp-title">{{ t('logs.title') }}</h1>
        <p class="lp-subtitle">{{ t('logs.subtitle') }}</p>
      </div>
      <span class="conn" :class="{ on: connected }">
        <span class="conn-dot" /> {{ connected ? t('logs.live') : t('logs.offline') }}
      </span>
    </header>

    <div class="logs-toolbar">
      <div class="filters">
        <button
          v-for="f in FILTERS" :key="f"
          type="button" class="chip" :class="{ active: filter === f }"
          @click="filter = f"
        >{{ t('logs.filter_' + f) }}</button>
      </div>
      <input v-model="search" type="search" class="lp-input" :placeholder="t('logs.search')" />
      <button type="button" class="btn-ghost" @click="paused = !paused">
        {{ paused ? t('logs.resume') : t('logs.pause') }}
      </button>
      <button type="button" class="btn-ghost" @click="clear">{{ t('logs.clear') }}</button>
    </div>

    <div ref="listEl" class="logs-list" @scroll="onScroll">
      <button type="button" class="load-older" @click="onLoadOlder">{{ t('logs.loadOlder') }}</button>
      <p v-if="!visible.length" class="empty">{{ t('logs.empty') }}</p>
      <div
        v-for="e in visible" :key="e.id"
        class="log-row" :class="'lvl-' + e.level"
        @click="toggle(e.id)"
      >
        <span class="r-time" :title="e.ts">{{ shortTime(e.ts) }}</span>
        <span class="r-icon">{{ icon(e) }}</span>
        <span v-if="e.evt" class="r-evt">{{ e.evt }}</span>
        <span class="r-msg">{{ e.msg }}</span>
        <span v-if="e.team_key" class="r-tag">{{ e.team_key }}</span>
        <span v-if="e.source" class="r-tag muted">{{ e.source }}</span>
        <span v-if="e.ip" class="r-ip">{{ e.ip }}</span>
        <pre v-if="expanded.has(e.id) && e.detail" class="r-detail">{{ pretty(e.detail) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from '@/i18n'
import { useLogStream } from '@/composables/useLogStream'
import type { LogEntry, LogFilter } from '@/types/logs'

const props = defineProps<{ active?: boolean }>()
const { t } = useI18n()

const { logs, connected, paused, start, stop, loadOlder, clear } = useLogStream()

const FILTERS: LogFilter[] = ['all', 'audit', 'warn', 'error']
const filter = ref<LogFilter>('all')
const search = ref('')
const expanded = ref<Set<number>>(new Set())
const listEl = ref<HTMLElement | null>(null)
let follow = true // bottom-follow unless the user scrolls up

const visible = computed<LogEntry[]>(() => {
  const q = search.value.trim().toLowerCase()
  return logs.value.filter(e => {
    if (filter.value === 'audit' && !e.evt) return false
    if (filter.value === 'warn' && e.level !== 'warn') return false
    if (filter.value === 'error' && e.level !== 'error') return false
    if (q) {
      const hay = `${e.evt ?? ''} ${e.msg} ${e.team_key ?? ''} ${e.source ?? ''} ${e.ip ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

function toggle(id: number) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
  expanded.value = new Set(expanded.value)
}
function shortTime(ts: string): string {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleTimeString()
}
function icon(e: LogEntry): string {
  if (e.level === 'error') return '⛔'
  if (e.level === 'warn') return '⚠️'
  if (e.evt?.startsWith('team.')) return '✏️'
  if (e.evt?.startsWith('ticket.')) return '✅'
  if (e.evt === 'server.start') return '🚀'
  return '•'
}
function pretty(d: Record<string, unknown>): string {
  return JSON.stringify(d, null, 2)
}

function onScroll() {
  const el = listEl.value
  if (!el) return
  follow = el.scrollHeight - el.scrollTop - el.clientHeight < 40
}
async function onLoadOlder() {
  const el = listEl.value
  const before = el?.scrollHeight ?? 0
  const n = await loadOlder()
  if (n && el) { await nextTick(); el.scrollTop = el.scrollHeight - before } // keep position
}

// Bottom-follow on new entries (unless the user scrolled up).
watch(() => logs.value.length, async () => {
  if (!follow) return
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
})

// Connect ONLY while the page is active (gates all streaming work).
watch(() => props.active, (on) => {
  if (on) { start(); follow = true; nextTick(() => { if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight }) }
  else stop()
}, { immediate: true })

onBeforeUnmount(stop)
</script>

<style scoped>
.logs-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; padding: var(--space-3) var(--space-4); }
.logs-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
.lp-title { margin: 0; font-size: var(--font-xl); font-weight: 600; color: var(--text-primary); }
.lp-subtitle { margin: var(--space-1) 0 0; font-size: var(--font-xs); color: var(--text-muted); }
.conn { display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-xs); color: var(--text-muted); }
.conn-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); }
.conn.on .conn-dot { background: var(--accent-green, #34d399); box-shadow: 0 0 6px var(--accent-green, #34d399); }

.logs-toolbar { display: flex; align-items: center; gap: var(--space-2); margin: var(--space-3) 0 var(--space-2); flex-wrap: wrap; }
.filters { display: flex; gap: var(--space-1); }
.chip {
  padding: 4px 10px; border: 1px solid var(--border-color); border-radius: var(--radius-pill, 999px);
  background: transparent; color: var(--text-secondary); font-size: var(--font-xs); font-weight: 600; cursor: pointer;
}
.chip.active { color: var(--accent-blue); border-color: var(--accent-blue); background: var(--blue-subtle, rgba(96,165,250,0.12)); }
.lp-input {
  flex: 1; min-width: 160px; max-width: 320px; box-sizing: border-box; padding: var(--space-2);
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
  background: var(--bg-secondary, var(--bg-tertiary)); color: var(--text-primary); font-size: var(--font-sm); outline: none;
}
.lp-input:focus { border-color: var(--accent-blue); }
.btn-ghost {
  padding: var(--space-2) var(--space-3); border: 1px solid var(--border-color); border-radius: var(--radius-md);
  background: transparent; color: var(--text-secondary); font-size: var(--font-sm); font-weight: 600; cursor: pointer;
}
.btn-ghost:hover { color: var(--text-primary); border-color: var(--text-muted); }

.logs-list {
  flex: 1; min-height: 0; overflow-y: auto;
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
  background: var(--bg-secondary, transparent);
  font-family: var(--font-mono, monospace); font-size: 12px;
}
.load-older { width: 100%; padding: 6px; border: none; border-bottom: 1px dashed var(--border-color); background: transparent; color: var(--text-muted); cursor: pointer; font-size: var(--font-xs); }
.load-older:hover { color: var(--accent-blue); }
.empty { color: var(--text-muted); padding: var(--space-4); text-align: center; }

.log-row {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
  padding: 4px 10px; border-bottom: 1px solid var(--border-color); cursor: pointer;
}
.log-row:hover { background: var(--bg-tertiary); }
.lvl-warn { background: rgba(251, 191, 36, 0.06); }
.lvl-error { background: rgba(248, 113, 113, 0.08); }
.r-time { color: var(--text-muted); flex-shrink: 0; }
.r-icon { flex-shrink: 0; }
.r-evt { color: var(--accent-blue); font-weight: 700; }
.r-msg { color: var(--text-primary); flex: 1; min-width: 120px; }
.r-tag { font-size: 11px; padding: 0 6px; border-radius: var(--radius-sm); background: var(--bg-tertiary); color: var(--text-secondary); }
.r-tag.muted { color: var(--text-muted); }
.r-ip { color: var(--text-muted); font-size: 11px; }
.r-detail { flex-basis: 100%; margin: 4px 0 2px; padding: 8px; border-radius: var(--radius-sm); background: var(--bg-tertiary); color: var(--text-secondary); white-space: pre-wrap; overflow-x: auto; }
</style>
