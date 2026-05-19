<template>
  <div class="description-editor" :class="{ 'description-editor--composer': variant === 'composer' }">
    <h2
      v-if="variant !== 'composer'"
      class="section-title"
      :class="{ 'section-title--explore': appMode === 'explore' }"
    >
      {{ appMode === 'explore' ? t('form.exploreDescription') : t('form.taskDescription') }}
      <span class="required-tag">* {{ t('form.required') }}</span>
    </h2>
    <textarea
      ref="textareaRef"
      v-model="model"
      class="input-base desc-textarea"
      :class="{ 'desc-textarea--composer': variant === 'composer' }"
      :placeholder="appMode === 'explore' ? t('form.exploreDescriptionPlaceholder') : t('form.taskDescriptionPlaceholder')"
      @focus="emit('focus')"
      @blur="emit('blur')"
      @keydown="onKeydown"
    ></textarea>
    <div class="desc-footer">
      <div class="desc-footer-left">
        <button
          v-if="appMode === 'explore'"
          class="attach-btn"
          :title="t('form.attachFile')"
          @click="openFilePicker"
        >
          <svg class="attach-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.49"/>
          </svg>
          <span class="attach-label">.md</span>
        </button>
        <Transition name="chip-fade">
          <span v-if="hasAttachment && attachedFile" class="attach-chip">
            <svg class="attach-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
            </svg>
            {{ attachedFile.name }}
            <button class="attach-remove" @click="detach" :title="t('form.removeAttachment')">×</button>
          </span>
        </Transition>
      </div>
      <span class="desc-counter">{{ wordCount }} {{ t('form.descWords') }} · {{ sentenceCount }} {{ t('form.descSentences') }}</span>
      <input
        ref="fileInputRef"
        type="file"
        accept=".md,.markdown,.txt"
        class="hidden-file-input"
        @change="handleFileSelect"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from '@/i18n'
import { appMode } from '@/composables/useAppMode'
import { useAttachment } from '@/composables/useAttachment'

const props = withDefaults(defineProps<{
  /** 'form' = full section with title/border (Task center column).
      'composer' = compact, no title, auto-grow capped (pinned chat composer). */
  variant?: 'form' | 'composer'
}>(), { variant: 'form' })

const emit = defineEmits<{ focus: [], blur: [], submit: [] }>()
const model = defineModel<string>({ required: true })
const { t } = useI18n()
const { attachedFile, attach, detach, hasAttachment } = useAttachment()

const textareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement>()

function openFilePicker() {
  fileInputRef.value?.click()
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await attach(file)
  // Reset so the same file can be re-selected
  input.value = ''
}

function autoGrow() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  // Composer variant grows up to a cap, then scrolls (mirrors Explore's autosize).
  const cap = props.variant === 'composer' ? 200 : Infinity
  el.style.height = Math.min(el.scrollHeight, cap) + 'px'
}

watch(model, () => nextTick(autoGrow))

// Enter submits (composer only); Shift+Enter inserts a newline. The
// `isComposing` guard is essential for the bilingual (Chinese) IME: pressing
// Enter to confirm a pinyin candidate must NOT submit the message.
function onKeydown(e: KeyboardEvent) {
  if (props.variant !== 'composer') return
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    emit('submit')
  }
}

const wordCount = computed(() =>
  model.value.trim() ? model.value.trim().split(/\s+/).filter(Boolean).length : 0
)

const sentenceCount = computed(() =>
  model.value.trim() ? model.value.split(/[.!?。！？]+/).filter(s => s.trim()).length : 0
)
</script>

<style scoped>
.description-editor {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}
.section-title {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.section-title--explore {
  color: var(--text-primary);
}
.required-tag {
  font-weight: 400;
  text-transform: none;
  color: var(--accent-orange);
}
.desc-textarea {
  min-height: 160px;
  resize: none;
  font-size: 14px;
  overflow: hidden;
}

/* Composer variant: compact, no title/border, auto-grow capped then scroll. */
.description-editor--composer {
  padding: 0;
  border-bottom: none;
}
.desc-textarea--composer {
  min-height: 44px;
  max-height: 200px;
  overflow-y: auto;
}
.desc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  gap: 8px;
}
.desc-footer-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.desc-counter {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.7;
  flex-shrink: 0;
}
.hidden-file-input {
  display: none;
}

/* Attach button */
.attach-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
  transition: all 0.15s ease;
}
.attach-btn:hover {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
  background: var(--blue-subtle, rgba(96, 165, 250, 0.08));
}
.attach-icon {
  width: 13px;
  height: 13px;
}
.attach-label {
  font-family: var(--font-mono);
  font-weight: 600;
}

/* Attached file chip */
.attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 4px;
  border-radius: var(--radius-sm);
  background: var(--blue-subtle, rgba(96, 165, 250, 0.1));
  border: 1px solid var(--accent-blue);
  color: var(--accent-blue);
  font-size: 11px;
  font-family: var(--font-mono);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attach-chip-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}
.attach-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--accent-blue);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.15s;
}
.attach-remove:hover {
  background: rgba(96, 165, 250, 0.2);
}

/* Chip fade transition */
.chip-fade-enter-active,
.chip-fade-leave-active {
  transition: all 0.2s ease;
}
.chip-fade-enter-from,
.chip-fade-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* ASPICE suggestions */
.aspice-suggestions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}
.aspice-label {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background-color: var(--accent-blue);
  color: white;
  margin-right: 2px;
}
.aspice-field {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}
.aspice-field.aspice-required {
  border-color: var(--accent-orange);
  color: var(--accent-orange);
}

/* Domain warnings */
.domain-warnings {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}
.domain-warning {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  line-height: 1.4;
}
.dw-warning {
  background-color: var(--orange-subtle, rgba(251, 191, 36, 0.08));
  color: var(--accent-orange);
}
.dw-info {
  background-color: var(--blue-subtle, rgba(96, 165, 250, 0.08));
  color: var(--accent-blue);
}
.dw-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}
.dw-text {
  flex: 1;
}
</style>
