<template>
  <header class="app-header">
    <div class="header-left">
      <div class="traffic-lights">
        <span class="dot red"></span>
        <span class="dot orange"></span>
        <span class="dot blue"></span>
      </div>
      <h1 class="header-title">{{ t('header.title') }}</h1>
      <span class="header-version">v8.32</span>
    </div>
    <div class="header-right">
      <!-- Language Toggle -->
      <div class="toggle-group">
        <button
          class="toggle-btn"
          :class="{ active: currentLang === 'en' }"
          @click="setLang('en')"
        >EN</button>
        <button
          class="toggle-btn"
          :class="{ active: currentLang === 'zh' }"
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
          Test
        </button>
        <button
          class="toggle-btn"
          :class="{ active: isProd }"
          @click="setUrlMode(true)"
          :title="t('urlMode.prodTooltip')"
        >
          <span class="mode-dot green"></span>
          Prod
        </button>
      </div>

      <!-- Status Badge -->
      <span class="status-badge" :class="isProd ? 'prod' : 'test'">
        <span class="status-pulse" :class="isProd ? 'green' : 'orange'"></span>
        {{ isProd ? 'Production' : 'Test Mode' }}
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

      <!-- Settings Gear -->
      <button class="settings-btn" @click="$emit('openSettings')" :title="t('settings.title')" :aria-label="t('settings.title')">
        ⚙
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'
import { useProductionMode, setUrlMode } from '@/config/webhook'
import { useTheme } from '@/composables/useTheme'

const { t, setLang, currentLang } = useI18n()
const isProd = useProductionMode
const { isDark, toggleTheme } = useTheme()

defineEmits<{ openSettings: [] }>()
</script>

<style scoped>
.app-header {
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.traffic-lights {
  display: flex;
  gap: 8px;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.dot.red { background-color: #f85149; }
.dot.orange { background-color: #d29922; }
.dot.blue { background-color: #58a6ff; }
.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.header-version {
  font-size: 12px;
  color: var(--text-muted);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Toggle group */
.toggle-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-md);
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
}
.toggle-btn {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  background: transparent;
  color: var(--text-muted);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}
.toggle-btn.active {
  background-color: var(--accent-blue);
  color: white;
}
.toggle-btn:hover:not(.active) {
  color: var(--text-primary);
}
.mode-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.mode-dot.orange { background-color: var(--accent-orange); }
.mode-dot.green { background-color: var(--accent-green); }

/* Status badge */
.status-badge {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-badge.prod {
  background-color: rgba(63, 185, 80, 0.15);
  color: var(--accent-green);
}
.status-badge.test {
  background-color: rgba(210, 153, 34, 0.15);
  color: var(--accent-orange);
}
.status-pulse {
  width: 6px;
  height: 6px;
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
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.theme-btn svg {
  width: 14px;
  height: 14px;
}
.theme-btn:hover {
  color: var(--accent-orange);
  background-color: var(--bg-tertiary);
}
.settings-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 15px;
  width: 30px;
  height: 30px;
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
</style>
