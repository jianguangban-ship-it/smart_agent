<template>
  <div class="description-editor">
    <h2 class="section-title">
      {{ t('form.taskDescription') }}
      <span class="required-tag">* {{ t('form.required') }}</span>
    </h2>
    <textarea
      ref="textareaRef"
      v-model="model"
      class="input-base desc-textarea"
      :placeholder="t('form.descriptionPlaceholder')"
    ></textarea>
    <div class="desc-footer">
      <span class="desc-counter">{{ wordCount }} {{ t('form.descWords') }} · {{ sentenceCount }} {{ t('form.descSentences') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from '@/i18n'

const model = defineModel<string>({ required: true })
const { t } = useI18n()
const textareaRef = ref<HTMLTextAreaElement>()

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
  justify-content: flex-end;
  margin-top: 4px;
}
.desc-counter {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.7;
}
</style>
