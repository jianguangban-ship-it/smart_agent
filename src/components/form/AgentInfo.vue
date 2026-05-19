<template>
  <div class="agent-info">
    <div class="agent-title">{{ ICONS.devAgent }} {{ t('dev.agentState') }}</div>

    <!-- 2-column telemetry grid (row-major pairing: left, right, left, right…) -->
    <div class="agent-grid">
      <!-- L1 -->
      <div class="config-row">
        <span class="config-label">{{ t('dev.model') }}:</span>
        <code class="config-url">{{ currentModel }}</code>
      </div>
      <!-- R1 -->
      <div class="config-row">
        <span class="config-label">{{ t('dev.coach') }} {{ t('dev.streaming') }}:</span>
        <span :style="{ color: props.isTaskCoachLoading ? 'var(--accent-green)' : 'var(--text-muted)' }">
          {{ props.isTaskCoachLoading ? t('dev.yes') : t('dev.no') }}
          <span v-if="props.isTaskCoachLoading && props.taskCoachStreamSpeed > 0" class="speed">
            {{ props.taskCoachStreamSpeed }} {{ t('dev.streamSpeed') }}
          </span>
        </span>
      </div>

      <!-- L2 -->
      <div class="config-row">
        <span class="config-label">{{ t('dev.activeRole') }}:</span>
        <span class="role-val">{{ currentRoleDefinition ? (isZh ? currentRoleDefinition.labelZh : currentRoleDefinition.labelEn) : '—' }}</span>
      </div>
      <!-- R2 -->
      <div class="config-row">
        <span class="config-label">{{ t('dev.analyze') }} {{ t('dev.streaming') }}:</span>
        <span :style="{ color: props.isAnalyzeLoading ? 'var(--accent-purple)' : 'var(--text-muted)' }">
          {{ props.isAnalyzeLoading ? t('dev.yes') : t('dev.no') }}
          <span v-if="props.isAnalyzeLoading && props.analyzeStreamSpeed > 0" class="speed">
            {{ props.analyzeStreamSpeed }} {{ t('dev.streamSpeed') }}
          </span>
        </span>
      </div>

      <!-- L3 -->
      <div class="config-row">
        <span class="config-label">{{ t('dev.activeSkill') }}:</span>
        <span :style="{ color: activeSkill ? 'var(--accent-purple)' : (activeTaskSkillName ? 'var(--accent-blue)' : 'var(--text-muted)') }">
          {{ displaySkill }}
        </span>
        <span v-if="coachSkillTaskModified" class="modified-tag">[{{ t('settings.skillModified') }}]</span>
      </div>
      <!-- R3 -->
      <div class="config-row">
        <span class="config-label">{{ t('dev.coachErrorCancel') }}:</span>
        <span :style="{ color: props.taskCoachHadError ? 'var(--accent-red)' : props.taskCoachWasCancelled ? 'var(--accent-orange)' : 'var(--text-muted)' }">
          {{ props.taskCoachHadError ? t('dev.error') : props.taskCoachWasCancelled ? t('dev.cancelled') : t('dev.no') }}
        </span>
      </div>

      <!-- L4 -->
      <div class="config-row">
        <span class="config-label">{{ t('dev.analyzeSkill') }}:</span>
        <span :style="{ color: analyzeSkillModified ? 'var(--accent-orange)' : 'var(--text-muted)' }">
          {{ analyzeSkillModified ? t('settings.skillModified') : t('dev.no') }}
        </span>
      </div>
      <!-- R4 -->
      <div class="config-row">
        <span class="config-label">{{ t('dev.analyzeErrorCancel') }}:</span>
        <span :style="{ color: props.analyzeHadError ? 'var(--accent-red)' : props.analyzeWasCancelled ? 'var(--accent-orange)' : 'var(--text-muted)' }">
          {{ props.analyzeHadError ? t('dev.error') : props.analyzeWasCancelled ? t('dev.cancelled') : t('dev.no') }}
        </span>
      </div>

      <!-- Backoff (429 countdown) — full width, only while active -->
      <div v-if="props.taskCoachBackoffSecs > 0 || props.analyzeBackoffSecs > 0" class="config-row backoff-row">
        <span class="config-label">{{ t('dev.backoff') }}:</span>
        <span style="color: var(--accent-orange)">
          <span v-if="props.taskCoachBackoffSecs > 0">{{ t('dev.coach') }} {{ props.taskCoachBackoffSecs }}s</span>
          <span v-if="props.analyzeBackoffSecs > 0" style="margin-left: 8px">{{ t('dev.analyze') }} {{ props.analyzeBackoffSecs }}s</span>
        </span>
      </div>
    </div>

    <!-- JIRA result (full-width, unchanged) -->
    <template v-if="jiraResponse">
      <div class="state-divider" />
      <div class="agent-jira">
        <div class="config-row">
          <span class="config-label">JIRA:</span>
          <a v-if="jiraKey" :href="'https://jira.gwm.cn/browse/' + jiraKey" target="_blank" rel="noopener noreferrer" class="jira-key-link">{{ jiraKey }}</a>
          <span v-else class="muted">—</span>
        </div>
        <div v-if="jiraAiPoints != null" class="config-row">
          <span class="config-label">AI Points:</span>
          <span class="points-val">{{ jiraAiPoints }}</span>
        </div>
        <div v-if="jiraViewUrl" class="config-row">
          <span class="config-label">View:</span>
          <a :href="jiraViewUrl" target="_blank" rel="noopener noreferrer" class="jira-view-link">{{ jiraViewUrl }}</a>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { ICONS } from '@/config/icons'
