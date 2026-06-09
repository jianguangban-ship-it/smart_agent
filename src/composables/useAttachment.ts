import { ref, computed } from 'vue'
import type { Attachment, LLMContentPart } from '@/types/api'

/** Back-compat alias — the attachment shape is the shared `Attachment` type. */
export type AttachedFile = Attachment

/** Composer file-loading: multiple attachments, shared singleton list. */
const attachedFiles = ref<Attachment[]>([])

/** Hint list for the file picker's `accept` attribute (not the real filter —
 *  validation uses the blocklist below). Covers the common text/code/doc types. */
export const ATTACH_ACCEPT_HINT = [
  '.txt', '.md', '.markdown', '.html', '.htm', '.svg', '.json', '.xml', '.csv', '.yaml', '.yml',
  '.py', '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.cs', '.java', '.js', '.jsx', '.ts', '.tsx',
  '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.m', '.mm', '.sh', '.bash', '.ps1',
  '.sql', '.css', '.scss', '.less', '.vue', '.toml', '.ini', '.cfg', '.lua', '.r', '.pl'
].join(',')

/** Image types accepted for multi-modal (vision) input — read as data URLs. */
export const IMAGE_ACCEPT_HINT = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].join(',')
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

function isImageName(name: string): boolean {
  const lower = name.toLowerCase()
  return IMAGE_EXTS.some(ext => lower.endsWith(ext))
}

/**
 * Extensions rejected by the composer file picker. The composer accepts ANY
 * text-readable file (so "any code" works without enumerating every language)
 * plus the vision image types above, EXCEPT these clearly-binary / document /
 * archive / media types which would only show garbled content as text.
 */
export const BLOCKED_ATTACH_EXTS = [
  // non-vision images (poor model inputs)
  '.bmp', '.ico', '.tif', '.tiff',
  // documents / office binary
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // archives
  '.zip', '.rar', '.7z', '.tar', '.gz',
  // media
  '.mp3', '.mp4', '.mov', '.avi', '.wav', '.mkv',
  // executables / libraries
  '.exe', '.dll', '.bin', '.so', '.dylib',
  // fonts
  '.woff', '.woff2', '.ttf', '.otf'
] as const

/** Max attachment size (per text file) — keeps the prepended payload sane. */
export const MAX_ATTACH_BYTES = 512 * 1024
/** Max image size (per file). Base64 inflates ~1.33×, so keep this modest. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export type AttachError = 'type' | 'size'

export function useAttachment() {
  function attach(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const image = isImageName(file.name)
      const reader = new FileReader()
      reader.onload = (e) => {
        const entry: Attachment = {
          name: file.name,
          size: file.size,
          content: e.target?.result as string,
          kind: image ? 'image' : 'text',
          ...(image ? { mime: file.type || 'image/png' } : {})
        }
        // Replace any existing entry with the same name (re-picking a file updates it),
        // otherwise append. Keeps the list de-duplicated by filename.
        const idx = attachedFiles.value.findIndex(f => f.name === entry.name)
        if (idx >= 0) attachedFiles.value.splice(idx, 1, entry)
        else attachedFiles.value.push(entry)
        resolve()
      }
      reader.onerror = () => reject(reader.error)
      // Images → base64 data URL (for vision); text → plain text.
      if (image) reader.readAsDataURL(file)
      else reader.readAsText(file)
    })
  }

  /**
   * Validate by type + size before reading. Images (vision) are read as data
   * URLs with a larger cap; everything else must be a text-readable file (not in
   * the blocklist) within the text cap. Rejects with an `AttachError` so callers
   * can map it to a localized toast.
   */
  function attachValidated(file: File): Promise<void> {
    if (isImageName(file.name)) {
      if (file.size > MAX_IMAGE_BYTES) return Promise.reject<void>('size' as AttachError)
      return attach(file)
    }
    const lower = file.name.toLowerCase()
    const blocked = BLOCKED_ATTACH_EXTS.some(ext => lower.endsWith(ext))
    if (blocked) return Promise.reject<void>('type' as AttachError)
    if (file.size > MAX_ATTACH_BYTES) return Promise.reject<void>('size' as AttachError)
    return attach(file)
  }

  /** Remove a single attachment by filename. */
  function detach(name: string) {
    const idx = attachedFiles.value.findIndex(f => f.name === name)
    if (idx >= 0) attachedFiles.value.splice(idx, 1)
  }

  /** Clear all attachments (e.g. after a successful send). */
  function detachAll() {
    attachedFiles.value = []
  }

  const hasAttachment = computed(() => attachedFiles.value.length > 0)

  return { attachedFiles, attach, attachValidated, detach, detachAll, hasAttachment }
}

/**
 * Single source of truth for how attached files are folded into outgoing
 * model text. Each file becomes an `[Attached file: name]` block; the user's
 * text follows last. Returns `text` unchanged when `files` is empty.
 *
 * Called ONLY when building the upstream API payload (apiMessages) — never for
 * the displayed/persisted message, which keeps `content` clean so the bubble can
 * render file cards instead of a wall of file text.
 */
export function inlineAttachments(text: string, files: readonly Attachment[]): string {
  if (!files.length) return text
  // Images are NEVER inlined as text (no base64 in the text payload or token
  // guard) — they go through buildMultimodalContent as image parts. Here they're
  // only a short placeholder so the text path / direct path stay sane.
  const blocks = files.map(f =>
    f.kind === 'image'
      ? `[Image: ${f.name}]`
      : `[Attached file: ${f.name}]\n\n${f.content}`
  )
  return `${blocks.join('\n\n---\n\n')}\n\n---\n\n${text}`
}

/**
 * Build the message content for a multi-modal (vision) turn. Returns a plain
 * string when there are no images (identical to inlineAttachments), else an
 * array of OpenAI content parts: a single text part (user text + any text-file
 * bodies inlined) followed by one image_url part per image. Used ONLY on the
 * brokered Explore path.
 */
export function buildMultimodalContent(
  text: string,
  files: readonly Attachment[]
): string | LLMContentPart[] {
  const images = files.filter(f => f.kind === 'image' && f.content)
  if (!images.length) return inlineAttachments(text, files)
  const textFiles = files.filter(f => f.kind !== 'image')
  const textPart = inlineAttachments(text, textFiles)
  const parts: LLMContentPart[] = []
  if (textPart) parts.push({ type: 'text', text: textPart })
  for (const img of images) parts.push({ type: 'image_url', image_url: { url: img.content } })
  return parts
}

/**
 * Return a copy of the attachments with image `content` blanked, for
 * persistence. Image base64 is session-only (it can exceed the localStorage
 * quota), so history/localStorage keep only the metadata + a placeholder.
 */
export function stripImageContent(files?: Attachment[]): Attachment[] | undefined {
  if (!files) return files
  return files.map(f => (f.kind === 'image' ? { ...f, content: '' } : f))
}

/** Convenience wrapper that inlines the CURRENT composer attachments into `text`. */
export function applyAttachment(text: string): string {
  return inlineAttachments(text, attachedFiles.value)
}
