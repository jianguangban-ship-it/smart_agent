<template>
  <Transition name="modal">
    <div v-if="modelValue" class="modal-overlay" ref="settingsModalRef" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" @click.self="$emit('update:modelValue', false)">
      <div class="modal-content">
        <h3 id="settings-modal-title" class="modal-title">{{ t('settings.title') }}</h3>

        <!-- Provider Base URL -->
        <div class="field-group">
          <label class="field-label">{{ t('settings.providerUrl') }}</label>
          <input v-model="localProviderUrl" type="text" class="field-input" :placeholder="t('settings.providerUrlPlaceholder')" :disabled="bothWebhook" />
        </div>

        <!-- API Key -->
        <div class="field-group">
          <label class="field-label">{{ t('settings.apiKey') }}</label>
          <div class="key-row">
            <input v-model="localApiKey" type="password" class="field-input" :placeholder="t('settings.apiKeyPlaceholder')" :disabled="bothWebhook" />
            <button class="btn-test" :disabled="!localApiKey.trim() || validationState === 'testing'" @click="handleTestKey">
              {{ validationState === 'testing' ? t('settings.testing') : t('settings.testKey') }}
            </button>
          </div>
          <div v-if="validationState === 'valid'" class="key-badge key-badge--valid">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {{ t('settings.keyValid') }}
          </div>
          <div v-else-if="validationState === 'invalid'" class="key-badge key-badge--invalid">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            {{ validationError }}
          </div>
        </div>

        <!-- Model Name -->
        <div class="field-group">
          <label class="field-label">{{ t('settings.model') }}</label>
          <input v-model="localModel" type="text" list="model-presets" class="field-input" :placeholder="t('settings.modelPlaceholder')" autocomplete="off" />
          <datalist id="model-presets">
            <option v-for="model in allModelPresets" :key="model" :value="model" />
          </datalist>
        </div>

        <!-- Coach Skill -->
        <div class="field-group" :class="{ dimmed: localMode === 'webhook' }">
          <div class="skill-header">
            <div class="skill-label-row">
              <label class="field-label">{{ t('settings.coachSkill') }}</label>
              <span v-if="coachSkillModified" class="skill-modified-badge">● {{ t('settings.skillModified') }}</span>
            </div>
            <div class="skill-actions">
              <label class="btn-skill-md" :class="{ disabled: localMode === 'webhook' }">
                ⬆ {{ t('settings.importSkillMd') }}
                <input type="file" accept=".md,.txt" @change="handleImportCoachMd" style="display:none" :disabled="localMode === 'webhook'" />
              </label>
              <button class="btn-skill-md" @click="handleExportCoachMd" :disabled="localMode === 'webhook'">⬇ {{ t('settings.exportSkillMd') }}</button>
              <button class="btn-reset" @click="handleResetCoach" :disabled="localMode === 'webhook'">{{ t('settings.skillReset') }}</button>
            </div>
          </div>
          <textarea v-model="localCoachSkill" class="skill-textarea" :disabled="localMode === 'webhook'" />
          <div class="skill-footer">
            <p class="skill-hint">{{ t('settings.skillHint') }}</p>
            <span class="skill-counter">{{ localCoachSkill.length }} chars · ~{{ Math.floor(localCoachSkill.length / 4) }} tokens</span>
          </div>
        </div>

        <!-- Analyze Skill -->
        <div class="field-group" :class="{ dimmed: localAnalyzeMode === 'webhook' }">
          <div class="skill-header">
            <div class="skill-label-row">
              <label class="field-label">{{ t('settings.analyzeSkill') }}</label>
              <span v-if="analyzeSkillModified" class="skill-modified-badge">● {{ t('settings.skillModified') }}</span>
            </div>
            <div class="skill-actions">
              <label class="btn-skill-md" :class="{ disabled: localAnalyzeMode === 'webhook' }">
                ⬆ {{ t('settings.importSkillMd') }}
                <input type="file" accept=".md,.txt" @change="handleImportAnalyzeMd" style="display:none" :disabled="localAnalyzeMode === 'webhook'" />
              </label>
              <button class="btn-skill-md" @click="handleExportAnalyzeMd" :disabled="localAnalyzeMode === 'webhook'">⬇ {{ t('settings.exportSkillMd') }}</button>
              <button class="btn-reset" @click="handleResetAnalyze" :disabled="localAnalyzeMode === 'webhook'">{{ t('settings.skillReset') }}</button>
            </div>
          </div>
          <textarea v-model="localAnalyzeSkill" class="skill-textarea" :disabled="localAnalyzeMode === 'webhook'" />
          <div class="skill-footer">
            <p class="skill-hint">{{ t('settings.skillHint') }}</p>
            <span class="skill-counter">{{ localAnalyzeSkill.length }} chars · ~{{ Math.floor(localAnalyzeSkill.length / 4) }} tokens</span>
          </div>
        </div>

        <!-- Template Chip Editor -->
        <details class="field-group template-details">
          <summary class="template-summary">
            <span class="field-label" style="display:inline">{{ t('settings.templateEditor') }}</span>
            <span v-if="customTemplatesModified" class="skill-modified-badge">● {{ t('settings.skillModified') }}</span>
          </summary>
          <div class="chip-list">
            <div v-for="(chip, idx) in localTemplates" :key="idx" class="chip-row">
              <div class="chip-row-header" @click="toggleChipEdit(idx)">
                <span class="chip-icon-preview">{{ chip.icon }}</span>
                <span class="chip-label-preview">{{ chip.label.zh }} / {{ chip.label.en }}</span>
                <div class="chip-row-actions">
                  <button class="chip-act-btn" @click.stop="moveChip(idx, -1)" :disabled="idx === 0" title="Move up">↑</button>
                  <button class="chip-act-btn" @click.stop="moveChip(idx, 1)" :disabled="idx === localTemplates.length - 1" title="Move down">↓</button>
                  <button class="chip-act-btn chip-act-del" @click.stop="deleteChip(idx)" title="Delete">✕</button>
                </div>
              </div>
              <div v-if="editingChipIndex === idx" class="chip-edit-form">
                <div class="chip-field-row">
                  <input v-model="chip.icon" placeholder="Icon" class="chip-icon-input field-input" />
                  <input v-model="chip.label.zh" placeholder="Label ZH" class="field-input" />
                  <input v-model="chip.label.en" placeholder="Label EN" class="field-input" />
                </div>
                <textarea v-model="chip.content.zh" class="chip-content-area" placeholder="Content ZH..." />
                <textarea v-model="chip.content.en" class="chip-content-area" placeholder="Content EN..." />
              </div>
            </div>
            <div class="chip-list-actions">
              <button class="btn-add-chip" @click="addChip">+ {{ t('settings.addChip') }}</button>
              <label class="btn-add-chip btn-import-chip">
                ⬆ {{ t('settings.importTemplates') }}
                <input type="file" accept=".json" @change="handleImportTemplates" style="display:none" />
              </label>
              <button class="btn-add-chip" @click="handleExportTemplatesJson">⬇ {{ t('settings.exportTemplatesJson') }}</button>
              <button class="btn-reset" @click="handleResetTemplates">{{ t('settings.templateReset') }}</button>
            </div>
          </div>
        </details>

        <!-- Export / Import API Settings -->
        <div class="field-group">
          <label class="field-label">{{ t('settings.exportImport') }}</label>
          <div class="export-row">
            <button class="btn-export" @click="handleExport">⬇ {{ t('settings.exportSettings') }}</button>
            <label class="btn-export btn-import">
              ⬆ {{ t('settings.importSettings') }}
              <input type="file" accept=".json" @change="handleImport" style="display:none" />
            </label>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="$emit('update:modelValue', false)">{{ t('settings.cancel') }}</button>
          <button class="btn btn-primary" @click="handleSave">{{ t('settings.save') }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue' // computed kept for allModelPresets
import { useI18n } from '@/i18n'
import { useFocusTrap } from '@/composables/useFocusTrap'
import {
  getApiKey, setApiKey, getModel, setModel,
  getProviderUrl, setProviderUrl,
  GLM_BASE_URL, GLM_DEFAULT_MODEL, LLM_MODEL_PRESETS
} from '@/config/llm'
import {
  getCoachSkill, setCoachSkill, resetCoachSkill, coachSkillModified,
  getAnalyzeSkill, setAnalyzeSkill, resetAnalyzeSkill, analyzeSkillModified,
  getCoachSkillDefault, getAnalyzeSkillDefault
} from '@/config/skills/index'
import {
  TEMPLATES, setCustomTemplates, resetCustomTemplates, customTemplatesModified, effectiveTemplates
} from '@/config/templates/index'
import type { TemplateDefinition } from '@/types/template'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const { t, isZh } = useI18n()

const settingsModalRef = ref<HTMLElement>()
const { activate: activateSettingsTrap, deactivate: deactivateSettingsTrap } = useFocusTrap(settingsModalRef)

const localApiKey = ref(getApiKey())
const localModel = ref(getModel())
const localProviderUrl = ref(localStorage.getItem('provider-url') ?? '')

function currentLang(): 'zh' | 'en' { return isZh.value ? 'zh' : 'en' }

const localCoachSkill = ref(getCoachSkill(currentLang()))
const localAnalyzeSkill = ref(getAnalyzeSkill(currentLang()))

/** Flat list of all preset model names for the datalist */
const allModelPresets = computed(() => LLM_MODEL_PRESETS.flatMap(g => g.models))

function cloneTemplates(arr: TemplateDefinition[]): TemplateDefinition[] {
  return arr.map(t => ({ ...t, label: { ...t.label }, content: { ...t.content } }))
}
const localTemplates = ref<TemplateDefinition[]>(cloneTemplates(effectiveTemplates.value))
const editingChipIndex = ref(-1)

type ValidationState = 'idle' | 'testing' | 'valid' | 'invalid'
const validationState = ref<ValidationState>('idle')
const validationError = ref('')

watch(localApiKey, () => { validationState.value = 'idle'; validationError.value = '' })

watch(() => props.modelValue, (open) => {
  if (open) {
    localApiKey.value = getApiKey()
    localModel.value = getModel()
    localProviderUrl.value = localStorage.getItem('provider-url') ?? ''
    const lang = currentLang()
    localCoachSkill.value = getCoachSkill(lang)
    localAnalyzeSkill.value = getAnalyzeSkill(lang)
    localTemplates.value = cloneTemplates(effectiveTemplates.value)
    editingChipIndex.value = -1
    validationState.value = 'idle'
    validationError.value = ''
    nextTick(() => activateSettingsTrap())
  } else {
    deactivateSettingsTrap()
  }
})

async function handleTestKey() {
  const key = localApiKey.value.trim()
  if (!key) return
  validationState.value = 'testing'
  validationError.value = ''
  try {
    const rawTestUrl = localProviderUrl.value.trim() || GLM_BASE_URL

    const testEndpointUrl = rawTestUrl.endsWith('/chat/completions') ? rawTestUrl : rawTestUrl.replace(/\/$/, '') + '/chat/completions'
    const res = await fetch(testEndpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: localModel.value.trim() || GLM_DEFAULT_MODEL, stream: false, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 })
    })
    if (res.status === 401) {
      validationState.value = 'invalid'; validationError.value = t('error.glm401')
    } else if (res.ok || res.status === 429) {
      validationState.value = 'valid'
    } else {
      validationState.value = 'invalid'; validationError.value = `HTTP ${res.status}: ${res.statusText}`
    }
  } catch {
    validationState.value = 'invalid'; validationError.value = t('error.connectionFailed')
  }
}

