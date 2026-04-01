import { ref, computed } from 'vue'
import en from './en'
import zh from './zh'

export type Lang = 'en' | 'zh'
type Messages = typeof en

const messages = { en, zh } as Record<Lang, Record<string, unknown>>

const currentLang = ref<Lang>(
  (localStorage.getItem('jira-terminal-lang') as Lang) || 'zh'
)

/** Reactive language ref — importable outside components (e.g. config modules) */
export { currentLang }

export function useI18n() {
  function t(key: string): string {
    const keys = key.split('.')
    let value: unknown = messages[currentLang.value]
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[k]
      } else {
        return key
      }
    }
    return (typeof value === 'string' ? value : key) as string
  }

  function setLang(lang: Lang) {
    currentLang.value = lang
    localStorage.setItem('jira-terminal-lang', lang)
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }

  const isZh = computed(() => currentLang.value === 'zh')

  return { t, setLang, currentLang, isZh }
}
