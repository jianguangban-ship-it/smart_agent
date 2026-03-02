import { type Ref } from 'vue'

export function useRovingIndex(containerRef: Ref<HTMLElement | undefined>) {
  function handleKeydown(e: KeyboardEvent) {
    if (!containerRef.value) return
    const buttons = Array.from(
      containerRef.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')
    )
    const idx = buttons.indexOf(e.target as HTMLElement)
    if (idx === -1) return

    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      next = (idx + 1) % buttons.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      next = (idx - 1 + buttons.length) % buttons.length
    }
    if (next >= 0) buttons[next].focus()
  }

  return { handleKeydown }
}