function handleResetCoach() {
  localCoachSkill.value = getCoachSkillDefault(currentLang())
  resetCoachSkill()
}

function handleResetAnalyze() {
  localAnalyzeSkill.value = getAnalyzeSkillDefault(currentLang())
  resetAnalyzeSkill()
}

// ─── Skill MD Import / Export ──────────────────────────────────────────────

function handleImportCoachMd(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    localCoachSkill.value = (ev.target?.result as string) ?? ''
    ;(e.target as HTMLInputElement).value = ''
  }
  reader.readAsText(file)
}

function handleExportCoachMd() {
  const blob = new Blob([localCoachSkill.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'coach-skill.md'; a.click()
  URL.revokeObjectURL(url)
}

function handleImportAnalyzeMd(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    localAnalyzeSkill.value = (ev.target?.result as string) ?? ''
    ;(e.target as HTMLInputElement).value = ''
  }
  reader.readAsText(file)
}

function handleExportAnalyzeMd() {
  const blob = new Blob([localAnalyzeSkill.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'analyze-skill.md'; a.click()
  URL.revokeObjectURL(url)
}

// ─── Template chip editor ──────────────────────────────────────────────────

function toggleChipEdit(idx: number) {
  editingChipIndex.value = editingChipIndex.value === idx ? -1 : idx
}

function moveChip(idx: number, dir: -1 | 1) {
  const arr = localTemplates.value
  const target = idx + dir
  if (target < 0 || target >= arr.length) return
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
}

function deleteChip(idx: number) {
  localTemplates.value.splice(idx, 1)
  if (editingChipIndex.value === idx) editingChipIndex.value = -1
  else if (editingChipIndex.value > idx) editingChipIndex.value--
}

function addChip() {
  localTemplates.value.push({ key: `custom-${Date.now()}`, icon: '✏️', label: { zh: '新模板', en: 'New Template' }, content: { zh: '', en: '' } })
  editingChipIndex.value = localTemplates.value.length - 1
}

function handleResetTemplates() {
  localTemplates.value = cloneTemplates(TEMPLATES)
  editingChipIndex.value = -1
  resetCustomTemplates()
}

function handleImportTemplates(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target?.result as string)
      if (!Array.isArray(data)) throw new Error('Not an array')
      const existingKeys = new Set(localTemplates.value.map(t => t.key))
      const incoming = data as TemplateDefinition[]
      const toAdd = incoming.filter(t => t.key && !existingKeys.has(t.key))
      localTemplates.value = [...localTemplates.value, ...cloneTemplates(toAdd)]
    } catch { /* ignore invalid */ }
    ;(e.target as HTMLInputElement).value = ''
  }
  reader.readAsText(file)
}

