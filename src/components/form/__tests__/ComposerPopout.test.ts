import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'

// Each test mounts to document.body and the popout teleports there too — without
// auto-unmount between cases, document.querySelector picks up stale popouts from
// earlier tests and our event/disabled assertions hit the wrong DOM nodes.
enableAutoUnmount(afterEach)

// Shim localStorage before importing the component so its <script setup>
// import-time access doesn't blow up under jsdom.
const storage: Record<string, string> = {}
beforeAll(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { for (const k of Object.keys(storage)) delete storage[k] },
    key: () => null, length: 0,
  } as Storage
})
beforeEach(() => { for (const k of Object.keys(storage)) delete storage[k] })

import ComposerPopout from '../ComposerPopout.vue'

function mountPopout(props: { open?: boolean; modelValue?: string } = {}) {
  return mount(ComposerPopout, {
    props: { open: true, modelValue: '', ...props },
    attachTo: document.body,
  })
}

describe('ComposerPopout', () => {
  it('does not render the window when open=false', () => {
    mountPopout({ open: false })
    expect(document.querySelector('.composer-popout')).toBeNull()
  })

  it('renders title bar, textarea, send, and resize handle when open=true', () => {
    mountPopout({ open: true })
    expect(document.querySelector('.composer-popout')).toBeTruthy()
    expect(document.querySelector('.popout-titlebar')).toBeTruthy()
    expect(document.querySelector('.popout-textarea')).toBeTruthy()
    expect(document.querySelector('.popout-send')).toBeTruthy()
    expect(document.querySelector('.popout-resize')).toBeTruthy()
  })

  it('emits update:open(false) when the close button is clicked', async () => {
    const wrapper = mountPopout({ open: true })
    const closeBtn = document.querySelectorAll('.popout-iconbtn')[1] as HTMLButtonElement
    closeBtn.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('emits update:modelValue when text is typed into the textarea (v-model sync)', async () => {
    const wrapper = mountPopout({ open: true, modelValue: '' })
    const ta = document.querySelector('.popout-textarea') as HTMLTextAreaElement
    ta.value = 'hello world'
    ta.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()
    const events = wrapper.emitted('update:modelValue') as string[][] | undefined
    expect(events).toBeTruthy()
    expect(events![events!.length - 1][0]).toBe('hello world')
  })

  it('emits submit on plain Enter and NOT on Shift+Enter / IME composition', async () => {
    const wrapper = mountPopout({ open: true, modelValue: 'hi' })
    const ta = document.querySelector('.popout-textarea') as HTMLTextAreaElement

    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }))
    expect(wrapper.emitted('submit')).toBeFalsy()

    // jsdom doesn't honour isComposing on the KeyboardEvent ctor; set it via Object.defineProperty.
    const ime = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    Object.defineProperty(ime, 'isComposing', { value: true })
    ta.dispatchEvent(ime)
    expect(wrapper.emitted('submit')).toBeFalsy()

    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(wrapper.emitted('submit')).toBeTruthy()
  })

  it('Escape inside the textarea closes the popout', async () => {
    const wrapper = mountPopout({ open: true, modelValue: 'draft' })
    const ta = document.querySelector('.popout-textarea') as HTMLTextAreaElement
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('double-click on the title bar toggles maximized state and back', async () => {
    const wrapper = mountPopout({ open: true })
    const titlebar = document.querySelector('.popout-titlebar') as HTMLElement
    titlebar.dispatchEvent(new Event('dblclick'))
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.composer-popout.is-maximized')).toBeTruthy()
    titlebar.dispatchEvent(new Event('dblclick'))
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.composer-popout.is-maximized')).toBeNull()
  })

  it('send button is disabled when textModel is empty and enabled when not', async () => {
    const wrapper = mountPopout({ open: true, modelValue: '' })
    let send = document.querySelector('.popout-send') as HTMLButtonElement
    expect(send.disabled).toBe(true)
    await wrapper.setProps({ modelValue: 'something' })
    send = document.querySelector('.popout-send') as HTMLButtonElement
    expect(send.disabled).toBe(false)
  })
})
