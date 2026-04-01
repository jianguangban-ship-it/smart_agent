import { ref, computed } from 'vue'

export interface AttachedFile {
  name: string
  content: string
}

const attachedFile = ref<AttachedFile | null>(null)

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

  function detach() {
    attachedFile.value = null
  }

  const hasAttachment = computed(() => !!attachedFile.value)

  return { attachedFile, attach, detach, hasAttachment }
}
