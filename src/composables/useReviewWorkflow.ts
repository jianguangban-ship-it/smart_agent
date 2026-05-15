import { ref, computed, watch, reactive } from 'vue'
import type { ReviewStatus } from '@/config/domain/types'
import { getModeReviewSteps, getModeReviewChecklist } from '@/config/domain'
import { currentRole } from '@/composables/useRole'
import { appMode } from '@/composables/useAppMode'
import type { AppMode } from '@/composables/useAppMode'

// Per-mode review state — each mode tracks its own workflow independently.
// View mode is read-only so its 'draft' is never advanced, but the shape must include it.
const modeReviewStatus = reactive<Record<AppMode, ReviewStatus>>({
  explore: 'draft',
  task: 'draft',
  view: 'draft'
})
const modeCheckedItems = reactive<Record<AppMode, Set<string>>>({
  explore: new Set(),
  task: new Set(),
  view: new Set()
})

const reviewStatus = ref<ReviewStatus>('draft')
const checkedItems = ref<Set<string>>(new Set())

// Sync per-mode state ↔ active refs on mode switch
watch(appMode, (newMode, oldMode) => {
  // Save outgoing mode state
  modeReviewStatus[oldMode] = reviewStatus.value
  modeCheckedItems[oldMode] = new Set(checkedItems.value)
  // Restore incoming mode state
  reviewStatus.value = modeReviewStatus[newMode]
  checkedItems.value = new Set(modeCheckedItems[newMode])
}, { immediate: false })

export function useReviewWorkflow() {
  const currentStepIndex = computed(() =>
    getModeReviewSteps(appMode.value).findIndex(s => s.id === reviewStatus.value)
  )

  const checklist = computed(() => getModeReviewChecklist(appMode.value, currentRole.value))

  const allChecked = computed(() =>
    checklist.value.every(item => checkedItems.value.has(item.id))
  )

  const checkProgress = computed(() => {
    if (checklist.value.length === 0) return 0
    return Math.round((checkedItems.value.size / checklist.value.length) * 100)
  })

  function advanceTo(status: ReviewStatus) {
    reviewStatus.value = status
    modeReviewStatus[appMode.value] = status
  }

  function toggleCheck(itemId: string) {
    const next = new Set(checkedItems.value)
    if (next.has(itemId)) {
      next.delete(itemId)
    } else {
      next.add(itemId)
    }
    checkedItems.value = next
    modeCheckedItems[appMode.value] = new Set(next)
  }

  function resetWorkflow() {
    reviewStatus.value = 'draft'
    checkedItems.value = new Set()
    modeReviewStatus[appMode.value] = 'draft'
    modeCheckedItems[appMode.value] = new Set()
  }

  return {
    reviewStatus,
    currentStepIndex,
    checklist,
    checkedItems,
    allChecked,
    checkProgress,
    advanceTo,
    toggleCheck,
    resetWorkflow,
    REVIEW_STEPS: computed(() => getModeReviewSteps(appMode.value))
  }
}
