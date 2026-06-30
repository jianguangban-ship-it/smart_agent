<template>
  <div class="config-layout" :class="{ 'rail-collapsed': railCollapsed }">
    <!-- Left rail — sub-page menu (mirrors Explore mode's rail). -->
    <nav class="config-rail" :aria-label="t('mode.config')">
      <button
        type="button"
        class="rail-toggle"
        :title="t('config.railToggle')"
        :aria-label="t('config.railToggle')"
        @click="toggleRail"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="9" y1="4" x2="9" y2="20" />
        </svg>
      </button>

      <!-- Team -->
      <button
        type="button"
        role="tab"
        class="rail-item"
        :class="{ active: activeSubPage === 'team' }"
        :aria-selected="activeSubPage === 'team'"
        :title="t('config.team')"
        @click="select('team')"
      >
        <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span class="rail-label">{{ t('config.team') }}</span>
      </button>

      <!-- Project -->
      <button
        type="button"
        role="tab"
        class="rail-item"
        :class="{ active: activeSubPage === 'project' }"
        :aria-selected="activeSubPage === 'project'"
        :title="t('config.project')"
        @click="select('project')"
      >
        <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span class="rail-label">{{ t('config.project') }}</span>
      </button>

      <!-- Model -->
      <button
        type="button"
        role="tab"
        class="rail-item"
        :class="{ active: activeSubPage === 'model' }"
        :aria-selected="activeSubPage === 'model'"
        :title="t('config.model')"
        @click="select('model')"
      >
        <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
          <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
        </svg>
        <span class="rail-label">{{ t('config.model') }}</span>
      </button>

      <!-- Skills -->
      <button
        type="button"
        role="tab"
        class="rail-item"
        :class="{ active: activeSubPage === 'skills' }"
        :aria-selected="activeSubPage === 'skills'"
        :title="t('config.skills')"
        @click="select('skills')"
      >
        <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3 L13.6 8.4 L19 10 L13.6 11.6 L12 17 L10.4 11.6 L5 10 L10.4 8.4 Z" />
          <path d="M18 16 L18.7 18.3 L21 19 L18.7 19.7 L18 22 L17.3 19.7 L15 19 L17.3 18.3 Z" />
        </svg>
        <span class="rail-label">{{ t('config.skills') }}</span>
      </button>

      <!-- Activity (live log) -->
      <button
        type="button"
        role="tab"
        class="rail-item"
        :class="{ active: activeSubPage === 'logs' }"
        :aria-selected="activeSubPage === 'logs'"
        :title="t('config.activity')"
        @click="select('logs')"
      >
        <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12h4l2 6 4-14 2 8h6" />
        </svg>
        <span class="rail-label">{{ t('config.activity') }}</span>
      </button>
    </nav>

    <!-- Right content — sub-page area. -->
    <section class="config-content">
      <TeamConfig v-show="activeSubPage === 'team'" :active="activeSubPage === 'team'" />
      <ProjectConfig v-show="activeSubPage === 'project'" :active="activeSubPage === 'project'" />
      <ModelConfig v-show="activeSubPage === 'model'" :active="activeSubPage === 'model'" />
      <SkillsConfig v-show="activeSubPage === 'skills'" :active="activeSubPage === 'skills'" />
      <LogsPanel v-if="logsVisited" v-show="activeSubPage === 'logs'" :active="activeSubPage === 'logs'" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '@/i18n'
import ModelConfig from '@/components/config/ModelConfig.vue'
import SkillsConfig from '@/components/config/SkillsConfig.vue'
import TeamConfig from '@/components/config/TeamConfig.vue'
import ProjectConfig from '@/components/config/ProjectConfig.vue'
import LogsPanel from '@/components/logs/LogsPanel.vue'

// `active` mirrors the View panel's prop shape (gates work while another mode is
// on screen). Unused for now.
defineProps<{ active?: boolean }>()

const { t } = useI18n()

type SubPage = 'team' | 'project' | 'model' | 'skills' | 'logs'
const SUB_PAGES: SubPage[] = ['team', 'project', 'model', 'skills', 'logs']

// Active sub-page (persisted) — restored on reload like Explore's rail state.
const LS_SUBPAGE = 'config_sub_page'
const storedSub = localStorage.getItem(LS_SUBPAGE) as SubPage | null
const activeSubPage = ref<SubPage>(storedSub && SUB_PAGES.includes(storedSub) ? storedSub : 'team')
// LogsPanel is lazily mounted on first visit (it opens an SSE connection only
// while active), so it costs nothing until the user opens Activity.
const logsVisited = ref(activeSubPage.value === 'logs')
function select(page: SubPage) {
  activeSubPage.value = page
  if (page === 'logs') logsVisited.value = true
  localStorage.setItem(LS_SUBPAGE, page)
}

// Rail collapse (persisted) — labels hide → icon-only when collapsed.
const LS_RAIL = 'config_rail_collapsed'
const railCollapsed = ref<boolean>(localStorage.getItem(LS_RAIL) === '1')
function toggleRail() {
  railCollapsed.value = !railCollapsed.value
  localStorage.setItem(LS_RAIL, railCollapsed.value ? '1' : '0')
}
</script>

<style scoped>
.config-layout {
  display: flex;
  height: 100%;
  min-height: 0;
  width: 100%;
}

/* ── Left rail (mirrors Explore mode's .explore-rail) ───────────────────────── */
.config-rail {
  flex-shrink: 0;
  width: 168px;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  border-right: 1px solid var(--border-color);
  background: transparent;
  transition: width 0.18s ease;
}
.rail-collapsed .config-rail {
  width: 52px;
}

.rail-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  align-self: flex-end;
  margin-bottom: var(--space-1);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.rail-collapsed .rail-toggle {
  align-self: center;
}
.rail-toggle:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.rail-toggle svg {
  width: 17px;
  height: 17px;
}

.rail-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.rail-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.rail-item.active {
  color: var(--accent-blue);
  background: var(--blue-subtle, rgba(96, 165, 250, 0.12));
}
.rail-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.rail-collapsed .rail-item {
  justify-content: center;
}
.rail-collapsed .rail-label {
  display: none;
}

/* ── Right content area ─────────────────────────────────────────────────────── */
.config-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}
/* Team placeholder centers itself within the content area. */
.config-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--space-2);
  color: var(--text-muted);
}
.config-placeholder-title {
  font-size: var(--font-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.config-placeholder-hint {
  font-size: var(--font-base);
  color: var(--text-muted);
  margin: 0;
}
</style>
