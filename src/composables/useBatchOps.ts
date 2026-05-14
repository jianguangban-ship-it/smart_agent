import { ref, computed } from 'vue'
import type { TaskLevel } from '@/config/domain/traceability.task'

export interface BatchRequirement {
  id: string
  summary: string
  description: string
  level: TaskLevel
  parentReqId: string
  issueType: 'Story' | 'Task' | 'Bug' | 'Feature'
  qualityScore: number
  selected: boolean
}

const LS_KEY = 'batch-requirements'

function loadBatch(): BatchRequirement[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const batchItems = ref<BatchRequirement[]>(loadBatch())

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(batchItems.value))
}

let _idCounter = 0

export function useBatchOps() {
  const selectedCount = computed(() => batchItems.value.filter(b => b.selected).length)

  function addItem(item: Omit<BatchRequirement, 'id' | 'qualityScore' | 'selected'>) {
    const qualityScore = Math.min(100, (item.summary ? 20 : 0) + (item.description.length > 20 ? 40 : 0) + (item.level !== 'none' ? 20 : 0) + (item.parentReqId ? 20 : 0))

    batchItems.value.push({
      ...item,
      id: `batch-${Date.now()}-${++_idCounter}`,
      qualityScore,
      selected: true
    })
    save()
  }

  function removeItem(id: string) {
    batchItems.value = batchItems.value.filter(b => b.id !== id)
    save()
  }

  function toggleItem(id: string) {
    const item = batchItems.value.find(b => b.id === id)
    if (item) {
      item.selected = !item.selected
      save()
    }
  }

  function toggleAll(val: boolean) {
    batchItems.value.forEach(b => { b.selected = val })
    save()
  }

  function clearBatch() {
    batchItems.value = []
    save()
  }

  /** Parse CSV text into batch items */
  function importCSV(csvText: string): number {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) return 0

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"(.*)"$/, '$1'))
    const summaryIdx = headers.findIndex(h => h === 'summary' || h === '摘要')
    const descIdx = headers.findIndex(h => h === 'description' || h === '描述')
    const typeIdx = headers.findIndex(h => h === 'issue type' || h === 'type' || h === '类型')
    const levelIdx = headers.findIndex(h => h === 'requirement level' || h === 'level' || h === '层级')
    const parentIdx = headers.findIndex(h => h === 'parent requirement' || h === 'parent' || h === '上级需求')

    if (summaryIdx === -1) return 0

    let count = 0
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      const summary = cols[summaryIdx]?.trim()
      if (!summary) continue

      addItem({
        summary,
        description: cols[descIdx]?.trim() || '',
        issueType: (cols[typeIdx]?.trim() as 'Story' | 'Task' | 'Bug' | 'Feature') || 'Task',
        level: (cols[levelIdx]?.trim() as TaskLevel) || 'none',
        parentReqId: cols[parentIdx]?.trim() || ''
      })
      count++
    }
    return count
  }

  /** Generate decomposition items from a system requirement */
  function decompose(
    parentSummary: string,
    parentDescription: string,
    parentId: string,
    targetLevels: TaskLevel[]
  ) {
    for (const level of targetLevels) {
      addItem({
        summary: `[${level.toUpperCase()}] Derived from: ${parentSummary}`,
        description: `Derived from parent requirement: ${parentId}\n\nOriginal: ${parentDescription}\n\n---\n\n*Fill in the ${level}-level requirement details.*`,
        issueType: 'Task',
        level,
        parentReqId: parentId
      })
    }
  }

  return {
    batchItems,
    selectedCount,
    addItem,
    removeItem,
    toggleItem,
    toggleAll,
    clearBatch,
    importCSV,
    decompose
  }
}

// ─── CSV parser (handles quoted fields) ──────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}
