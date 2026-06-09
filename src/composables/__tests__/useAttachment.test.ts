import { describe, it, expect, beforeEach } from 'vitest'
import {
  useAttachment,
  inlineAttachments,
  buildMultimodalContent,
  stripImageContent,
  MAX_ATTACH_BYTES,
  MAX_IMAGE_BYTES,
} from '../useAttachment'
import type { Attachment, LLMContentPart } from '@/types/api'

function textFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/plain' })
}
function imageFile(name: string, bytes = 10): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' })
}

describe('useAttachment (multi-file)', () => {
  const { attachedFiles, attach, attachValidated, detach, detachAll, hasAttachment } = useAttachment()

  beforeEach(() => detachAll())

  it('appends multiple files', async () => {
    await attach(textFile('a.txt', 'aaa'))
    await attach(textFile('b.md', 'bbb'))
    expect(attachedFiles.value.map(f => f.name)).toEqual(['a.txt', 'b.md'])
    expect(hasAttachment.value).toBe(true)
    expect(attachedFiles.value[0].content).toBe('aaa')
    expect(attachedFiles.value[0].size).toBeGreaterThan(0)
  })

  it('replaces (de-dupes) a file re-added by the same name', async () => {
    await attach(textFile('a.txt', 'first'))
    await attach(textFile('a.txt', 'second'))
    expect(attachedFiles.value).toHaveLength(1)
    expect(attachedFiles.value[0].content).toBe('second')
  })

  it('removes one file by name and clears all', async () => {
    await attach(textFile('a.txt', 'aaa'))
    await attach(textFile('b.txt', 'bbb'))
    detach('a.txt')
    expect(attachedFiles.value.map(f => f.name)).toEqual(['b.txt'])
    detachAll()
    expect(attachedFiles.value).toHaveLength(0)
    expect(hasAttachment.value).toBe(false)
  })

  it('rejects blocked (binary) file types', async () => {
    // .png is now an accepted image; use a still-blocked binary type.
    await expect(attachValidated(textFile('archive.zip', 'x'))).rejects.toBe('type')
    expect(attachedFiles.value).toHaveLength(0)
  })

  it('rejects files over the per-file size limit', async () => {
    const big = textFile('big.txt', 'x'.repeat(MAX_ATTACH_BYTES + 1))
    await expect(attachValidated(big)).rejects.toBe('size')
    expect(attachedFiles.value).toHaveLength(0)
  })
})

describe('inlineAttachments', () => {
  const files: Attachment[] = [
    { name: 'a.txt', size: 3, content: 'AAA' },
    { name: 'b.txt', size: 3, content: 'BBB' },
  ]

  it('returns the text unchanged when there are no files', () => {
    expect(inlineAttachments('hello', [])).toBe('hello')
  })

  it('prepends each file block in order, then the user text', () => {
    const out = inlineAttachments('my question', files)
    expect(out).toContain('[Attached file: a.txt]\n\nAAA')
    expect(out).toContain('[Attached file: b.txt]\n\nBBB')
    expect(out.indexOf('a.txt')).toBeLessThan(out.indexOf('b.txt'))
    expect(out.endsWith('my question')).toBe(true)
  })

  it('grows the byte size for multibyte (Chinese) file content', () => {
    const ascii = inlineAttachments('q', [{ name: 'f', size: 3, content: 'abc' }])
    const zh = inlineAttachments('q', [{ name: 'f', size: 9, content: '你好吗' }])
    const enc = new TextEncoder()
    expect(enc.encode(zh).length).toBeGreaterThan(enc.encode(ascii).length)
  })

  it('renders images as a placeholder, never their base64', () => {
    const out = inlineAttachments('look', [{ name: 'pic.png', size: 9, content: 'data:image/png;base64,AAAA', kind: 'image' }])
    expect(out).toContain('[Image: pic.png]')
    expect(out).not.toContain('base64')
    expect(out.endsWith('look')).toBe(true)
  })
})

describe('multi-modal image attachments', () => {
  const { attachedFiles, attach, attachValidated, detachAll } = useAttachment()
  beforeEach(() => detachAll())

  it('reads an image as a base64 data URL with kind="image"', async () => {
    await attach(imageFile('shot.png'))
    const f = attachedFiles.value[0]
    expect(f.kind).toBe('image')
    expect(f.mime).toBe('image/png')
    expect(f.content.startsWith('data:')).toBe(true)
  })

  it('rejects images over the image size limit', async () => {
    await expect(attachValidated(imageFile('big.png', MAX_IMAGE_BYTES + 1))).rejects.toBe('size')
    expect(attachedFiles.value).toHaveLength(0)
  })
})

describe('buildMultimodalContent', () => {
  it('returns a plain string when there are no images', () => {
    const out = buildMultimodalContent('hi', [{ name: 'a.txt', size: 1, content: 'A', kind: 'text' }])
    expect(typeof out).toBe('string')
  })

  it('returns text + image_url parts when images are present', () => {
    const files: Attachment[] = [
      { name: 'a.txt', size: 1, content: 'A', kind: 'text' },
      { name: 'p.png', size: 9, content: 'data:image/png;base64,XXXX', kind: 'image' },
    ]
    const out = buildMultimodalContent('describe', files) as LLMContentPart[]
    expect(Array.isArray(out)).toBe(true)
    const textPart = out.find(p => p.type === 'text')
    const imgPart = out.find(p => p.type === 'image_url')
    expect(textPart).toBeTruthy()
    expect(imgPart).toMatchObject({ type: 'image_url', image_url: { url: 'data:image/png;base64,XXXX' } })
  })
})

describe('stripImageContent', () => {
  it('blanks image content but keeps text content', () => {
    const stripped = stripImageContent([
      { name: 'a.txt', size: 1, content: 'KEEP', kind: 'text' },
      { name: 'p.png', size: 9, content: 'data:image/png;base64,XXXX', kind: 'image' },
    ])!
    expect(stripped[0].content).toBe('KEEP')
    expect(stripped[1].content).toBe('')
    expect(stripped[1].kind).toBe('image')
  })
})
