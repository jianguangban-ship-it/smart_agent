import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import JsonNode from '@/components/shared/JsonNode.vue'

// Mock i18n (JsonViewer uses it, but JsonNode doesn't — still needed for test env)
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    setLang: () => {},
    currentLang: { value: 'en' },
    isZh: { value: false }
  })
}))

function mountNode(value: unknown, opts?: { depth?: number; expandDepth?: number }) {
  return mount(JsonNode, {
    props: {
      value,
      depth: opts?.depth ?? 0,
      expandDepth: opts?.expandDepth ?? 2,
      generation: 0
    }
  })
}

describe('JsonNode', () => {
  describe('primitive values', () => {
    it('renders string with quotes and jv-string class', () => {
      const w = mountNode('hello')
      expect(w.find('.jv-string').exists()).toBe(true)
      expect(w.find('.jv-string').text()).toBe('"hello"')
    })

    it('renders number with jv-number class', () => {
      const w = mountNode(42)
      expect(w.find('.jv-number').exists()).toBe(true)
      expect(w.find('.jv-number').text()).toBe('42')
    })

    it('renders boolean with jv-boolean class', () => {
      const w = mountNode(true)
      expect(w.find('.jv-boolean').exists()).toBe(true)
      expect(w.find('.jv-boolean').text()).toBe('true')
    })

    it('renders null with jv-null class', () => {
      const w = mountNode(null)
      expect(w.find('.jv-null').exists()).toBe(true)
      expect(w.find('.jv-null').text()).toBe('null')
    })

    it('renders undefined with jv-null class', () => {
      const w = mountNode(undefined)
      expect(w.find('.jv-null').exists()).toBe(true)
      expect(w.find('.jv-null').text()).toBe('undefined')
    })
  })

  describe('objects', () => {
    it('renders object keys with jv-key class', () => {
      const w = mountNode({ name: 'Alice' })
      expect(w.find('.jv-key').exists()).toBe(true)
      expect(w.find('.jv-key').text()).toBe('name')
    })

    it('renders opening and closing braces', () => {
      const w = mountNode({ a: 1 })
      const brackets = w.findAll('.jv-bracket')
      const texts = brackets.map(b => b.text())
      expect(texts).toContain('{')
      expect(texts).toContain('}')
    })

    it('shows key count in metadata', () => {
      const w = mountNode({ a: 1, b: 2, c: 3 })
      expect(w.find('.jv-meta').text()).toBe('3 keys')
    })

    it('shows singular key count', () => {
      const w = mountNode({ only: true })
      expect(w.find('.jv-meta').text()).toBe('1 key')
    })

    it('renders nested object values', () => {
      const w = mountNode({ outer: { inner: 'deep' } })
      expect(w.text()).toContain('inner')
      expect(w.text()).toContain('"deep"')
    })
  })

  describe('arrays', () => {
    it('renders square brackets', () => {
      const w = mountNode([1, 2])
      const brackets = w.findAll('.jv-bracket')
      const texts = brackets.map(b => b.text())
      expect(texts).toContain('[')
      expect(texts).toContain(']')
    })

    it('shows item count in metadata', () => {
      const w = mountNode([1, 2, 3])
      expect(w.find('.jv-meta').text()).toBe('3 items')
    })

    it('shows singular item count', () => {
      const w = mountNode(['only'])
      expect(w.find('.jv-meta').text()).toBe('1 item')
    })

    it('renders array element values', () => {
      const w = mountNode(['hello', 42])
      expect(w.text()).toContain('"hello"')
      expect(w.text()).toContain('42')
    })
  })

  describe('collapse / expand', () => {
    it('is expanded when depth < expandDepth', () => {
      const w = mountNode({ a: 1 }, { depth: 0, expandDepth: 2 })
      expect(w.find('.jv-children').exists()).toBe(true)
      expect(w.find('.jv-preview').exists()).toBe(false)
    })

    it('is collapsed when depth >= expandDepth', () => {
      const w = mountNode({ a: 1 }, { depth: 2, expandDepth: 2 })
      expect(w.find('.jv-children').exists()).toBe(false)
      expect(w.find('.jv-preview').exists()).toBe(true)
      expect(w.find('.jv-preview').text()).toBe('...')
    })

    it('toggles on caret click', async () => {
      const w = mountNode({ a: 1 }, { depth: 0, expandDepth: 2 })
      expect(w.find('.jv-children').exists()).toBe(true)

      await w.find('.jv-toggle').trigger('click')
      expect(w.find('.jv-children').exists()).toBe(false)
      expect(w.find('.jv-preview').exists()).toBe(true)

      await w.find('.jv-toggle').trigger('click')
      expect(w.find('.jv-children').exists()).toBe(true)
    })

    it('reacts to generation change (expand/collapse all)', async () => {
      const w = mountNode({ a: 1 }, { depth: 0, expandDepth: 2 })
      expect(w.find('.jv-children').exists()).toBe(true)

      // Simulate collapseAll: expandDepth=0, generation++
      await w.setProps({ expandDepth: 0, generation: 1 })
      expect(w.find('.jv-children').exists()).toBe(false)

      // Simulate expandAll: expandDepth=999, generation++
      await w.setProps({ expandDepth: 999, generation: 2 })
      expect(w.find('.jv-children').exists()).toBe(true)
    })
  })

  describe('commas', () => {
    it('renders commas between entries but not after last', () => {
      const w = mountNode({ a: 1, b: 2, c: 3 })
      const commas = w.findAll('.jv-comma')
      expect(commas.length).toBe(2)
    })
  })

  describe('empty containers', () => {
    it('renders empty object with 0 keys', () => {
      const w = mountNode({})
      expect(w.find('.jv-meta').text()).toBe('0 keys')
    })

    it('renders empty array with 0 items', () => {
      const w = mountNode([])
      expect(w.find('.jv-meta').text()).toBe('0 items')
    })
  })
})