function handleExportTemplatesJson() {
  const blob = new Blob([JSON.stringify(localTemplates.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `template-chips-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  URL.revokeObjectURL(url)
}

// ─── Export / Import API Settings ─────────────────────────────────────────

function handleExport() {
  const data = {
    'provider-url': localProviderUrl.value,
    'glm-api-key': localApiKey.value,
    'glm-model': localModel.value
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `jira-agent-api-settings-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  URL.revokeObjectURL(url)
}

function handleImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target?.result as string)
      if (data['provider-url'] !== undefined) localProviderUrl.value = data['provider-url']
      if (data['glm-api-key'] !== undefined) localApiKey.value = data['glm-api-key']
      if (data['glm-model']) localModel.value = data['glm-model']
      // Skills and templates are imported independently via their own buttons
    } catch { /* ignore invalid JSON */ }
    ;(e.target as HTMLInputElement).value = ''
  }
  reader.readAsText(file)
}

function handleSave() {
  setProviderUrl(localProviderUrl.value)
  setApiKey(localApiKey.value.trim())
  setModel(localModel.value.trim() || GLM_DEFAULT_MODEL)
  setCoachSkill(localCoachSkill.value)
  setAnalyzeSkill(localAnalyzeSkill.value)
  const builtinJson = JSON.stringify(TEMPLATES)
  const localJson = JSON.stringify(localTemplates.value)
  if (localJson === builtinJson) resetCustomTemplates()
  else setCustomTemplates([...localTemplates.value])
  emit('saved')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background-color: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 5000; padding: 24px;
}
.modal-content {
  background-color: var(--bg-secondary); border: 1px solid var(--border-color);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-modal);
  padding: 24px; max-width: 800px; width: 100%;
  max-height: 88vh; overflow-y: auto; display: flex; flex-direction: column; gap: 20px;
  animation: scaleIn 0.2s ease-out;
}
.modal-title { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.field-group { display: flex; flex-direction: column; gap: 8px; transition: opacity 0.2s; }
.field-group.dimmed { opacity: 0.4; }
.field-label { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
.field-input {
  width: 100%; padding: 8px 12px; border-radius: var(--radius-md);
  border: 1px solid var(--border-color); background-color: var(--bg-tertiary);
  color: var(--text-primary); font-size: 13px; outline: none; box-sizing: border-box;
}
.field-input:focus { border-color: var(--accent-blue); }
.field-input:disabled { cursor: not-allowed; }

.toggle-group {
  display: flex; gap: 4px; padding: 4px; border-radius: var(--radius-md);
  background-color: var(--bg-tertiary); border: 1px solid var(--border-color);
}
.toggle-btn {
  flex: 1; padding: 6px 10px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500;
  background: transparent; color: var(--text-muted); transition: all 0.2s; border: none; cursor: pointer;
}
.toggle-btn.active { background-color: var(--accent-blue); color: white; }
.toggle-btn:hover:not(.active) { color: var(--text-primary); }

.modal-actions { display: flex; justify-content: flex-end; gap: 12px; }
.btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 20px; border-radius: var(--radius-md); font-size: 14px; font-weight: 500; transition: all 0.2s; border: none; cursor: pointer; }
.btn-ghost { background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); }
.btn-ghost:hover { background-color: var(--bg-tertiary); }
.btn-primary { background-color: var(--accent-blue); color: white; }
.btn-primary:hover { opacity: 0.9; }

