<template>
  <div class="team-config">
    <!-- ── Left pane — team list ─────────────────────────────────────────── -->
    <aside class="team-list">
      <header class="team-list-head">
        <h1 class="tc-title">{{ t('config.team') }}</h1>
        <p class="tc-subtitle">{{ t('config.teamSubtitle') }}</p>
      </header>
      <div class="team-search">
        <input v-model="teamSearch" type="search" class="tc-input" :placeholder="t('config.searchTeams')" />
      </div>
      <ul class="team-rows" role="tablist">
        <li v-for="team in filteredTeams" :key="team.key">
          <button
            type="button"
            class="team-row"
            :class="{ active: team.key === selectedKey }"
            :aria-selected="team.key === selectedKey"
            @click="selectTeam(team.key)"
          >
            <span class="tr-main">
              <span class="tr-name">{{ team.teamName }}</span>
              <span class="tr-key">{{ team.key }}</span>
            </span>
            <span class="tr-meta">
              <span class="tr-counts">{{ memberCountOf(team.key) }} · {{ componentCountOf(team.key) }}</span>
              <span v-if="pendingMoveCount(team.key) > 0" class="tr-incoming" :title="t('config.moveTo')">+{{ pendingMoveCount(team.key) }}</span>
              <span v-if="isUnlocked(team.key)" class="tr-unlock-dot" :title="t('config.unlocked')" />
            </span>
          </button>
        </li>
      </ul>
    </aside>

    <!-- ── Right pane — detail ───────────────────────────────────────────── -->
    <section class="team-detail">
      <div v-if="!selectedKey" class="detail-empty">{{ t('config.selectTeamHint') }}</div>

      <template v-else>
        <header class="detail-head">
          <div class="dh-title">
            <h2 class="dh-name">{{ selectedTeamName }}</h2>
            <span class="dh-key">{{ selectedKey }}</span>
          </div>

          <!-- Lock bar -->
          <div class="lock-bar">
            <template v-if="unlocked">
              <span class="badge badge-unlocked">● {{ t('config.unlocked') }}</span>
              <button type="button" class="btn-ghost" @click="relock">{{ t('config.lock') }}</button>
            </template>
            <template v-else-if="codePromptOpen">
              <div class="code-prompt" :class="{ shake: unlockError }">
                <input
                  ref="codeInputEl"
                  v-model="codeInput"
                  type="password"
                  class="tc-input code-input"
                  :placeholder="t('config.enterCode')"
                  @keydown.enter="submitUnlock"
                  @keydown.esc="closeCodePrompt"
                />
                <button type="button" class="btn-primary" @click="submitUnlock">{{ t('config.confirmUnlock') }}</button>
                <button type="button" class="btn-ghost" @click="closeCodePrompt">✕</button>
              </div>
            </template>
            <template v-else>
              <button type="button" class="btn-unlock" @click="openCodePrompt">🔒 {{ t('config.unlock') }}</button>
            </template>
          </div>
        </header>
        <p v-if="!unlocked && codePromptOpen" class="code-hint">{{ t('config.noCodeConfigured') }}</p>

        <!-- Tabs -->
        <div class="detail-tabs" role="tablist">
          <button
            type="button" role="tab" class="tab" :class="{ active: activeTab === 'members' }"
            :aria-selected="activeTab === 'members'" @click="activeTab = 'members'"
          >{{ t('config.tabMembers') }} <span class="tab-count">{{ draftMembers.length }}</span></button>
          <button
            type="button" role="tab" class="tab" :class="{ active: activeTab === 'components' }"
            :aria-selected="activeTab === 'components'" @click="activeTab = 'components'"
          >{{ t('config.tabComponents') }} <span class="tab-count">{{ draftComponents.length }}</span></button>
        </div>

        <!-- ── Members tab ─────────────────────────────────────────────────── -->
        <div v-show="activeTab === 'members'" class="tab-body">
          <input
            v-if="draftMembers.length"
            v-model="memberFilter" type="search" class="tc-input filter-input"
            :placeholder="t('config.filterMembers')"
          />

          <p v-if="!draftMembers.length" class="empty-hint">{{ t('config.noMembers') }}</p>

          <ul v-else class="member-rows">
            <li
              v-for="m in filteredMembers" :key="m.id"
              class="member-row" :class="{ incoming: incomingIds.has(m.id) }"
            >
              <span class="m-id">{{ m.id }}</span>
              <template v-if="unlocked">
                <input v-model="m.name" class="tc-input m-name" :placeholder="t('config.memberName')" />
                <input v-model="m.role" class="tc-input m-role" list="role-suggestions" :placeholder="t('config.memberRole')" />
                <select class="tc-input m-move" :value="''" @change="onMoveSelect(m, $event)">
                  <option value="" disabled>{{ t('config.moveTo') }}</option>
                  <option v-for="tk in otherTeamKeys" :key="tk.key" :value="tk.key">{{ tk.teamName }}</option>
                </select>
                <button type="button" class="btn-icon-del" :title="t('config.removeMember')" @click="removeMember(m.id)">✕</button>
              </template>
              <template v-else>
                <span class="m-name-ro">{{ m.name }}</span>
                <span class="m-role-ro">{{ m.role || '—' }}</span>
              </template>
            </li>
          </ul>

          <!-- Add member -->
          <div v-if="unlocked" class="add-member">
            <input v-model="newId" class="tc-input" :placeholder="t('config.memberId')" @keydown.enter="addMember" />
            <input v-model="newName" class="tc-input" :placeholder="t('config.memberName')" @keydown.enter="addMember" />
            <input v-model="newRole" class="tc-input" list="role-suggestions" :placeholder="t('config.memberRole')" @keydown.enter="addMember" />
            <button type="button" class="btn-primary" @click="addMember">+ {{ t('config.addMember') }}</button>
          </div>
        </div>

        <!-- ── Components tab ──────────────────────────────────────────────── -->
        <div v-show="activeTab === 'components'" class="tab-body">
          <p v-if="!draftComponents.length" class="empty-hint">{{ t('config.noComponents') }}</p>
          <div v-else class="chip-wrap">
            <span v-for="(c, i) in draftComponents" :key="c + i" class="chip">
              {{ c }}
              <button v-if="unlocked" type="button" class="chip-x" :title="t('config.removeComponent')" @click="removeComponent(i)">✕</button>
            </span>
          </div>
          <div v-if="unlocked" class="add-component">
            <input
              v-model="newComponent" class="tc-input"
              :placeholder="t('config.addComponent')"
              @keydown.enter.prevent="addComponent"
              @keydown="onComponentKey"
            />
            <button type="button" class="btn-primary" @click="addComponent">+</button>
          </div>
        </div>

        <!-- Save bar -->
        <div v-if="unlocked" class="save-bar">
          <span v-if="dirty" class="dirty-dot">● {{ t('settings.skillModified') }}</span>
          <button type="button" class="btn-ghost" :disabled="!dirty" @click="discard">{{ t('config.discard') }}</button>
          <button type="button" class="btn-primary" :disabled="!dirty || saving" @click="onSave">{{ t('config.save') }}</button>
        </div>
      </template>
    </section>

    <!-- Shared datalist of roles already in use (suggestions for add/edit). -->
    <datalist id="role-suggestions">
      <option v-for="r in roleSuggestions" :key="r" :value="r" />
    </datalist>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import type { TeamMember } from '@/types/team'
