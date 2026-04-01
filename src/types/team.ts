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

export type ProjectKey = 'HW' | 'DKKF' | 'DKKG' | 'DKKFT' | 'SWSS' | 'SWBS' | 'SWVV' | 'SWCD' | 'SWSU' | 'PMVSS' | 'PMVBS' | 'PMVSU'

export type TeamMembersMap = Record<ProjectKey, TeamMember[]>
