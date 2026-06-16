<template>
  <div class="cmodel" ref="rootRef">
    <!-- Trigger: ghost button showing {model} + muted effort + chevron. -->
    <button
      type="button"
      class="cmodel-btn"
      :title="exploreModel"
      :aria-label="'Model: ' + exploreModel + ' ' + t('coach.effortHigh')"
      :aria-expanded="open"
      @click="toggleMenu"
    >
      <span class="cmodel-btn-name">{{ exploreModel }}</span>
      <span class="cmodel-btn-effort">{{ t('coach.effortHigh') }}</span>
      <svg class="cmodel-btn-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Transition name="cmodel-fade">
      <div v-if="open" class="cmodel-menu" role="menu">
        <!-- Active model: two-line item + accent check. -->
        <button
          type="button"
          role="menuitemradio"
          aria-checked="true"
          class="cmodel-item cmodel-item--model is-active"
          @click="pick(exploreModel)"
        >
          <span class="cmodel-item-text">
            <span class="cmodel-item-name">{{ exploreModel }}</span>
            <span class="cmodel-item-desc">{{ activeDesc }}</span>
          </span>
          <svg class="cmodel-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>

        <div class="cmodel-sep" role="separator"></div>

        <!-- Effort — static placeholder (no reasoning-effort backend yet). -->
        <div class="cmodel-item cmodel-item--row cmodel-effort" aria-disabled="true">
          <span class="cmodel-item-name">{{ t('coach.effort') }}</span>
          <span class="cmodel-item-value">{{ t('coach.effortHigh') }}</span>
          <svg class="cmodel-chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </div>

        <div class="cmodel-sep" role="separator"></div>

        <!-- More models → side flyout. -->
        <div
          class="cmodel-item cmodel-item--row cmodel-more"
          :class="{ 'is-open': flyout }"
          aria-haspopup="menu"
          :aria-expanded="flyout"
          @mouseenter="flyout = true"
          @click="flyout = !flyout"
        >
          <span class="cmodel-item-name">{{ t('coach.moreModels') }}</span>
          <svg class="cmodel-chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 6 15 12 9 18" />
          </svg>

          <Transition name="cmodel-fade">
            <div v-if="flyout" class="cmodel-menu cmodel-flyout" role="menu" @click.stop>
              <div v-for="(grp, gi) in moreGroups" :key="grp.group" class="cmodel-group">
                <div v-if="gi > 0" class="cmodel-sep" role="separator"></div>
                <div v-if="grp.label" class="cmodel-group-label">{{ grp.group }}</div>
                <button
                  v-for="m in grp.models"
                  :key="m"
                  type="button"
                  role="menuitemradio"
                  :aria-checked="m === exploreModel"
                  class="cmodel-item cmodel-item--model"
                  :class="{ 'is-active': m === exploreModel }"
                  @click="pick(m)"
                >
                  <span class="cmodel-item-name">{{ m }}</span>
                  <svg v-if="m === exploreModel" class="cmodel-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useI18n } from '@/i18n'
import { exploreModel, availableModels, getContextLimitTokens, LLM_MODEL_PRESETS } from '@/config/llm'
import { formatTokens } from '@/utils/contextCalculator'

const emit = defineEmits<{ select: [model: string] }>()

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)
const open = ref(false)
const flyout = ref(false)

function toggleMenu() {
  open.value = !open.value
  if (!open.value) flyout.value = false
}

onClickOutside(rootRef, () => { open.value = false; flyout.value = false })

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) { open.value = false; flyout.value = false }
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

// Active model's caption: its context window, e.g. "128K context".
const activeDesc = computed(() => formatTokens(getContextLimitTokens(exploreModel.value)) + t('coach.modelCtxSuffix'))

// "More models" flyout: configured slots first, then the preset catalog grouped
// by provider (deduped against the configured slots).
const moreGroups = computed(() => {
  const groups: { group: string; label: boolean; models: string[] }[] = []
  const configured = availableModels.value
  if (configured.length) groups.push({ group: 'configured', label: false, models: configured })
  const seen = new Set(configured)
  for (const g of LLM_MODEL_PRESETS) {
    const models = g.models.filter(m => !seen.has(m))
    models.forEach(m => seen.add(m))
    if (models.length) groups.push({ group: g.group, label: true, models })
  }
  return groups
})

function pick(m: string) {
  emit('select', m)
  open.value = false
  flyout.value = false
}
</script>

<style scoped>
.cmodel { position: relative; }

/* Trigger button — ghost (Claude-style). */
.cmodel-btn {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  max-width: 220px;
  padding: 4px 6px 4px 10px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.cmodel-btn:hover { color: var(--text-primary); background: var(--bg-tertiary); }
.cmodel-btn-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.cmodel-btn-effort { color: var(--text-muted); flex-shrink: 0; }
.cmodel-btn-chevron { width: 12px; height: 12px; flex-shrink: 0; opacity: 0.7; align-self: center; }

/* Menu card. */
.cmodel-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  z-index: 60;
  min-width: 220px;
  max-width: 320px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  box-shadow: var(--shadow-modal, 0 8px 28px rgba(0, 0, 0, 0.35));
}

.cmodel-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}
.cmodel-item:hover { background: var(--bg-tertiary); }
.cmodel-item--row { justify-content: space-between; }
.cmodel-item-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.cmodel-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmodel-item-desc { font-size: 12px; line-height: 16px; color: var(--text-muted); }
.cmodel-item--model .cmodel-item-name { flex: 1; }
.cmodel-item.is-active { color: var(--accent-blue); }
.cmodel-item.is-active .cmodel-item-name { color: var(--accent-blue); }
.cmodel-check { width: 15px; height: 15px; flex-shrink: 0; color: var(--accent-blue); }

.cmodel-item-value { font-size: 12px; line-height: 16px; color: var(--text-muted); margin-left: auto; }
.cmodel-chevron-right { width: 14px; height: 14px; flex-shrink: 0; color: var(--text-muted); }

/* Effort row is a non-functional placeholder. */
.cmodel-effort { cursor: default; }
.cmodel-effort:hover { background: transparent; }
.cmodel-more { position: relative; }

.cmodel-sep { height: 1px; margin: 4px 8px; background: var(--border-color); }

.cmodel-group-label {
  padding: 6px 10px 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

/* Side flyout opens to the right of the menu, bottom-aligned (grows upward) —
   matches Claude's reference. */
.cmodel-flyout {
  top: auto;
  bottom: 0;
  left: calc(100% + 6px);
  right: auto;
  max-height: 320px;
  overflow-y: auto;
}

.cmodel-fade-enter-active, .cmodel-fade-leave-active { transition: opacity 0.14s ease, transform 0.14s ease; }
.cmodel-fade-enter-from, .cmodel-fade-leave-to { opacity: 0; transform: translateY(4px); }
.cmodel-flyout.cmodel-fade-enter-from, .cmodel-flyout.cmodel-fade-leave-to { transform: translateX(-6px); }
</style>
