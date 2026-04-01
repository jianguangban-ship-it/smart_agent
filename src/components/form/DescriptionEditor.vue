<template>
  <div class="description-editor">
    <h2 class="section-title" :class="{ 'section-title--explore': appMode === 'explore' }">
      {{ appMode === 'explore' ? t('form.exploreDescription') : t('form.taskDescription') }}
      <span class="required-tag">* {{ t('form.required') }}</span>
    </h2>
    <textarea
      ref="textareaRef"
      v-model="model"
      class="input-base desc-textarea"
      :placeholder="appMode === 'explore' ? t('form.exploreDescriptionPlaceholder') : t('form.taskDescriptionPlaceholder')"
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
    <TransitionGroup name="warn-list" tag="div" class="incose-violations" v-if="incoseViolations.length">
      <div
        v-for="v in incoseViolations"
        :key="v.ruleId"
        class="incose-item"
        :class="'incose-' + v.severity"
      >
        <span class="incose-tag">{{ isZh ? v.titleZh : v.titleEn }}</span>
        <span class="incose-msg">{{ isZh ? v.messageZh : v.messageEn }}</span>
      </div>
    </TransitionGroup>
    <TransitionGroup name="warn-list" tag="div" class="assumption-list" v-if="assumptions.length">
      <div
        v-for="a in assumptions"
        :key="a.id"
        class="assumption-item"
      >
        <span class="assumption-cat">{{ isZh ? a.categoryZh : a.categoryEn }}</span>
        <div class="assumption-body">
          <span class="assumption-msg">{{ isZh ? a.messageZh : a.messageEn }}</span>
          <span class="assumption-fix">{{ isZh ? a.suggestionZh : a.suggestionEn }}</span>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from '@/i18n'
import { appMode } from '@/composables/useAppMode'
import { useAttachment } from '@/composables/useAttachment'
import type { QualityViolation, Assumption } from '@/config/domain'

const props = defineProps<{
  incoseViolations: QualityViolation[]
  assumptions: Assumption[]
}>()

const model = defineModel<string>({ required: true })
const { t, isZh } = useI18n()
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
  el.style.height = el.scrollHeight + 'px'
}

watch(model, () => nextTick(autoGrow))

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

/* INCOSE violations */
.incose-violations {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 6px;
}
.incose-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  line-height: 1.4;
}
.incose-error {
  background-color: var(--red-subtle, rgba(239, 68, 68, 0.08));
}
.incose-warning {
  background-color: var(--orange-subtle, rgba(251, 191, 36, 0.06));
}
.incose-tag {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
  padding: 0 4px;
  border-radius: 2px;
  white-space: nowrap;
  flex-shrink: 0;
}
.incose-error .incose-tag {
  background-color: var(--accent-red);
  color: white;
}
.incose-warning .incose-tag {
  background-color: var(--accent-orange);
  color: white;
}
.incose-msg {
  color: var(--text-secondary);
}

/* Assumption detector */
.assumption-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 6px;
}
.assumption-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  line-height: 1.4;
  background-color: var(--purple-subtle, rgba(167, 139, 250, 0.06));
}
.assumption-cat {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
  padding: 0 4px;
  border-radius: 2px;
  white-space: nowrap;
  flex-shrink: 0;
  background-color: var(--accent-purple, #a78bfa);
  color: white;
}
.assumption-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.assumption-msg {
  color: var(--text-secondary);
}
.assumption-fix {
  color: var(--accent-purple, #a78bfa);
  font-style: italic;
  font-size: 10px;
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

/* Transition */
.warn-list-enter-active,
.warn-list-leave-active {
  transition: all 0.25s ease;
}
.warn-list-enter-from,
.warn-list-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
