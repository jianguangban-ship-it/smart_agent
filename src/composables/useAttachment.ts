import { ref, computed } from 'vue'

export interface AttachedFile {
  name: string
  content: string
}

/** Composer file-loading: single attachment, shared singleton. */
const attachedFile = ref<AttachedFile | null>(null)

/** Extensions accepted by the Explore composer file picker. */
export const ALLOWED_ATTACH_EXTS = [
  '.md', '.markdown', '.txt', '.html', '.htm', '.json'
] as const

/** Max attachment size — keeps the prepended payload sane. */
export const MAX_ATTACH_BYTES = 512 * 1024

export type AttachError = 'type' | 'size'

export function useAttachment() {
  function attach(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        attachedFile.value = {
          name: file.name,
          content: e.target?.result as string
        }
        resolve()
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file)
    })
  }

  /**
   * Validate by extension allow-list + size before reading. Rejects with an
   * `AttachError` so callers can map it to a localized toast. `readAsText`
   * handles .md/.html/.json uniformly — no per-type parsing.
   */
  function attachValidated(file: File): Promise<void> {
    const lower = file.name.toLowerCase()
    const okExt = ALLOWED_ATTACH_EXTS.some(ext => lower.endsWith(ext))
    if (!okExt) return Promise.reject<void>('type' as AttachError)
    if (file.size > MAX_ATTACH_BYTES) return Promise.reject<void>('size' as AttachError)
    return attach(file)
  }

  function detach() {
    attachedFile.value = null
  }

  const hasAttachment = computed(() => !!attachedFile.value)

  return { attachedFile, attach, attachValidated, detach, hasAttachment }
}

/**
 * Single source of truth for how an attached file is folded into outgoing
 * composer text. Returns `text` unchanged when nothing is attached.
 */
export function applyAttachment(text: string): string {
  const f = attachedFile.value
  return f
    ? `[Attached file: ${f.name}]\n\n${f.content}\n\n---\n\n${text}`
    : text
}
