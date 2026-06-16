<template>
  <div class="config-form">
    <header class="config-page-header">
      <h1 class="config-page-title">{{ t('config.skills') }}</h1>
      <p class="config-page-subtitle">{{ t('config.skillsSubtitle') }}</p>
    </header>

    <!-- Task Coach Skill -->
    <div class="field-group">
      <div class="skill-header">
        <div class="skill-label-row">
          <label class="field-label">{{ t('settings.taskCoachSkill') }}</label>
          <span v-if="activeTaskSkillFile" class="skill-layer-badge">{{ activeTaskSkillFile }}</span>
          <span v-if="coachSkillTaskModified" class="skill-modified-badge">● {{ t('settings.skillModified') }}</span>
        </div>
        <div class="skill-actions">
          <label class="btn-skill-md">
            {{ ICONS.importArrow }}{{ t('settings.importSkillMd') }}
            <input type="file" accept=".md,.txt" @change="handleImportTaskCoachMd" style="display:none" />
          </label>
          <button class="btn-skill-md" @click="handleExportTaskCoachMd">{{ ICONS.exportArrow }}{{ t('settings.exportSkillMd') }}</button>
          <button class="btn-reset" @click="handleResetTaskCoach">{{ t('settings.skillReset') }}</button>
        </div>
      </div>
      <textarea v-model="localTaskCoachSkill" class="skill-textarea" />
      <div class="skill-footer">
        <p class="skill-hint">{{ t('settings.skillHint') }}</p>
        <span class="skill-counter">{{ localTaskCoachSkill.length }} chars · ~{{ Math.floor(localTaskCoachSkill.length / 4) }} tokens</span>
      </div>
    </div>

    <!-- Task Analyze Skill -->
    <div class="field-group">
      <div class="skill-header">
        <div class="skill-label-row">
          <label class="field-label">{{ t('settings.analyzeSkill') }}</label>
          <span v-if="analyzeSkillModified" class="skill-modified-badge">● {{ t('settings.skillModified') }}</span>
        </div>
        <div class="skill-actions">
          <label class="btn-skill-md">
            {{ ICONS.importArrow }}{{ t('settings.importSkillMd') }}
            <input type="file" accept=".md,.txt" @change="handleImportAnalyzeMd" style="display:none" />
          </label>
          <button class="btn-skill-md" @click="handleExportAnalyzeMd">{{ ICONS.exportArrow }}{{ t('settings.exportSkillMd') }}</button>
          <button class="btn-reset" @click="handleResetAnalyze">{{ t('settings.skillReset') }}</button>
        </div>
      </div>
      <textarea v-model="localAnalyzeSkill" class="skill-textarea" />
      <div class="skill-footer">
        <p class="skill-hint">{{ t('settings.skillHint') }}</p>
        <span class="skill-counter">{{ localAnalyzeSkill.length }} chars · ~{{ Math.floor(localAnalyzeSkill.length / 4) }} tokens</span>
      </div>
    </div>

    <!-- Response Format Instructions -->
    <div class="field-group">
      <div class="skill-header">
        <div class="skill-label-row">
          <label class="field-label">{{ t('settings.responseFormat') }}</label>
          <span v-if="responseFormatModified" class="skill-modified-badge">● {{ t('settings.skillModified') }}</span>
        </div>
        <div class="skill-actions">
          <button class="btn-reset" @click="handleResetResponseFormat">{{ t('settings.skillReset') }}</button>
        </div>
      </div>
      <textarea v-model="localResponseFormat" class="skill-textarea" style="height: 180px;" />
      <div class="skill-footer">
        <p class="skill-hint">{{ t('settings.responseFormatHint') }}</p>
        <span class="skill-counter">{{ localResponseFormat.length }} chars · ~{{ Math.floor(localResponseFormat.length / 4) }} tokens</span>
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
            {{ ICONS.importArrow }}{{ t('settings.importTemplates') }}
            <input type="file" accept=".json" @change="handleImportTemplates" style="display:none" />
          </label>
          <button class="btn-add-chip" @click="handleExportTemplatesJson">{{ ICONS.exportArrow }}{{ t('settings.exportTemplatesJson') }}</button>
          <button class="btn-reset" @click="handleResetTemplates">{{ t('settings.templateReset') }}</button>
        </div>
      </div>
    </details>

    <div class="config-save-bar">
      <button class="btn btn-primary" @click="save">{{ t('settings.save') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from '@/i18n'
import { ICONS } from '@/config/icons'
import { useToast } from '@/composables/useToast'
import {
  getAnalyzeSkillRaw, setAnalyzeSkill, resetAnalyzeSkill, analyzeSkillModified,
  getCoachSkillTaskRaw, setCoachSkillTask, resetCoachSkillTask, coachSkillTaskModified,
  getAnalyzeSkillDefault, getCoachSkillTaskDefault,
  getResponseFormat, getResponseFormatDefault, setResponseFormat, resetResponseFormat, responseFormatModified,
  activeTaskLayer, activeTaskSkillFile
} from '@/config/skills/index'
import {
  TEMPLATES, setCustomTemplates, resetCustomTemplates, customTemplatesModified, effectiveTemplates
} from '@/config/templates/index'
import type { TemplateDefinition } from '@/types/template'

const props = defineProps<{ active?: boolean }>()

const { t, isZh } = useI18n()
const { addToast } = useToast()

function currentLang(): 'zh' | 'en' { return isZh.value ? 'zh' : 'en' }

const localTaskCoachSkill = ref(getCoachSkillTaskRaw(currentLang()))
const localAnalyzeSkill = ref(getAnalyzeSkillRaw(currentLang()))
const localResponseFormat = ref(getResponseFormat())

function cloneTemplates(arr: TemplateDefinition[]): TemplateDefinition[] {
  return arr.map(c => ({ ...c, label: { ...c.label }, content: { ...c.content } }))
}
const localTemplates = ref<TemplateDefinition[]>(cloneTemplates(effectiveTemplates.value))
const editingChipIndex = ref(-1)

// Re-sync from storage when this page becomes active (mirrors the modal's reload-on-open).
watch(() => props.active, (on) => {
  if (!on) return
  const lang = currentLang()
  localTaskCoachSkill.value = getCoachSkillTaskRaw(lang)
  localAnalyzeSkill.value = getAnalyzeSkillRaw(lang)
  localResponseFormat.value = getResponseFormat()
  localTemplates.value = cloneTemplates(effectiveTemplates.value)
  editingChipIndex.value = -1
})

// Language switch → reload skills to the right-language default (unless overridden).
watch(isZh, () => {
  if (!coachSkillTaskModified.value) localTaskCoachSkill.value = getCoachSkillTaskRaw(currentLang())
  if (!analyzeSkillModified.value) localAnalyzeSkill.value = getAnalyzeSkillRaw(currentLang())
})

// Active task layer changed → reload task coach skill (only if not overridden).
watch(activeTaskLayer, () => {
  if (!coachSkillTaskModified.value) localTaskCoachSkill.value = getCoachSkillTaskRaw(currentLang())
})

function handleResetTaskCoach() {
  localTaskCoachSkill.value = getCoachSkillTaskDefault(currentLang())
  resetCoachSkillTask()
}
function handleResetAnalyze() {
  localAnalyzeSkill.value = getAnalyzeSkillDefault(currentLang())
  resetAnalyzeSkill()
}
function handleResetResponseFormat() {
  localResponseFormat.value = getResponseFormatDefault()
  resetResponseFormat()
}

// ─── Skill MD import / export ──────────────────────────────────────────────
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
  download(localAnalyzeSkill.value, 'analyze-skill.md', 'text/markdown')
}
function handleImportTaskCoachMd(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    localTaskCoachSkill.value = (ev.target?.result as string) ?? ''
    ;(e.target as HTMLInputElement).value = ''
  }
  reader.readAsText(file)
}
function handleExportTaskCoachMd() {
  download(localTaskCoachSkill.value, 'coach-skill-task.md', 'text/markdown')
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
  localTemplates.value.push({ key: `custom-${Date.now()}`, icon: ICONS.templateNewChip, label: { zh: '新模板', en: 'New Template' }, content: { zh: '', en: '' } })
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
      const existingKeys = new Set(localTemplates.value.map(c => c.key))
      const incoming = data as TemplateDefinition[]
      const toAdd = incoming.filter(c => c.key && !existingKeys.has(c.key))
      localTemplates.value = [...localTemplates.value, ...cloneTemplates(toAdd)]
    } catch { /* ignore invalid */ }
    ;(e.target as HTMLInputElement).value = ''
  }
  reader.readAsText(file)
}
function handleExportTemplatesJson() {
  download(JSON.stringify(localTemplates.value, null, 2), `template-chips-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function save() {
  setCoachSkillTask(localTaskCoachSkill.value)
  setAnalyzeSkill(localAnalyzeSkill.value)
  setResponseFormat(localResponseFormat.value)
  const builtinJson = JSON.stringify(TEMPLATES)
  const localJson = JSON.stringify(localTemplates.value)
  if (localJson === builtinJson) resetCustomTemplates()
  else setCustomTemplates([...localTemplates.value])
  addToast('success', t('settings.saved'))
}
</script>