.key-row { display: flex; gap: 8px; align-items: center; }
.key-row .field-input { flex: 1; }
.btn-test {
  flex-shrink: 0; padding: 8px 12px; border-radius: var(--radius-md);
  border: 1px solid var(--border-color); background: transparent; color: var(--text-secondary);
  font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-test:hover:not(:disabled) { border-color: var(--accent-blue); color: var(--accent-blue); }
.btn-test:disabled { opacity: 0.4; cursor: not-allowed; }
.key-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; }
.key-badge--valid { color: var(--accent-green); }
.key-badge--invalid { color: var(--accent-red, #f87171); }

.skill-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; }
.skill-label-row { display: flex; align-items: center; gap: 8px; }
.skill-actions { display: flex; align-items: center; gap: 6px; }
.skill-modified-badge { font-size: 10px; font-weight: 600; color: var(--accent-orange); }

.btn-reset {
  font-size: 11px; padding: 3px 8px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-color); background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.15s;
}
.btn-reset:hover:not(:disabled) { color: var(--text-primary); background: var(--bg-tertiary); }
.btn-reset:disabled { cursor: not-allowed; opacity: 0.4; }

.btn-skill-md {
  font-size: 11px; padding: 3px 8px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-color); background: transparent; color: var(--text-muted);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
  display: inline-flex; align-items: center;
}
.btn-skill-md:hover:not(:disabled):not(.disabled) { color: var(--accent-blue); border-color: var(--accent-blue); }
.btn-skill-md:disabled, .btn-skill-md.disabled { cursor: not-allowed; opacity: 0.4; }

