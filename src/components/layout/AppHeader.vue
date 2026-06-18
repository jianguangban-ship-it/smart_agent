<template>
  <header class="app-header" :class="{ 'is-ai-busy': isAiBusy }">
    <div class="header-left">
      <div class="traffic-lights">
        <span class="dot dot-e"></span>
        <span class="dot dot-a"></span>
        <span class="dot dot-x"></span>
      </div>
      <h1 class="header-title brand-eax" aria-label="EAX">
        <span class="brand-e">E</span><span class="brand-a">A</span><span class="brand-x">X</span>
      </h1>
      <span class="header-version">v10.230</span>
    </div>
    <div class="header-right">
      <!-- Cross-mode "reply ready" chip: a background-mode stream finished -->
      <button
        v-if="readyMode && readyMode !== appMode"
        class="reply-chip"
        :class="'reply-chip--' + readyMode"
        @click="setMode(readyMode)"
        :title="t('header.replyReady')"
      >
        ↩ {{ t('mode.' + readyMode) }} {{ t('header.replyReady') }}
      </button>

      <!-- Mode Switcher -->
      <div class="toggle-group mode-group">
        <button
          v-for="m in validModes"
          :key="m"
          class="toggle-btn mode-btn"
          :class="{ active: appMode === m, ['mode-' + m]: appMode === m }"
          @click="setMode(m)"
          :title="t('mode.' + m)"
        ><strong>{{ t('mode.' + m) }}</strong></button>
      </div>

      <!-- Language Toggle -->
      <div class="toggle-group">
        <button
          class="toggle-btn"
          :class="{ active: currentLang === 'en', 'lang-en': currentLang === 'en' }"
          @click="setLang('en')"
        >EN</button>
        <button
          class="toggle-btn"
          :class="{ active: currentLang === 'zh', 'lang-zh': currentLang === 'zh' }"
          @click="setLang('zh')"
        >中文</button>
      </div>

      <!-- URL Mode Toggle -->
      <div class="toggle-group">
        <button
          class="toggle-btn"
          :class="{ active: !isProd }"
          @click="setUrlMode(false)"
          :title="t('urlMode.testTooltip')"
        >
          <span class="mode-dot orange"></span>
          <strong>TEST</strong>
        </button>
        <button
          class="toggle-btn"
          :class="{ active: isProd }"
          @click="setUrlMode(true)"
          :title="t('urlMode.prodTooltip')"
        >
          <span class="mode-dot green"></span>
          <strong>PROD</strong>
        </button>
      </div>

      <!-- Status Badge (pulse only) -->
      <span class="status-badge" :class="isProd ? 'prod' : 'test'">
        <span class="status-pulse" :class="isProd ? 'green' : 'orange'"></span>
      </span>

      <!-- Sprint Indicator (2026 PI cadence) -->
      <SprintIndicator />

      <!-- Theme Toggle -->
      <button class="theme-btn" @click="toggleTheme" :title="isDark ? t('header.themeLight') : t('header.themeDark')" :aria-label="isDark ? t('header.themeLight') : t('header.themeDark')">
        <svg v-if="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </button>

      <!-- Help Button -->
      <button class="help-btn" @click="openHelp" title="User Manual" aria-label="User Manual">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'
import { useProductionMode, setUrlMode } from '@/config/webhook'
import { useTheme } from '@/composables/useTheme'
import { appMode, setMode, validModes } from '@/composables/useAppMode'
import SprintIndicator from '@/components/header/SprintIndicator.vue'

const { t, setLang, currentLang, isZh } = useI18n()
const isProd = useProductionMode
const { isDark, toggleTheme } = useTheme()

defineProps<{ isAiBusy?: boolean; readyMode?: 'task' | 'explore' | null }>()

function openHelp() {
  window.open('https://wiki.gwm.cn/pages/viewpage.action?pageId=506263489#', '_blank', 'noopener')
}

