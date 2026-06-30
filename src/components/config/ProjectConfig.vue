<template>
  <div class="project-config">
    <header class="pc-head">
      <div class="pc-title-row">
        <h1 class="pc-title">{{ t('config.project') }}</h1>
        <p class="pc-subtitle">{{ t('config.projectSubtitle') }}</p>
      </div>

      <!-- Lock bar (mirrors the Team editor) -->
      <div class="lock-bar">
        <template v-if="unlocked">
          <span class="badge badge-unlocked">● {{ t('config.unlocked') }}</span>
          <button type="button" class="btn-ghost" @click="relock">{{ t('config.lock') }}</button>
        </template>
        <template v-else-if="codePromptOpen">
          <div class="code-prompt" :class="{ shake: unlockError }">
            <input
              ref="codeInputEl"
              v-model="codeInput"
              type="password"
              class="field-input code-input"
              :placeholder="t('config.enterCode')"
              @keydown.enter="submitUnlock"
              @keydown.esc="closeCodePrompt"
            />
            <button type="button" class="btn-primary" @click="submitUnlock">{{ t('config.confirmUnlock') }}</button>
            <button type="button" class="btn-ghost" @click="closeCodePrompt">✕</button>
          </div>
        </template>
        <template v-else>
          <button type="button" class="btn-unlock" @click="openCodePrompt">🔒 {{ t('config.unlock') }}</button>
        </template>
      </div>
    </header>

    <!-- Toolbar: quick filter + CSV export/import. -->
    <div class="pc-toolbar">
      <input v-model="query" type="search" class="field-input pc-filter-input" :placeholder="t('config.projFilter')" />
      <div class="pc-toolbar-right">
        <button type="button" class="btn-ghost" @click="exportCsv">{{ t('config.projExportCsv') }}</button>
        <label v-if="unlocked" class="btn-ghost pc-import-btn">
          {{ t('config.projImportCsv') }}
          <input type="file" accept=".csv,text/csv" @change="importCsv" style="display:none" />
        </label>
      </div>
    </div>

    <p v-if="draft.length === 0" class="pc-empty">{{ t('config.projEmpty') }}</p>
    <p v-else-if="filteredRows.length === 0" class="pc-empty">{{ t('config.projNoMatch') }}</p>

    <div v-else class="pc-table-scroll">
      <table class="pc-table">
        <thead>
          <tr>
            <th>{{ t('config.projColProductLine') }}</th>
            <th>{{ t('config.projColCustomerCode') }}</th>
            <th>{{ t('config.projColProjectNo') }}</th>
            <th>{{ t('config.projColYearInfo') }}</th>
            <th>{{ t('config.projColCompanyCode') }}</th>
            <th>{{ t('config.projColSerialNo') }}</th>
            <th>{{ t('config.projColProductTypeCode') }}</th>
            <th class="pc-col-composite">{{ t('config.projColComposite') }}</th>
            <th class="pc-col-comments">{{ t('config.projColComments') }}</th>
            <th v-if="unlocked" class="pc-col-act"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredRows" :key="item.idx" :class="{ 'pc-dup': dup.indices.has(item.idx) }">
            <td>
              <select v-if="unlocked" v-model="item.row.productLine" class="field-input pc-select">
                <option value="" disabled>{{ t('config.projSelectLine') }}</option>
                <option v-for="opt in PRODUCT_LINE_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <span v-else class="pc-ro">{{ item.row.productLine || '—' }}</span>
            </td>
            <td><input v-if="unlocked" v-model="item.row.customerCode" class="field-input" /><span v-else class="pc-ro">{{ item.row.customerCode || '—' }}</span></td>
            <td><input v-if="unlocked" v-model="item.row.projectNo" class="field-input" /><span v-else class="pc-ro">{{ item.row.projectNo || '—' }}</span></td>
            <td><input v-if="unlocked" v-model="item.row.yearInfo" class="field-input" /><span v-else class="pc-ro">{{ item.row.yearInfo || '—' }}</span></td>
            <td><input v-if="unlocked" v-model="item.row.companyCode" class="field-input" /><span v-else class="pc-ro">{{ item.row.companyCode || '—' }}</span></td>
            <td><input v-if="unlocked" v-model="item.row.serialNo" class="field-input" /><span v-else class="pc-ro">{{ item.row.serialNo || '—' }}</span></td>
            <td><input v-if="unlocked" v-model="item.row.productTypeCode" class="field-input" /><span v-else class="pc-ro">{{ item.row.productTypeCode || '—' }}</span></td>
            <td class="pc-composite">{{ compositeCode(item.row) }}</td>
            <td><input v-if="unlocked" v-model="item.row.comments" class="field-input pc-comments-input" /><span v-else class="pc-ro">{{ item.row.comments || '—' }}</span></td>
            <td v-if="unlocked" class="pc-col-act">
              <button type="button" class="btn-icon-del" :title="t('config.projRemoveRow')" @click="removeRow(item.idx)">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="unlocked" class="pc-actions">
      <button type="button" class="btn-ghost" @click="addRow">+ {{ t('config.projAddRow') }}</button>
      <div class="pc-actions-right">
        <span v-if="hasDuplicates" class="pc-error">⚠ {{ fmt('config.projDupError', { codes: dup.codes.join(', ') }) }}</span>
        <span v-else-if="dirty" class="dirty-dot">● {{ t('settings.skillModified') }}</span>
        <button type="button" class="btn-ghost" :disabled="!dirty" @click="discard">{{ t('config.discard') }}</button>
        <button type="button" class="btn-primary" :disabled="!dirty || saving || hasDuplicates" @click="onSave">{{ t('config.save') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { runtimeProjectMatrix } from '@/composables/useRuntimeConfig'
import {
  PRODUCT_LINE_OPTIONS, compositeCode, emptyRow, rowMatchesQuery,
  duplicateCompositeRows, type ProjectMatrixRow
} from '@/config/projectMatrix'
import {
  isProjectsUnlocked, unlockProjects, lockProjects, saveProjectMatrix
} from '@/composables/useProjectMatrixWrite'
import { projectMatrixToCsv, parseProjectMatrixCsv } from '@/utils/projectMatrixCsv'
import { downloadFile } from '@/utils/exportFormats'

const props = defineProps<{ active?: boolean }>()
const { t } = useI18n()
const { addToast } = useToast()

// `{n}`-style interpolation (the project's t() returns the raw string).
function fmt(key: string, vars: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

const unlocked = computed(() => isProjectsUnlocked())

// ── Draft (working copy) ─────────────────────────────────────────────────────
function clone(rows: ProjectMatrixRow[]): ProjectMatrixRow[] {
  return rows.map(r => ({ ...r }))
}
const draft = ref<ProjectMatrixRow[]>(clone(runtimeProjectMatrix.value))

const dirty = computed(() =>
  JSON.stringify(draft.value) !== JSON.stringify(runtimeProjectMatrix.value)
)

// Quick filter — keep each row's real draft index so edits/removes stay correct
// regardless of what's filtered out.
const query = ref('')
const filteredRows = computed(() =>
  draft.value
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => rowMatchesQuery(row, query.value))
)

// Duplicate composite codes (over the full draft, blank rows ignored) — drives
// the red cells, the error banner, and the Save block.
const dup = computed(() => duplicateCompositeRows(draft.value))
const hasDuplicates = computed(() => dup.value.indices.size > 0)

function loadDraft() { draft.value = clone(runtimeProjectMatrix.value) }

// Re-sync when the panel becomes active or the runtime data changes (after a
// save, or another tab's edit) — unless we have unsaved local edits.
watch(() => props.active, (on) => { if (on && !dirty.value) loadDraft() })
watch(runtimeProjectMatrix, () => { if (!dirty.value) loadDraft() })

// ── Unlock flow (mirrors TeamConfig) ─────────────────────────────────────────
const codePromptOpen = ref(false)
const codeInput = ref('')
const unlockError = ref(false)
const codeInputEl = ref<HTMLInputElement | null>(null)

function openCodePrompt() {
  codePromptOpen.value = true
  unlockError.value = false
  codeInput.value = ''
  nextTick(() => codeInputEl.value?.focus())
}
function closeCodePrompt() {
  codePromptOpen.value = false
  codeInput.value = ''
  unlockError.value = false
}
async function submitUnlock() {
  if (!codeInput.value) return
  const ok = await unlockProjects(codeInput.value)
  if (ok) {
    closeCodePrompt()
    addToast('success', t('config.unlocked'))
  } else {
    unlockError.value = true
    addToast('error', t('config.wrongCode'))
    setTimeout(() => { unlockError.value = false }, 500)
  }
}
function relock() {
  if (dirty.value && !confirm(t('config.confirmDiscard'))) return
  lockProjects()
  loadDraft()
}

// ── Row editing ──────────────────────────────────────────────────────────────
function addRow() {
  query.value = '' // clear the filter so the new blank row is visible
  draft.value.push(emptyRow())
}
function removeRow(i: number) { draft.value.splice(i, 1) }

// ── Save / discard ───────────────────────────────────────────────────────────
const saving = ref(false)
async function onSave() {
  if (!dirty.value || hasDuplicates.value) return
  saving.value = true
  const res = await saveProjectMatrix(clone(draft.value))
  saving.value = false
  if (res.ok) {
    addToast('success', t('config.projectsSaved'))
  } else if (res.status === 401) {
    addToast('error', t('config.saveAuthFailed'))
    loadDraft()
  } else {
    addToast('error', t('config.saveFailed'))
  }
}
function discard() { loadDraft() }

// ── CSV export / import ──────────────────────────────────────────────────────
function csvHeaders(): string[] {
  return [
    t('config.projColProductLine'), t('config.projColCustomerCode'), t('config.projColProjectNo'),
    t('config.projColYearInfo'), t('config.projColCompanyCode'), t('config.projColSerialNo'),
    t('config.projColProductTypeCode'), t('config.projColComposite'), t('config.projColComments'),
  ]
}
function exportCsv() {
  // Prepend a UTF-8 BOM so Excel renders the Chinese headers correctly.
  const csv = '﻿' + projectMatrixToCsv(draft.value, csvHeaders())
  const date = new Date().toISOString().slice(0, 10)
  downloadFile(csv, `project-matrix-${date}.csv`, 'text/csv;charset=utf-8')
}
function importCsv(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    const text = (ev.target?.result as string) ?? ''
    const { rows, ok } = parseProjectMatrixCsv(text)
    if (!ok) addToast('error', t('config.projImportError'))
    else {
      draft.value = rows
      addToast('success', fmt('config.projImportDone', { n: rows.length }))
      const d = duplicateCompositeRows(rows)
      if (d.indices.size > 0) addToast('error', fmt('config.projDupError', { codes: d.codes.join(', ') }))
    }
    input.value = '' // allow re-importing the same file
  }
  reader.onerror = () => { addToast('error', t('config.projImportError')); input.value = '' }
  reader.readAsText(file)
}
</script>

<style scoped>
.project-config {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
}
.pc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-color);
}
.pc-title-row { display: flex; flex-direction: column; gap: 4px; }
.pc-title { font-size: var(--font-xl); font-weight: 600; color: var(--text-primary); margin: 0; }
.pc-subtitle { font-size: var(--font-base); color: var(--text-muted); margin: 0; }

