export interface TeamMember {
  id: string
  name: string
  role?: string
}

export interface ProjectConfig {
  name: string
  key: string
  teamName: string
}

/** Built-in project keys (compile-time). Runtime JSON may add more. */
export type ProjectKey = string

export type TeamMembersMap = Record<string, TeamMember[]>
