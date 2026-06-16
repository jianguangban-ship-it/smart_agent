import { describe, it, expect, afterEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useGridKeyboardNav } from '../useGridKeyboardNav'

interface Item { issueKey: string }

const ITEMS: Item[] = [
  { issueKey: 'A-1' },
  { issueKey: 'A-2' },
  { issueKey: 'A-3' },
]

function buildDom(count: number): HTMLElement {
  const container = document.createElement('div')
  for (let i = 0; i < count; i++) {
    const wrap = document.createElement('div')
    wrap.setAttribute('data-index', String(i))
    const row = document.createElement('div')
    row.className = 'row'
    row.tabIndex = 0
    wrap.appendChild(row)
    container.appendChild(wrap)
  }
  document.body.appendChild(container)
  return container
}

function keydown(key: string, target?: Element): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  if (target) Object.defineProperty(e, 'target', { value: target })
  return e
}

/** Lets the composable's nextTick + requestAnimationFrame focus chain run. */
async function settleFocus() {
  await nextTick()
  await new Promise(r => setTimeout(r, 40))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useGridKeyboardNav', () => {
  function setup(count = ITEMS.length) {
    const container = buildDom(count)
    const scroller = { scrollToItem: vi.fn() }
    const onActivate = vi.fn()
    const items = ref<Item[]>(ITEMS.slice(0, count))
    const nav = useGridKeyboardNav<Item>({
      items,
      scroller: ref(scroller),
      container: ref(container),
      onActivate,
    })
    return { container, scroller, onActivate, items, nav }
  }

  it('ArrowDown moves to the next row, scrolls it into view, and focuses it', async () => {
    const { container, scroller, nav } = setup()
    const firstRow = container.querySelector('[data-index="0"] .row')!

    const e = keydown('ArrowDown', firstRow)
    nav.onKeydown(e)
    expect(e.defaultPrevented).toBe(true)
    expect(nav.activeIndex.value).toBe(1)
    expect(scroller.scrollToItem).toHaveBeenCalledWith(1)

    await settleFocus()
    expect(document.activeElement).toBe(container.querySelector('[data-index="1"] .row'))
  })

  it('clamps at both ends', async () => {
    const { container, nav } = setup()
    nav.onKeydown(keydown('ArrowUp', container.querySelector('[data-index="0"] .row')!))
    expect(nav.activeIndex.value).toBe(0)

    nav.onKeydown(keydown('ArrowDown', container.querySelector('[data-index="2"] .row')!))
    expect(nav.activeIndex.value).toBe(2)
  })

  it('Home and End jump to the first and last rows', async () => {
    const { container, scroller, nav } = setup()
    nav.onKeydown(keydown('End', container.querySelector('[data-index="0"] .row')!))
    expect(nav.activeIndex.value).toBe(2)
    expect(scroller.scrollToItem).toHaveBeenCalledWith(2)

    nav.onKeydown(keydown('Home', container.querySelector('[data-index="2"] .row')!))
    expect(nav.activeIndex.value).toBe(0)
  })

  it('Enter activates the item at the row under the cursor, by index', () => {
    const { container, onActivate, nav } = setup()
    nav.onKeydown(keydown('Enter', container.querySelector('[data-index="1"] .row')!))
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledWith(ITEMS[1])
  })

  it('ignores Enter on links inside a row (JIRA anchor must keep its default)', () => {
    const { container, onActivate, nav } = setup()
    const row = container.querySelector('[data-index="1"] .row')!
    const a = document.createElement('a')
    a.href = 'https://example.com'
    row.appendChild(a)

    const e = keydown('Enter', a)
    nav.onKeydown(e)
    expect(onActivate).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(false)
  })

  it('resets activeIndex when the item list identity changes', async () => {
    const { container, items, nav } = setup()
    nav.onKeydown(keydown('ArrowDown', container.querySelector('[data-index="0"] .row')!))
    expect(nav.activeIndex.value).toBe(1)

    items.value = ITEMS.slice(0, 2)
    await nextTick()
    expect(nav.activeIndex.value).toBe(-1)
  })

  it('does nothing on an empty list', () => {
    const { nav } = setup(0)
    const e = keydown('ArrowDown')
    nav.onKeydown(e)
    expect(nav.activeIndex.value).toBe(-1)
    expect(e.defaultPrevented).toBe(false)
  })
})
