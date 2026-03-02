import { type Ref, onUnmounted } from 'vue'

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(containerRef: Ref<HTMLElement | undefined>) {
  let previouslyFocused: HTMLElement | null = null

  function getFocusable(): HTMLElement[] {
    if (!containerRef.value) return []
    return Array.from(containerRef.value.querySelectorAll<HTMLElement>(FOCUSABLE))
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return
    const els = getFocusable()
    if (els.length === 0) return

    const first = els[0]
    const last = els[els.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  function activate() {
    previouslyFocused = document.activeElement as HTMLElement | null
    document.addEventListener('keydown', handleKeydown)
    // Focus first focusable element
    requestAnimationFrame(() => {
      const els = getFocusable()
      if (els.length > 0) els[0].focus()
    })
  }

  function deactivate() {
    document.removeEventListener('keydown', handleKeydown)
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus()
    }
    previouslyFocused = null
  }

  onUnmounted(deactivate)

  return { activate, deactivate }
}