import { runtimeProjects, runtimeTeamMembers, runtimeComponentsByProject } from '@/composables/useRuntimeConfig'
import {
  isUnlocked, unlockTeam, lockTeam, saveTeam,
  queueMove, getPendingMoves, pendingMoveCount
} from '@/composables/useConfigWrite'

defineProps<{ active?: boolean }>()

const { t } = useI18n()
const { addToast } = useToast()

// `{n}`-style interpolation (the project's t() returns the raw string).
function fmt(key: string, vars: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

// ── Selection + search ──────────────────────────────────────────────────────
const teamSearch = ref('')
const selectedKey = ref<string | null>(null)
const activeTab = ref<'members' | 'components'>('members')

const filteredTeams = computed(() => {
  const q = teamSearch.value.trim().toLowerCase()
  const list = runtimeProjects.value
  if (!q) return list
  return list.filter(p =>
    p.teamName.toLowerCase().includes(q) ||
    p.key.toLowerCase().includes(q) ||
    p.name.toLowerCase().includes(q)
  )
})

const selectedTeamName = computed(() =>
  runtimeProjects.value.find(p => p.key === selectedKey.value)?.teamName || selectedKey.value || ''
)
const otherTeamKeys = computed(() =>
  runtimeProjects.value.filter(p => p.key !== selectedKey.value)
)

function memberCountOf(key: string): number {
  const base = key === selectedKey.value ? draftMembers.value.length : (runtimeTeamMembers.value[key]?.length ?? 0)
  return base
}
function componentCountOf(key: string): number {
  return key === selectedKey.value ? draftComponents.value.length : (runtimeComponentsByProject.value[key]?.length ?? 0)
}

// ── Working copy (draft) ─────────────────────────────────────────────────────
const draftMembers = ref<TeamMember[]>([])
const draftComponents = ref<string[]>([])
const incomingIds = ref<Set<string>>(new Set())

function cloneMembers(arr: TeamMember[]): TeamMember[] {
  return arr.map(m => ({ id: m.id, name: m.name, role: m.role }))
}

function loadDraft(key: string) {
  const base = cloneMembers(runtimeTeamMembers.value[key] ?? [])
  const baseIds = new Set(base.map(m => m.id))
  const incoming = getPendingMoves(key).filter(m => !baseIds.has(m.id))
  incomingIds.value = new Set(incoming.map(m => m.id))
  draftMembers.value = [...base, ...cloneMembers(incoming)]
  draftComponents.value = [...(runtimeComponentsByProject.value[key] ?? [])]
}

const unlocked = computed(() => (selectedKey.value ? isUnlocked(selectedKey.value) : false))

// Dirty = draft differs from the persisted runtime snapshot for this team.
const dirty = computed(() => {
  const key = selectedKey.value
  if (!key) return false
  const baseM = runtimeTeamMembers.value[key] ?? []
  const baseC = runtimeComponentsByProject.value[key] ?? []
  return JSON.stringify(normalize(draftMembers.value)) !== JSON.stringify(normalize(baseM)) ||
    JSON.stringify(draftComponents.value) !== JSON.stringify(baseC)
})
function normalize(arr: TeamMember[]): TeamMember[] {
  return arr.map(m => ({ id: m.id, name: m.name, role: m.role ?? undefined }))
}

function selectTeam(key: string) {
  if (key === selectedKey.value) return
  if (dirty.value && unlocked.value && !confirm(t('config.confirmDiscard'))) return
  selectedKey.value = key
  activeTab.value = 'members'
  memberFilter.value = ''
  resetAddFields()
  closeCodePrompt()
  loadDraft(key)
}

// Reload the draft if the underlying runtime data for the selected team changes
// (e.g. after our own save, or another tab's edit landing via reload).
watch([runtimeTeamMembers, runtimeComponentsByProject], () => {
  if (selectedKey.value && !dirty.value) loadDraft(selectedKey.value)
})

// ── Unlock flow ──────────────────────────────────────────────────────────────
const codePromptOpen = ref(false)
const codeInput = ref('')
const unlockError = ref(false)
const codeInputEl = ref<HTMLInputElement | null>(null)

function openCodePrompt() {
  codePromptOpen.value = true
  unlockError.value = false
  codeInput.value = ''
  nextTick(() => codeInputEl.value?.focus())
}
function closeCodePrompt() {
  codePromptOpen.value = false
  codeInput.value = ''
  unlockError.value = false
}
async function submitUnlock() {
  const key = selectedKey.value
  if (!key || !codeInput.value) return
  const ok = await unlockTeam(key, codeInput.value)
  if (ok) {
    closeCodePrompt()
    addToast('success', t('config.unlocked'))
  } else {
    unlockError.value = true
    addToast('error', t('config.wrongCode'))
    setTimeout(() => { unlockError.value = false }, 500)
  }
}
function relock() {
  const key = selectedKey.value
  if (!key) return
  if (dirty.value && !confirm(t('config.confirmDiscard'))) return
  lockTeam(key)
  loadDraft(key)
}

// ── Members editing ──────────────────────────────────────────────────────────
const memberFilter = ref('')
const filteredMembers = computed(() => {
  const q = memberFilter.value.trim().toLowerCase()
  if (!q) return draftMembers.value
  return draftMembers.value.filter(m =>
    m.name.toLowerCase().includes(q) ||
    m.id.toLowerCase().includes(q) ||
    (m.role ?? '').toLowerCase().includes(q)
  )
})

const newId = ref('')
const newName = ref('')
const newRole = ref('')
function resetAddFields() { newId.value = ''; newName.value = ''; newRole.value = '' }

function addMember() {
  const id = newId.value.trim()
  const name = newName.value.trim()
  if (!id || !name) { addToast('error', t('config.needIdName')); return }
  if (draftMembers.value.some(m => m.id === id)) { addToast('error', t('config.dupId')); return }
  const role = newRole.value.trim()
  draftMembers.value.push({ id, name, ...(role ? { role } : {}) })
  resetAddFields()
}

function removeMember(id: string) {
  draftMembers.value = draftMembers.value.filter(m => m.id !== id)
  incomingIds.value.delete(id)
}

function onMoveSelect(m: TeamMember, e: Event) {
  const target = (e.target as HTMLSelectElement).value
  ;(e.target as HTMLSelectElement).value = ''
  if (!target) return
  queueMove(target, { id: m.id, name: m.name, role: m.role })
  removeMember(m.id)
  const teamName = runtimeProjects.value.find(p => p.key === target)?.teamName || target
  addToast('success', fmt('config.movedQueued', { team: teamName }))
}

// ── Components editing ───────────────────────────────────────────────────────
const newComponent = ref('')
function addComponent() {
  const c = newComponent.value.trim()
  if (!c) return
  if (!draftComponents.value.includes(c)) draftComponents.value.push(c)
  newComponent.value = ''
}
function onComponentKey(e: KeyboardEvent) {
  if (e.key === ',') { e.preventDefault(); addComponent() }
}
function removeComponent(i: number) {
  draftComponents.value.splice(i, 1)
}

// ── Role suggestions (datalist) ──────────────────────────────────────────────
const roleSuggestions = computed(() => {
  const set = new Set<string>()
  for (const list of Object.values(runtimeTeamMembers.value)) {
    for (const m of list) if (m.role) set.add(m.role)
  }
  return [...set].sort()
})

// ── Save / discard ───────────────────────────────────────────────────────────
const saving = ref(false)
async function onSave() {
  const key = selectedKey.value
  if (!key || !dirty.value) return
  saving.value = true
  const res = await saveTeam(key, normalize(draftMembers.value), [...draftComponents.value])
  saving.value = false
  if (res.ok) {
    incomingIds.value = new Set()
    addToast('success', t('config.saved'))
  } else if (res.status === 401) {
    addToast('error', t('config.saveAuthFailed'))
  } else {
    addToast('error', t('config.saveFailed'))
  }
}
function discard() {
  if (selectedKey.value) loadDraft(selectedKey.value)
}
</script>

<style scoped>
.team-config {
  display: flex;
  height: 100%;
  min-height: 0;
  width: 100%;
}

/* ── Left pane ─────────────────────────────────────────────────────────────── */
.team-list {
  flex-shrink: 0;
  width: 288px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--border-color);
}
.team-list-head {
  padding: var(--space-3) var(--space-3) var(--space-2);
}
.tc-title {
  margin: 0;
  font-size: var(--font-lg);
  font-weight: 600;
  color: var(--text-primary);
}
.tc-subtitle {
  margin: var(--space-1) 0 0;
  font-size: var(--font-xs);
  color: var(--text-muted);
  line-height: 1.4;
}
.team-search {
  padding: 0 var(--space-3) var(--space-2);
}
.tc-input {
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-2);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary, var(--bg-tertiary));
  color: var(--text-primary);
  font-size: var(--font-sm);
  outline: none;
  transition: border-color 0.15s;
}
.tc-input:focus {
  border-color: var(--accent-blue);
}
.team-rows {
  list-style: none;
  margin: 0;
  padding: 0 var(--space-2) var(--space-2);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.team-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2);
  margin-bottom: 2px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.team-row:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.team-row.active {
  background: var(--blue-subtle, rgba(96, 165, 250, 0.12));
  color: var(--accent-blue);
}
.tr-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.tr-name { font-size: var(--font-sm); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr-key { font-size: var(--font-xs); color: var(--text-muted); font-family: var(--font-mono, monospace); }
.tr-meta { display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0; }
.tr-counts { font-size: var(--font-xs); color: var(--text-muted); white-space: nowrap; }
.tr-incoming {
  font-size: var(--font-xs); font-weight: 700; color: var(--accent-blue);
  background: var(--blue-subtle, rgba(96, 165, 250, 0.16));
  border-radius: var(--radius-sm); padding: 0 4px;
}
.tr-unlock-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent-green, #34d399);
}

