<template>
  <Transition name="modal">
    <div v-if="modelValue" class="modal-overlay" ref="hotkeyModalRef" role="dialog" aria-modal="true" aria-labelledby="hotkey-modal-title" @click.self="$emit('update:modelValue', false)">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="hotkey-modal-title" class="modal-title">{{ ICONS.hotkeys }} {{ t('hotkeys.title') }}</h3>
          <button class="close-btn" :aria-label="t('modal.cancel')" @click="$emit('update:modelValue', false)">✕</button>
        </div>

        <table class="hotkey-table">
          <tbody>
            <tr v-for="row in hotkeys" :key="row.key">
              <td class="key-cell"><kbd class="key">{{ row.key }}</kbd></td>
              <td class="desc-cell">{{ row.desc }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from '@/i18n'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { ICONS } from '@/config/icons'

const props = defineProps<{ modelValue: boolean }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { t } = useI18n()

const hotkeyModalRef = ref<HTMLElement>()
const { activate: activateHotkeyTrap, deactivate: deactivateHotkeyTrap } = useFocusTrap(hotkeyModalRef)

watch(() => props.modelValue, (open) => {
  if (open) nextTick(() => activateHotkeyTrap())
  else deactivateHotkeyTrap()
})

const hotkeys = computed(() => [
  { key: 'Enter',            desc: t('hotkeys.coach') },
  { key: 'Ctrl+Shift+Enter', desc: t('hotkeys.analyze') },
  { key: 'Ctrl+Shift+C',     desc: t('hotkeys.create') },
  { key: 'Ctrl+,',           desc: t('hotkeys.settings') },
  { key: 'Escape',           desc: t('hotkeys.escape') },
  { key: '?',                desc: t('hotkeys.showCheatsheet') }
])
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5000;
  padding: var(--space-6);
}
.modal-content {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  padding: var(--space-6);
  max-width: clamp(300px, 25vw, 500px);
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: scaleIn 0.2s ease-out;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.modal-title {
  font-size: var(--font-xl);
  font-weight: 600;
  color: var(--text-primary);
}
.close-btn {
  width: clamp(22px, calc(0.42px + 1.444vw), 38px);
  height: clamp(22px, calc(0.42px + 1.444vw), 38px);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: var(--font-base);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.close-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-tertiary);
}
.hotkey-table {
  width: 100%;
  border-collapse: collapse;
}
.hotkey-table tr {
  border-bottom: 1px solid var(--border-color);
}
.hotkey-table tr:last-child {
  border-bottom: none;
}
.key-cell {
  padding: var(--space-2) var(--space-3) var(--space-2) 0;
  white-space: nowrap;
  width: 1%;
}
.desc-cell {
  padding: var(--space-2) 0;
  font-size: var(--font-md);
  color: var(--text-secondary);
}
.key {
  display: inline-flex;
  align-items: center;
  padding: 3px var(--space-2);
  border-radius: var(--radius-sm);
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.modal-enter-active,
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
</style>
