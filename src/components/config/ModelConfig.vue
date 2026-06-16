<template>
  <div class="config-form">
    <header class="config-page-header">
      <h1 class="config-page-title">{{ t('config.model') }}</h1>
      <p class="config-page-subtitle">{{ t('config.modelSubtitle') }}</p>
    </header>

    <!-- Provider Base URL -->
    <div class="field-group">
      <label class="field-label">{{ t('settings.providerUrl') }}</label>
      <input v-model="localProviderUrl" type="text" class="field-input" :placeholder="t('settings.providerUrlPlaceholder')" />
    </div>

    <!-- API Key -->
    <div class="field-group">
      <label class="field-label">{{ t('settings.apiKey') }}</label>
      <div class="key-row">
        <input v-model="localApiKey" type="password" class="field-input" :placeholder="t('settings.apiKeyPlaceholder')" />
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

    <!-- Model Name — two slots: Model 1 (Task + default Explore), Model 2 (selectable in Explore) -->
    <div class="field-group">
      <label class="field-label">{{ t('settings.model') }}</label>
      <div class="model-row">
        <div class="model-col">
          <input v-model="localModel1" type="text" list="model-presets" class="field-input" :placeholder="t('settings.modelPlaceholder')" autocomplete="off" />
          <span class="model-caption">{{ t('settings.modelTask') }}</span>
        </div>
        <div class="model-col">
          <input v-model="localModel2" type="text" list="model-presets" class="field-input" :placeholder="t('settings.modelPlaceholder')" autocomplete="off" />
          <span class="model-caption">{{ t('settings.modelSecondary') }}</span>
        </div>
      </div>
      <datalist id="model-presets">
        <option v-for="model in allModelPresets" :key="model" :value="model" />
      </datalist>
    </div>

    <!-- Export / Import API Settings -->
    <div class="field-group">
      <label class="field-label">{{ t('settings.exportImport') }}</label>
      <div class="export-row">
        <button class="btn-export" @click="handleExport">{{ ICONS.exportArrow }}{{ t('settings.exportSettings') }}</button>
        <label class="btn-export btn-import">
          {{ ICONS.importArrow }}{{ t('settings.importSettings') }}
          <input type="file" accept=".json" @change="handleImport" style="display:none" />
        </label>
      </div>
    </div>

    <div class="config-save-bar">
      <button class="btn btn-primary" @click="save">{{ t('settings.save') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from '@/i18n'
import { ICONS } from '@/config/icons'
import { useToast } from '@/composables/useToast'
import {
  getApiKey, setApiKey, getModel1, getModel2, setModel1, setModel2,
  getProviderUrl, setProviderUrl,
  GLM_BASE_URL, GLM_DEFAULT_MODEL, LLM_MODEL_PRESETS
} from '@/config/llm'

const props = defineProps<{ active?: boolean }>()

const { t } = useI18n()
const { addToast } = useToast()

const localApiKey = ref(getApiKey())
const localModel1 = ref(getModel1())
const localModel2 = ref(getModel2())
const localProviderUrl = ref(localStorage.getItem('provider-url') ?? '')

const allModelPresets = computed(() => LLM_MODEL_PRESETS.flatMap(g => g.models))

type ValidationState = 'idle' | 'testing' | 'valid' | 'invalid'
const validationState = ref<ValidationState>('idle')
const validationError = ref('')

watch(localApiKey, () => { validationState.value = 'idle'; validationError.value = '' })

// Re-sync from storage whenever this page becomes active (mirrors the old modal's
// reload-on-open) so external changes (or another save) are reflected.
watch(() => props.active, (on) => {
  if (!on) return
  localApiKey.value = getApiKey()
  localModel1.value = getModel1()
  localModel2.value = getModel2()
  localProviderUrl.value = localStorage.getItem('provider-url') ?? ''
  validationState.value = 'idle'
  validationError.value = ''
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
      body: JSON.stringify({ model: localModel1.value.trim() || GLM_DEFAULT_MODEL, stream: false, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 })
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

function handleExport() {
  const data = {
    'provider-url': localProviderUrl.value,
    'glm-api-key': localApiKey.value,
    'model-1': localModel1.value,
    'model-2': localModel2.value
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
      // Two model slots; fall back to the legacy single `glm-model` for old files.
      if (data['model-1']) localModel1.value = data['model-1']
      else if (data['glm-model']) localModel1.value = data['glm-model']
      if (data['model-2'] !== undefined) localModel2.value = data['model-2']
    } catch { /* ignore invalid JSON */ }
    ;(e.target as HTMLInputElement).value = ''
  }
  reader.readAsText(file)
}

function save() {
  setProviderUrl(localProviderUrl.value)
  setApiKey(localApiKey.value.trim())
  setModel1(localModel1.value.trim() || GLM_DEFAULT_MODEL)
  setModel2(localModel2.value.trim())
  addToast('success', t('settings.saved'))
}
</script>