/* Lock bar */
.lock-bar { display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }
.badge-unlocked { font-size: var(--font-sm); font-weight: 600; color: var(--accent-green, #3fb950); }
.btn-unlock {
  padding: var(--space-2) var(--space-3); border-radius: var(--radius-md);
  border: 1px solid var(--border-color); background: transparent; color: var(--text-secondary);
  font-size: var(--font-base); font-weight: 500; cursor: pointer; transition: all 0.15s;
}
.btn-unlock:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
.code-prompt { display: flex; align-items: center; gap: 6px; }
.code-prompt.shake { animation: pc-shake 0.4s; }
.code-input { width: 180px; }
@keyframes pc-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }

/* Toolbar: filter + CSV export/import */
.pc-toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap; }
.pc-toolbar-right { display: flex; align-items: center; gap: var(--space-2); }
.pc-filter-input { width: 280px; max-width: 100%; }
.pc-import-btn { cursor: pointer; }

/* Table */
.pc-table-scroll { overflow: auto; min-height: 0; flex: 1; }
.pc-table { border-collapse: collapse; width: 100%; font-size: var(--font-base); }
.pc-table th, .pc-table td {
  border: 1px solid var(--border-color); padding: 4px 8px; text-align: left; white-space: nowrap;
}
.pc-table th { color: var(--text-secondary); font-weight: 600; background: var(--bg-tertiary); position: sticky; top: 0; z-index: 1; }
.pc-table .field-input { width: 100%; min-width: 90px; }
.pc-select { min-width: 96px; }
.pc-ro { color: var(--text-primary); }
.pc-composite { font-family: var(--font-mono); color: var(--accent-blue); }
.pc-col-composite { min-width: 240px; }