/* ── Right pane ────────────────────────────────────────────────────────────── */
.team-detail {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: var(--space-3) var(--space-4);
}
.detail-empty {
  margin: auto;
  color: var(--text-muted);
  font-size: var(--font-base);
}
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.dh-title { display: flex; align-items: baseline; gap: var(--space-2); }
.dh-name { margin: 0; font-size: var(--font-xl); font-weight: 600; color: var(--text-primary); }
.dh-key { font-size: var(--font-sm); color: var(--text-muted); font-family: var(--font-mono, monospace); }

.lock-bar { display: flex; align-items: center; gap: var(--space-2); }
.badge {
  font-size: var(--font-xs); font-weight: 600; padding: 2px 8px; border-radius: var(--radius-pill, 999px);
}
.badge-unlocked { color: var(--accent-green, #34d399); background: rgba(52, 211, 153, 0.14); }
.btn-unlock {
  display: inline-flex; align-items: center; gap: 6px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
  background: var(--bg-tertiary); color: var(--text-primary);
  font-size: var(--font-sm); font-weight: 600; cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.btn-unlock:hover { border-color: var(--accent-blue); }
.code-prompt { display: flex; align-items: center; gap: var(--space-1); }
.code-input { width: 200px; }
.code-prompt.shake { animation: shake 0.4s; }
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}
.code-hint { margin: var(--space-1) 0 0; font-size: var(--font-xs); color: var(--text-muted); }

.detail-tabs {
  display: flex;
  gap: var(--space-1);
  margin: var(--space-3) 0 var(--space-2);
  border-bottom: 1px solid var(--border-color);
}
.tab {
  padding: var(--space-2) var(--space-3);
  border: none; background: transparent;
  color: var(--text-secondary); font-size: var(--font-sm); font-weight: 600;
  cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}
.tab:hover { color: var(--text-primary); }
.tab.active { color: var(--accent-blue); border-bottom-color: var(--accent-blue); }
.tab-count {
  font-size: var(--font-xs); color: var(--text-muted);
  background: var(--bg-tertiary); border-radius: var(--radius-sm); padding: 0 5px; margin-left: 4px;
}

.tab-body { display: flex; flex-direction: column; gap: var(--space-2); padding-top: var(--space-2); }
.filter-input { max-width: 320px; }
.empty-hint { color: var(--text-muted); font-size: var(--font-sm); margin: var(--space-2) 0; }

.member-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-1); }
.member-row {
  display: grid;
  grid-template-columns: 150px 1fr 150px 130px 32px;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  background: var(--bg-secondary, transparent);
}
.member-row:hover { background: var(--bg-tertiary); }
.member-row.incoming {
  background: var(--blue-subtle, rgba(96, 165, 250, 0.10));
  box-shadow: inset 2px 0 0 var(--accent-blue);
}
.m-id { font-family: var(--font-mono, monospace); font-size: var(--font-xs); color: var(--text-muted); }
.m-name-ro { font-size: var(--font-sm); color: var(--text-primary); }
.m-role-ro { font-size: var(--font-sm); color: var(--text-secondary); }
.btn-icon-del {
  width: 28px; height: 28px; border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-muted); cursor: pointer; font-size: 13px;
  transition: background 0.15s, color 0.15s;
}
.btn-icon-del:hover { background: var(--red-subtle, rgba(248, 113, 113, 0.16)); color: var(--accent-red, #f87171); }

.add-member {
  display: grid;
  grid-template-columns: 150px 1fr 150px auto;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--border-color);
}

.chip-wrap { display: flex; flex-wrap: wrap; gap: var(--space-1); }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: var(--radius-pill, 999px);
  background: var(--bg-tertiary); color: var(--text-primary); font-size: var(--font-sm);
}
.chip-x {
  border: none; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 11px; padding: 0;
}
.chip-x:hover { color: var(--accent-red, #f87171); }
.add-component { display: flex; gap: var(--space-2); margin-top: var(--space-2); max-width: 360px; }

.save-bar {
  display: flex; align-items: center; justify-content: flex-end; gap: var(--space-2);
  margin-top: auto; padding-top: var(--space-3);
  position: sticky; bottom: 0;
}
.dirty-dot { margin-right: auto; font-size: var(--font-xs); color: var(--accent-amber, #fbbf24); font-weight: 600; }

.btn-primary {
  padding: var(--space-2) var(--space-3); border: none; border-radius: var(--radius-md);
  background: var(--accent-blue); color: #fff; font-size: var(--font-sm); font-weight: 600; cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:disabled { opacity: 0.45; cursor: default; }
.btn-ghost {
  padding: var(--space-2) var(--space-3); border: 1px solid var(--border-color); border-radius: var(--radius-md);
  background: transparent; color: var(--text-secondary); font-size: var(--font-sm); font-weight: 600; cursor: pointer;
}
.btn-ghost:hover:not(:disabled) { color: var(--text-primary); border-color: var(--text-muted); }
.btn-ghost:disabled { opacity: 0.45; cursor: default; }

@media (max-width: 720px) {
  .member-row, .add-member { grid-template-columns: 1fr; }
}
</style>
