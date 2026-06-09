<template>
  <div class="jira-search-panel" v-if="hasContent">
    <h3 class="search-title">
      <svg class="search-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path stroke-linecap="round" d="M21 21l-4.35-4.35"/>
      </svg>
      {{ isZh ? 'JIRA 搜索' : 'JIRA Search' }}
    </h3>

    <!-- Search input -->
    <div class="search-bar">
      <input
        type="text"
        v-model="query"
        class="input-base search-input"
        :placeholder="isZh ? '搜索工单（关键词或ID）...' : 'Search tickets (keyword or ID)...'"
        @keyup.enter="doSearch"
      />
      <button class="search-btn" :disabled="isSearching || !query.trim()" @click="doSearch">
        <svg v-if="isSearching" class="search-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round" opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
          <circle cx="11" cy="11" r="8"/>
          <path stroke-linecap="round" d="M21 21l-4.35-4.35"/>
        </svg>
      </button>
    </div>

    <!-- Quick action buttons -->
    <div class="quick-actions">
      <button class="quick-btn" @click="$emit('checkDuplicates')" :disabled="isSearching">
        <span class="quick-dot" style="background:var(--accent-orange)"></span>
        {{ isZh ? '查重' : 'Duplicates' }}
      </button>
      <button class="quick-btn" @click="$emit('searchParent')" :disabled="isSearching">
        <span class="quick-dot" style="background:var(--accent-blue)"></span>
        {{ isZh ? '上级需求' : 'Parent Reqs' }}
      </button>
      <button class="quick-btn" @click="$emit('getContext')" :disabled="isSearching">
        <span class="quick-dot" style="background:var(--accent-green)"></span>
        {{ isZh ? 'Sprint' : 'Sprint' }}
      </button>
    </div>

    <!-- Duplicate warning -->
    <Transition name="slide-fade">
      <div v-if="duplicateWarning" class="duplicate-warning">
        <svg class="warn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        {{ isZh ? '检测到可能的重复工单' : 'Potential duplicate tickets detected' }}
      </div>
    </Transition>

    <!-- Sprint/release context -->
    <div v-if="sprintContext" class="context-badge">
      <span class="context-label">Sprint:</span> {{ sprintContext }}
      <template v-if="releaseContext"> · <span class="context-label">Release:</span> {{ releaseContext }}</template>
    </div>

    <!-- Error -->
    <div v-if="searchError" class="search-error">{{ searchError }}</div>

    <!-- Results -->
    <div v-if="searchResults.length" class="results-list">
      <div
        v-for="r in searchResults"
        :key="r.key"
        class="result-item"
        :class="{ 'result-duplicate': (r.similarity || 0) > 0.7 }"
        @click="$emit('selectResult', r)"
      >
        <div class="result-header">
          <span class="result-key">{{ r.key }}</span>
          <span class="result-status" :class="'status-' + r.status.toLowerCase().replace(/\s/g, '-')">{{ r.status }}</span>
          <span v-if="r.similarity" class="result-similarity" :class="(r.similarity || 0) > 0.7 ? 'sim-high' : 'sim-low'">
            {{ Math.round((r.similarity || 0) * 100) }}%
          </span>
        </div>
        <div class="result-summary">{{ r.summary }}</div>
        <div v-if="r.assignee" class="result-assignee">{{ r.assignee }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { JiraSearchResult } from '@/types/api'
import { useI18n } from '@/i18n'

const props = defineProps<{
  isSearching: boolean
  searchResults: JiraSearchResult[]
  searchError: string
  sprintContext: string
  releaseContext: string
  duplicateWarning: boolean
}>()

defineEmits<{
  search: [query: string]
  checkDuplicates: []
  searchParent: []
  getContext: []
  selectResult: [result: JiraSearchResult]
}>()

const { isZh } = useI18n()
const query = ref('')

const hasContent = computed(() =>
  props.searchResults.length > 0 ||
  props.isSearching ||
  props.searchError ||
  props.duplicateWarning ||
  props.sprintContext ||
  true // always show the search bar
)

function doSearch() {
  if (query.value.trim()) {
    // emit search event — parent handles via useJiraSearch
  }
}
</script>

<style scoped>
.jira-search-panel {
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  font-size: 11px;
}
.search-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}
.search-title-icon {
  width: 14px;
  height: 14px;
  color: var(--accent-blue);
}

.search-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}
.search-input {
  flex: 1;
  font-size: 11px;
  padding: 5px 8px;
}
.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background-color: var(--accent-blue);
  color: white;
  border: none;
  cursor: pointer;
  transition: filter 0.15s;
}
.search-btn:hover:not(:disabled) { filter: brightness(1.15); }
.search-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.search-spinner {
  width: 14px;
  height: 14px;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.quick-actions {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}
.quick-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 500;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s;
}
.quick-btn:hover:not(:disabled) {
  border-color: var(--accent-blue);
  color: var(--text-primary);
}
.quick-btn:disabled { opacity: 0.4; }
.quick-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.duplicate-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--orange-subtle);
  color: var(--accent-orange);
  font-weight: 600;
  font-size: 11px;
  margin-bottom: 6px;
}
.warn-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.context-badge {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 10px;
  margin-bottom: 6px;
}
.context-label {
  font-weight: 600;
  color: var(--text-muted);
}

.search-error {
  color: var(--accent-red);
  font-size: 11px;
  padding: 4px 0;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
}
.result-item {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: var(--bg-tertiary);
  cursor: pointer;
  transition: all 0.15s;
}
.result-item:hover {
  border-color: var(--accent-blue);
  background-color: var(--bg-secondary);
}
.result-duplicate {
  border-color: var(--accent-orange);
  background-color: var(--orange-subtle);
}
.result-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.result-key {
  font-weight: 700;
  color: var(--accent-blue);
  font-size: 11px;
}
.result-status {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  background-color: var(--bg-tertiary);
  color: var(--text-muted);
  text-transform: uppercase;
}
.status-done, .status-closed { color: var(--accent-green); background-color: var(--green-subtle); }
.status-in-progress { color: var(--accent-blue); background-color: var(--blue-subtle); }
.status-to-do, .status-open { color: var(--text-muted); }
.result-similarity {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
}
.sim-high { color: var(--accent-red); }
.sim-low { color: var(--text-muted); }
.result-summary {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.result-assignee {
  font-size: 9px;
  color: var(--text-muted);
  margin-top: 2px;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.25s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
