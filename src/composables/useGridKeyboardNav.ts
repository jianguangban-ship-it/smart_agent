import { ref, watch, nextTick, type Ref, type ComputedRef } from 'vue'

export interface GridKeyboardNavOptions<T> {
  /** The (filtered) item list backing the virtualized grid. */
  items: Ref<T[]> | ComputedRef<T[]>
  /** DynamicScroller instance — only scrollToItem is needed. */
  scroller: Ref<{ scrollToItem(index: number): void } | null | undefined>
  /** Element containing the rendered `[data-index]` row wrappers. */
  container: Ref<HTMLElement | null | undefined>
  /** Called when the user presses Enter on a row. */
  onActivate: (item: T) => void
}

/**
 * v10.185: roving keyboard navigation for a vue-virtual-scroller grid.
 *
 * The scroller RECYCLES row DOM, so two rules keep this correct:
 * 1. The current position is an index re-resolved from the event target's
 *    `[data-index]` wrapper on every keystroke — never a cached element —
 *    so navigation works after the user clicks/Tabs into any row mid-list.
 * 2. Activation reads `items[index]`, never a ticket captured at focus time.
 *
 * Focus lands after scrollToItem + nextTick + one animation frame because
 * the target row may not be mounted until the scroller re-renders; one extra
 * frame is retried before falling back to the container so keyboard control
 * is never lost.
 */
export function useGridKeyboardNav<T>(opts: GridKeyboardNavOptions<T>) {
  const activeIndex = ref(-1)

  // Filter/search/refetch swaps the list — any remembered position is stale.
  watch(opts.items, () => { activeIndex.value = -1 })

  function indexFromTarget(e: KeyboardEvent): number {
    const el = e.target instanceof HTMLElement ? e.target.closest('[data-index]') : null
    if (el instanceof HTMLElement && el.dataset.index !== undefined) {
      const i = Number(el.dataset.index)
      if (Number.isInteger(i)) return i
    }
    return activeIndex.value
  }

  function focusRow(index: number, retried = false): void {
    const row = opts.container.value?.querySelector<HTMLElement>(
      `[data-index="${index}"] .row`
    )
    if (row) {
      row.focus()
    } else if (!retried) {
      requestAnimationFrame(() => focusRow(index, true))
    } else {
      opts.container.value?.focus()
    }
  }

  function moveTo(index: number): void {
    const max = opts.items.value.length - 1
    const next = Math.min(Math.max(index, 0), max)
    activeIndex.value = next
    opts.scroller.value?.scrollToItem(next)
    void nextTick(() => requestAnimationFrame(() => focusRow(next)))
  }

  function onKeydown(e: KeyboardEvent): void {
    if (opts.items.value.length === 0) return
    // Let links inside a row keep their native Enter behavior.
    if (e.target instanceof HTMLElement && e.target.closest('a')) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveTo(indexFromTarget(e) + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveTo(indexFromTarget(e) - 1)
        break
      case 'Home':
        e.preventDefault()
        moveTo(0)
        break
      case 'End':
        e.preventDefault()
        moveTo(opts.items.value.length - 1)
        break
      case 'Enter': {
        const i = indexFromTarget(e)
        const item = opts.items.value[i]
        if (item !== undefined) {
          e.preventDefault()
          activeIndex.value = i
          opts.onActivate(item)
        }
        break
      }
    }
  }

  return { onKeydown, activeIndex }
}