.skill-textarea {
  width: 100%; height: 200px; padding: 8px 12px; resize: vertical;
  border-radius: var(--radius-md); border: 1px solid var(--border-color);
  background-color: var(--bg-tertiary); color: var(--text-primary);
  font-size: 12px; font-family: var(--font-mono); line-height: 1.6; outline: none; box-sizing: border-box;
}
.skill-textarea:focus { border-color: var(--accent-blue); }
.skill-textarea:disabled { cursor: not-allowed; opacity: 0.5; }
.skill-footer { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.skill-hint { font-size: 11px; color: var(--text-muted); }
.skill-counter { font-size: 11px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }

/* Template chip editor */
.template-details { list-style: none; }
.template-summary {
  cursor: pointer; display: flex; align-items: center; gap: 8px;
  padding: 4px 0; user-select: none;
}
.chip-list { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.chip-row {
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
  background-color: var(--bg-tertiary); overflow: hidden;
}
.chip-row-header {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  cursor: pointer; user-select: none;
}
.chip-row-header:hover { background-color: rgba(255,255,255,0.03); }
.chip-icon-preview { font-size: 16px; width: 22px; text-align: center; flex-shrink: 0; }
.chip-label-preview { flex: 1; font-size: 12px; color: var(--text-secondary); }
.chip-row-actions { display: flex; gap: 4px; flex-shrink: 0; }
.chip-act-btn {
  width: 22px; height: 22px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);
  background: transparent; color: var(--text-muted); font-size: 11px; cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center;
}
.chip-act-btn:hover:not(:disabled) { color: var(--text-primary); border-color: var(--text-secondary); }
.chip-act-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.chip-act-del:hover:not(:disabled) { color: var(--accent-red); border-color: var(--accent-red); }
.chip-edit-form { padding: 10px; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px; }
.chip-field-row { display: flex; gap: 6px; }
.chip-icon-input { width: 56px !important; flex-shrink: 0; text-align: center; }
.chip-content-area {
  width: 100%; height: 80px; padding: 6px 10px; resize: vertical;
  border-radius: var(--radius-md); border: 1px solid var(--border-color);
  background-color: var(--bg-secondary); color: var(--text-primary);
  font-size: 11px; font-family: var(--font-mono); line-height: 1.5; outline: none; box-sizing: border-box;
}
.chip-content-area:focus { border-color: var(--accent-blue); }
.chip-list-actions { display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
.btn-add-chip {
  flex: 1; padding: 7px 12px; border-radius: var(--radius-md); border: 1px dashed var(--border-color);
  background: transparent; color: var(--text-muted); font-size: 12px; cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center; white-space: nowrap; min-width: fit-content;
}
.btn-add-chip:hover { color: var(--accent-blue); border-color: var(--accent-blue); }
.btn-import-chip { cursor: pointer; }

/* Export / Import */
.export-row { display: flex; gap: 8px; }
.btn-export {
  flex: 1; padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);
  background: transparent; color: var(--text-secondary); font-size: 12px; font-weight: 500;
  cursor: pointer; transition: all 0.15s; text-align: center;
}
.btn-export:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
.btn-import { cursor: pointer; display: flex; align-items: center; justify-content: center; }

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
