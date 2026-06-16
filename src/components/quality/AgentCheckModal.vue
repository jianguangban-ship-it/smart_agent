<template>
  <Transition name="modal">
    <div
      v-if="ticket"
      class="modal-overlay"
      ref="modalRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-check-title"
      @click.self="$emit('close')"
      @keydown.esc="$emit('close')"
    >
      <div class="modal-content">
        <header class="modal-header">
          <div class="modal-title-wrap">
            <StatusBadge :status="ticket.status" />
            <h3 id="agent-check-title" class="modal-title">
              <a
                class="issue-link"
                :href="`https://jira.gwm.cn/browse/${ticket.issueKey}`"
                target="_blank"
                rel="noopener"
              >{{ ticket.issueKey }}</a>
              <span class="modal-subtitle">{{ ticket.summary }}</span>
            </h3>
          </div>
          <button class="close-btn" @click="$emit('close')" :aria-label="t('view.closeDetail')">×</button>
        </header>

        <div class="modal-meta">
          <span><strong>{{ t('view.colTeam') }}:</strong> {{ ticket.team }} ({{ ticket.team_key }})</span>
          <span><strong>{{ t('view.colAssignee') }}:</strong> {{ ticket.displayName }}</span>
          <span><strong>{{ t('view.colType') }}:</strong> {{ ticket.issueType }}</span>
          <span><strong>{{ t('view.colPoints') }}:</strong> {{ ticket.points }}</span>
          <span><strong>{{ t('view.colTime') }}:</strong> {{ formatTime(ticket.timestamp) }}</span>
        </div>

        <div class="modal-body markdown-body" v-html="renderedAgentCheck"></div>

        <footer class="modal-footer">
          <a
            class="btn btn-primary"
            :href="`https://jira.gwm.cn/browse/${ticket.issueKey}`"
            target="_blank"
            rel="noopener"
          >{{ t('view.openInJira') }}</a>
          <button class="btn btn-ghost" @click="$emit('close')">{{ t('view.closeDetail') }}</button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<script lang="ts">
import { renderMarkdown } from '@/utils/markdown'

/**
 * v10.186: content-keyed LRU over renderMarkdown — reopening a ticket skips
 * the full unified + DOMPurify pipeline. Keyed by the raw agentCheck string
 * (not issueKey) so refetched/updated tickets stay correct automatically:
 * same content hits, changed content misses. Module scope (plain script
 * block): survives the modal unmounting on app-mode switches.
 */
const MD_CACHE_MAX = 50
const mdCache = new Map<string, string>()
function renderMarkdownCached(text: string): string {
  const hit = mdCache.get(text)
  if (hit !== undefined) {
    mdCache.delete(text) // LRU bump to most-recent
    mdCache.set(text, hit)
    return hit
  }
  const html = renderMarkdown(text)
  mdCache.set(text, html)
  if (mdCache.size > MD_CACHE_MAX) {
    mdCache.delete(mdCache.keys().next().value!)
  }
  return html
}
</script>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from '@/i18n'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { formatTime } from '@/utils/formatTime'
import StatusBadge from './StatusBadge.vue'
import type { QualityTicket } from '@/types/quality'

const props = defineProps<{ ticket: QualityTicket | null }>()
defineEmits<{ close: [] }>()

const { t } = useI18n()
const modalRef = ref<HTMLElement>()
const { activate, deactivate } = useFocusTrap(modalRef)

watch(() => props.ticket, async (val) => {
  if (val) {
    await nextTick()
    activate()
  } else {
    deactivate()
  }
})

const renderedAgentCheck = computed(() =>
  props.ticket ? renderMarkdownCached(props.ticket.agentCheck) : ''
)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5500;
  padding: var(--space-6);
}
.modal-content {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: clamp(720px, 80vw, 1200px);
  max-height: 88vh;
  overflow: hidden;
  animation: scaleIn 0.18s ease-out;
}
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);
}
.modal-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.modal-title {
  margin: 0;
  font-size: var(--font-lg);
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.issue-link {
  color: var(--accent-blue);
  text-decoration: none;
}
.issue-link:hover { text-decoration: underline; }
.modal-subtitle {
  font-size: var(--font-base);
  color: var(--text-muted);
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
  flex-shrink: 0;
}
.close-btn:hover {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}
.modal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-5);
  padding: var(--space-3) var(--space-5);
  font-size: var(--font-sm);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
}
.modal-body {
  padding: var(--space-5);
  overflow-y: auto;
  flex: 1;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  line-height: 1.6;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--font-base);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
  text-decoration: none;
}
.btn-primary {
  background-color: var(--accent-blue);
  color: white;
}
.btn-primary:hover { opacity: 0.9; }
.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}
.btn-ghost:hover { background-color: var(--bg-tertiary); }

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

/* Make sure the agent's <font color> tags render with their colors —
   matching the badge in the report header. */
.markdown-body :deep(font[color]) {
  font-weight: 700;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin-top: var(--space-4);
  margin-bottom: var(--space-2);
  color: var(--text-primary);
}
.markdown-body :deep(code) {
  background-color: var(--bg-tertiary);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.92em;
}
.markdown-body :deep(pre) {
  background-color: var(--bg-tertiary);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: var(--space-3) 0;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--border-color);
  padding: var(--space-2) var(--space-3);
}
</style>