/* Duplicate composite code — the check runs vertically down the Composite Code
   column, so red the composite cell only; leave 产品线 + the 6 code inputs alone. */
.pc-dup .pc-composite {
  color: var(--accent-red);
  font-weight: 700;
  background: rgba(248, 81, 73, 0.10);
  border-color: var(--accent-red);
}
.pc-col-comments { min-width: 160px; }
.pc-comments-input { min-width: 140px; }
.pc-col-act { width: 32px; text-align: center; }
.btn-icon-del {
  width: 24px; height: 24px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);
  background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.15s;
}
.btn-icon-del:hover { color: var(--accent-red); border-color: var(--accent-red); }

.pc-empty { color: var(--text-muted); font-size: var(--font-sm); padding: var(--space-4) 0; }

/* Actions */
.pc-actions { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding-top: var(--space-2); }
.pc-actions-right { display: flex; align-items: center; gap: var(--space-2); }
.dirty-dot { font-size: var(--font-sm); color: var(--accent-orange); }
.pc-error { font-size: var(--font-sm); color: var(--accent-red); font-weight: 600; max-width: 520px; }
.field-input {
  padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm);
  border: 1px solid var(--border-color); background-color: var(--bg-tertiary);
  color: var(--text-primary); font-size: var(--font-base); outline: none; box-sizing: border-box;
}
.field-input:focus { border-color: var(--accent-blue); }
.btn-primary, .btn-ghost {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4); border-radius: var(--radius-md);
  font-size: var(--font-base); font-weight: 500; cursor: pointer; transition: all 0.2s; border: none;
}
.btn-primary { background-color: var(--accent-blue); color: white; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost { background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); }
.btn-ghost:hover:not(:disabled) { background-color: var(--bg-tertiary); }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