</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  padding: var(--space-3) var(--space-6);
  /* v10.127: small transparent gap between the header and the content
     below (column grid in Task, .explore-head in Explore, QualityGridPanel
     in View). 2px is barely perceptible except where useful. */
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.app-header::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  pointer-events: none;
  background: var(--accent-blue);
  box-shadow: 0 0 0 0 rgba(88, 166, 255, 0);
  opacity: 0;
  transition: opacity 300ms ease;
}
.app-header.is-ai-busy::after {
  opacity: 1;
  animation: headerBreathe 2.4s ease-in-out infinite;
}
@keyframes headerBreathe {
  0%, 100% {
    box-shadow: 0 0 6px 1px rgba(88, 166, 255, 0.35);
    opacity: 0.55;
  }
  50% {
    box-shadow: 0 0 18px 3px var(--accent-blue);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .app-header.is-ai-busy::after {
    animation: none;
    opacity: 0.8;
    box-shadow: 0 0 12px 2px var(--accent-blue);
  }
}
.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.traffic-lights {
  display: flex;
  gap: var(--space-2);
}
.dot {
  width: var(--space-3);
  height: var(--space-3);
  border-radius: 50%;
}
/* Header dots echo the EAX letter colors (left→right: E purple, A blue, X cyan). */
.dot-e { background-color: var(--accent-purple); }
.dot-a { background-color: var(--accent-blue); }
.dot-x { background-color: #22d3ee; }
.header-title {
  font-size: var(--font-lg);
  font-weight: 700;
  letter-spacing: 0.5px;
}
/* EAX brand wordmark — three per-letter brand colors (purple→blue→cyan) that the
   header dots mirror. The X is the hero glyph: cyan, larger, heavier, glowing —
   evoking the "infinite boundaries (X)" of the name. */
.brand-eax {
  display: inline-flex;
  align-items: baseline;
  letter-spacing: 2px;
  font-weight: 800;
}
.brand-e { color: var(--accent-purple); filter: drop-shadow(0 0 6px rgba(155, 125, 245, 0.35)); }
.brand-a { color: var(--accent-blue); filter: drop-shadow(0 0 6px rgba(88, 166, 255, 0.35)); }
.brand-x {
  color: #22d3ee;
  font-size: 1.18em;
  font-weight: 900;
  filter: drop-shadow(0 0 10px rgba(34, 211, 238, 0.55));
}
.header-version {
  font-size: var(--font-base);
  color: var(--text-muted);
}
.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

/* Toggle group */
.toggle-group {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1);
  border-radius: var(--radius-md);
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
}
.toggle-btn {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  font-weight: 500;
  background: transparent;
  color: var(--text-muted);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.toggle-btn.active {
  background-color: var(--accent-blue);
  color: white;
}
.toggle-btn.lang-en { background-color: #2563eb; }
.toggle-btn.lang-zh { background-color: #dc2626; }
.toggle-btn:hover:not(.active) {
  color: var(--text-primary);
}
.mode-dot {
  width: calc(var(--space-1) * 1.5);
  height: calc(var(--space-1) * 1.5);
  border-radius: 50%;
}
.mode-dot.orange { background-color: var(--accent-orange); }
.mode-dot.green { background-color: var(--accent-green); }

/* Status badge */
.status-badge {
  padding: var(--space-1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.status-badge.prod {
  background-color: var(--green-subtle);
}
.status-badge.test {
  background-color: var(--orange-subtle);
}
.status-pulse {
  width: calc(var(--space-1) * 2.5);
  height: calc(var(--space-1) * 2.5);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}
.status-pulse.green { background-color: var(--accent-green); }
.status-pulse.orange { background-color: var(--accent-orange); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.theme-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  width: clamp(24px, calc(2.14px + 1.444vw), 40px);
  height: clamp(24px, calc(2.14px + 1.444vw), 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.theme-btn svg {
  width: var(--icon-sm);
  height: var(--icon-sm);
}
.theme-btn:hover {
  color: var(--accent-orange);
  background-color: var(--bg-tertiary);
}
.help-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  width: clamp(24px, calc(2.14px + 1.444vw), 40px);
  height: clamp(24px, calc(2.14px + 1.444vw), 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.help-btn svg {
  width: var(--icon-sm);
  height: var(--icon-sm);
}
.help-btn:hover {
  color: var(--accent-blue);
  background-color: var(--bg-tertiary);
}
@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  .header-right {
    flex-wrap: wrap;
  }
}

/* Mode switcher */
.mode-group {
  gap: 0;
}
.mode-btn {
  font-size: var(--font-xs, 10px);
  padding: var(--space-1) var(--space-2);
  letter-spacing: 0.3px;
  font-weight: 700;
}
.mode-btn.mode-explore.active { background: #a78bfa; color: #fff; }
.mode-btn.mode-task.active    { background: #34d399; color: #fff; }
.mode-btn.mode-config.active  { background: #fb923c; color: #fff; }

/* Cross-mode "reply ready" chip */
.reply-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--font-xs, 10px);
  font-weight: 700;
  letter-spacing: 0.3px;
  color: #fff;
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  animation: replyChipIn 0.25s ease-out;
}
.reply-chip:hover { filter: brightness(1.12); }
.reply-chip--task    { background: #34d399; }
.reply-chip--explore { background: #a78bfa; }
@keyframes replyChipIn {
  from { opacity: 0; transform: translateY(-3px) scale(0.96); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .reply-chip { animation: none; }
}
</style>
