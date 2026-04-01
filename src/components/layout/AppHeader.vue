<template>
  <header class="app-header">
    <div class="header-left">
      <div class="traffic-lights">
        <span class="dot red"></span>
        <span class="dot orange"></span>
        <span class="dot blue"></span>
      </div>
      <h1 v-if="currentLang === 'en'" class="header-title"><span class="logo-a">A</span><span class="logo-g">G</span><span class="logo-ec">ec</span></h1>
      <h1 v-else class="header-title">{{ t('header.title') }}</h1>
      <span class="header-version">v10.73</span>
    </div>
    <div class="header-right">
      <!-- Mode Switcher -->
      <div class="toggle-group mode-group">
        <button
          v-for="m in (['explore', 'task'] as AppMode[])"
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

      <!-- Settings Gear -->
      <button class="settings-btn" @click="$emit('openSettings')" :title="t('settings.title')" :aria-label="t('settings.title')">
        {{ ICONS.settings }}
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'
import { useProductionMode, setUrlMode } from '@/config/webhook'
import { useTheme } from '@/composables/useTheme'
import { ICONS } from '@/config/icons'
import { appMode, setMode } from '@/composables/useAppMode'
import type { AppMode } from '@/composables/useAppMode'

const { t, setLang, currentLang, isZh } = useI18n()
const isProd = useProductionMode
const { isDark, toggleTheme } = useTheme()

defineEmits<{ openSettings: [] }>()

function openHelp() {
  window.open('https://wiki.gwm.cn/pages/viewpage.action?pageId=506263489#', '_blank', 'noopener')
}

</script>

<style scoped>
.app-header {
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  padding: var(--space-3) var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
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
.dot.red { background-color: #f85149; }
.dot.orange { background-color: #d29922; }
.dot.blue { background-color: #58a6ff; }
.header-title {
  font-size: var(--font-lg);
  font-weight: 700;
  letter-spacing: 0.5px;
}
.logo-a { color: #f85149; }
.logo-g { color: #d29922; }
.logo-ec { color: #58a6ff; }
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
.settings-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--icon-sm);
  width: clamp(24px, calc(2.14px + 1.444vw), 40px);
  height: clamp(24px, calc(2.14px + 1.444vw), 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.settings-btn:hover {
  color: var(--text-primary);
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
</style>
