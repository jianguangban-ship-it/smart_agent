import { ref } from 'vue'

// Shared "current selection" context — the team / project / assignee the user
// last picked in the Task form. EAX has no login, so this is the best available
// "who is acting" signal for traceability. It is stamped onto every
// client-originated Activity log (auditClient.logClientEvent) and sent with the
// brokered /api/llm/chat request so server-side logs can attribute the action.
//
// Lives client-side per browser tab and is sent per-request — deliberately NOT
// a server global, which would leak one workstation's selection into another's
// logs. Empty strings mean "nothing selected yet" (e.g. Explore before any
// Task-form pick); consumers should treat empty fields as absent.
export interface SelectionContext {
  team_key: string
  project: string
  assignee: string
}

export const selectionContext = ref<SelectionContext>({
  team_key: '',
  project: '',
  assignee: '',
})

export function setSelectionContext(ctx: SelectionContext): void {
  selectionContext.value = ctx
}

/** Non-empty fields only — for merging into a log detail without blank keys. */
export function selectionContextFields(): Partial<SelectionContext> {
  const c = selectionContext.value
  const out: Partial<SelectionContext> = {}
  if (c.team_key) out.team_key = c.team_key
  if (c.project) out.project = c.project
  if (c.assignee) out.assignee = c.assignee
  return out
}
