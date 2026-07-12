export type IdentityOutpostMode = 'embedded' | 'agent' | 'kubernetes' | 'external'
export type IdentityOutpostStatus = 'online' | 'offline' | 'degraded'

export interface IdentityOutpost {
  id: string
  name: string
  mode: IdentityOutpostMode
  endpoint?: string
  token?: string
  status: IdentityOutpostStatus
  version?: string
  lastSeenAt?: string
  metadata?: Record<string, unknown>
  createdBy?: string
  updatedBy?: string
  createdAt: string
  updatedAt: string
}

export interface IdentityOutpostInput {
  name: string
  mode: IdentityOutpostMode
  endpoint?: string
  status: IdentityOutpostStatus
  version?: string
  metadata: Record<string, unknown>
}

export interface IdentityOutpostFilters {
  mode?: IdentityOutpostMode | ''
  status?: IdentityOutpostStatus | ''
  limit?: number
  offset?: number
}

export interface UpdateIdentityOutpostVariables {
  outpostId: string
  input: IdentityOutpostInput
}
