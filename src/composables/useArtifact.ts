import { ref, computed } from 'vue'

/**
 * Currently-open artifact in the Explore right-side viewer. A long code block
 * (collapsed to a card in the chat) opens here when clicked. Single shared
 * singleton — mirrors the useToast / useAttachment pattern.
 */
export interface OpenArtifact {
  code: string
  filename: string
  mime: string
  /** highlight.js language token (e.g. 'c', 'python'). */
  lang: string
  /** Human label (e.g. 'C', 'Python'). */
  label: string
  lines: number
}

const current = ref<OpenArtifact | null>(null)

export function useArtifact() {
  const isOpen = computed(() => current.value !== null)

  function open(meta: OpenArtifact): void {
    current.value = meta
  }

  function close(): void {
    current.value = null
  }

  return { current, isOpen, open, close }
}
