<template>
  <div class="basic-info">
    <h2 class="section-title">{{ t('form.basicInfo') }}</h2>

    <div class="row-2col">
      <!-- Project -->
      <div class="field">
        <label class="field-label" for="basic-project">{{ t('form.projectName') }}</label>
        <select id="basic-project" v-model="form.projectKey" @change="$emit('projectChange')" class="input-base field-select">
          <option v-for="project in PROJECT_CONFIG" :key="project.key" :value="project.key">
            {{ project.name }} ({{ project.teamName }})
          </option>
        </select>
      </div>
      <!-- Assignee -->
      <div class="field">
        <label class="field-label">
          {{ t('form.assignee') }}
          <span class="field-hint">· {{ memberCount }} {{ t('form.members') }}</span>
        </label>
        <AssigneeCombobox
          :model-value="form.assignee"
          @update:model-value="form.assignee = $event"
          :items="teamMembers"
          :selected-name="selectedAssigneeName"
          :placeholder="t('form.searchAssignee')"
          :group-label="teamName"
          :results-label="t('form.results')"
          :no-results-label="t('form.noResults')"
        />
      </div>
    </div>

    <!-- Task type & Story points -->
    <div class="row-2col mt">
      <div class="field">
        <label class="field-label">{{ t('form.taskType') }}</label>
        <div class="type-buttons" role="group" :aria-label="t('form.taskType')" ref="typeGroupRef" @keydown="typeRoving.handleKeydown">
          <button
            v-for="type in TASK_TYPES"
            :key="type.value"
            @click="form.issueType = type.value"
            class="type-btn"
            :style="{
              backgroundColor: form.issueType === type.value ? type.bgActive : 'var(--bg-tertiary)',
              borderColor: form.issueType === type.value ? type.color : 'var(--border-color)',
              color: form.issueType === type.value ? type.color : 'var(--text-secondary)'
            }"
          >
            <span class="type-dot" :style="{ backgroundColor: type.color }"></span>
            {{ type.label }}
          </button>
        </div>
      </div>
      <div class="field">
        <label class="field-label">
          {{ t('form.storyPoints') }}
          <span class="field-hint">· {{ t('form.aiWillVerify') }}</span>
        </label>
        <StoryPointsPicker v-model="form.estimatedPoints" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FormState } from '@/types/form'
import type { TeamMember } from '@/types/team'
import { PROJECT_CONFIG, TEAM_MEMBERS } from '@/config/projects'
import { TASK_TYPES } from '@/config/constants'
import { useI18n } from '@/i18n'
import AssigneeCombobox from './AssigneeCombobox.vue'
import StoryPointsPicker from './StoryPointsPicker.vue'
import { useRovingIndex } from '@/composables/useRovingIndex'

const props = defineProps<{
  form: FormState
}>()

defineEmits<{
  projectChange: []
}>()

const { t } = useI18n()

const typeGroupRef = ref<HTMLElement>()
const typeRoving = useRovingIndex(typeGroupRef)

const teamMembers = computed<TeamMember[]>(() => TEAM_MEMBERS[props.form.projectKey] || [])
const memberCount = computed(() => teamMembers.value.length)
const teamName = computed(() => PROJECT_CONFIG.find(p => p.key === props.form.projectKey)?.teamName || '')
const selectedAssigneeName = computed(() => {
  if (!props.form.assignee) return ''
  return teamMembers.value.find(u => u.id === props.form.assignee)?.name || ''
})
</script>

<style scoped>
.basic-info {
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}
.section-title {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.mt {
  margin-top: 12px;
}
.field-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.field-hint {
  color: var(--text-muted);
  margin-left: 4px;
}
.field-select {
  font-size: 14px;
  cursor: pointer;
}
.type-buttons {
  display: flex;
  gap: 8px;
}
.type-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  font-size: 14px;
  transition: all 0.2s;
}
.type-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

@media (max-width: 768px) {
  .row-2col {
    grid-template-columns: 1fr;
  }
}
</style>