import { currentModel } from '@/config/llm'
import { currentRoleDefinition } from '@/composables/useRole'
import { activeSkill } from '@/composables/useLLM'
import { activeTaskSkillName, activeTaskSkillFile, coachSkillTaskModified, analyzeSkillModified } from '@/config/skills'

// Per-channel runtime telemetry is threaded as props from App.vue (single
// useLLM() instance) → TaskForm → here, consistent with jiraResponse. All
// optional with safe defaults so existing mounts/tests stay valid.
const props = withDefaults(defineProps<{
  jiraResponse?: unknown
  isTaskCoachLoading?: boolean
  taskCoachStreamSpeed?: number
  taskCoachHadError?: boolean
  taskCoachWasCancelled?: boolean
  taskCoachBackoffSecs?: number
  isAnalyzeLoading?: boolean
  analyzeStreamSpeed?: number
  analyzeHadError?: boolean
  analyzeWasCancelled?: boolean
  analyzeBackoffSecs?: number
}>(), {
  isTaskCoachLoading: false,
  taskCoachStreamSpeed: 0,
  taskCoachHadError: false,
  taskCoachWasCancelled: false,
  taskCoachBackoffSecs: 0,
  isAnalyzeLoading: false,
  analyzeStreamSpeed: 0,
  analyzeHadError: false,
  analyzeWasCancelled: false,
  analyzeBackoffSecs: 0,
})

const { t, isZh } = useI18n()

// Shows the layer-routed task coach skill with its source file name, e.g.
// "Task Coach (SYS) - coach-skill-task-sys-en.md". Mirrors the v10.113
// additive assembly: a matched registry skill is appended as "+ <specialty>".
const displaySkill = computed(() => {
  const base = activeTaskSkillName.value
  const file = activeTaskSkillFile.value
  const appended = activeSkill.value?.name
  if (!base && !appended) return '—'
  const baseLabel = base ? (file ? `${base} - ${file}` : base) : ''
  if (baseLabel && appended) return `${baseLabel} + ${appended}`
  return baseLabel || appended || '—'
})

// JIRA response parsed fields (same logic as the removed DevTools Agent State)
const parsedJira = computed(() => {
  if (!props.jiraResponse) return null
  try {
    return typeof props.jiraResponse === 'string' ? JSON.parse(props.jiraResponse) : props.jiraResponse
  } catch { return null }
})
const jiraKey = computed(() => (parsedJira.value as Record<string, string>)?.key || '')
const jiraAiPoints = computed(() => {
  const pts = (parsedJira.value as Record<string, unknown>)?.ai_points
  return typeof pts === 'number' ? pts : null
})
const jiraViewUrl = computed(() => (parsedJira.value as Record<string, string>)?.view_tasks_created || '')
</script>

<style scoped>
.agent-info {
  padding: var(--space-5);
  border-top: 1px solid var(--border-color);
}
.agent-title {
  font-size: var(--font-sm);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: var(--space-3);
}
.agent-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px var(--space-5);
  font-size: 12px;
}
/* Collapse to a single column when the middle column is narrowed */
@media (max-width: 620px) {
  .agent-grid { grid-template-columns: 1fr; }
}
.backoff-row {
  grid-column: 1 / -1;
}
.agent-jira {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12px;
}
.config-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.config-label {
  color: var(--text-muted);
  min-width: 110px;
  flex-shrink: 0;
}
.config-url {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-tertiary);
  color: var(--accent-blue);
  font-family: var(--font-mono);
  font-size: 11px;
}
.role-val {
  color: var(--accent-blue);
  font-weight: 600;
}
.points-val {
  color: var(--accent-green);
  font-weight: 600;
}
.modified-tag {
  color: var(--accent-orange);
  font-size: 10px;
  font-weight: 600;
}
.speed {
  color: var(--accent-green);
  font-size: 11px;
  margin-left: 4px;
}
.muted {
  color: var(--text-muted);
}
.state-divider {
  border-top: 1px dashed var(--border-color);
  margin: var(--space-3) 0;
}
.jira-key-link {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-blue);
  text-decoration: none;
}
.jira-key-link:hover { text-decoration: underline; }
.jira-view-link {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent-blue);
  text-decoration: none;
  word-break: break-all;
}
.jira-view-link:hover { text-decoration: underline; }
</style>
