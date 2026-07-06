import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'

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
  mode?: string
  status?: string
}

export const identityOutpostQueryKeys = {
  outposts: (filters: IdentityOutpostFilters) => ['identity', 'outposts', filters] as const,
}

function queryString(filters: IdentityOutpostFilters) {
  const params = new URLSearchParams()
  if (filters.mode?.trim()) params.set('mode', filters.mode.trim())
  if (filters.status?.trim()) params.set('status', filters.status.trim())
  const suffix = params.toString()
  return suffix ? `?${suffix}` : ''
}

export function listIdentityOutposts(filters: IdentityOutpostFilters) {
  return api
    .get<ApiResponse<IdentityOutpost[]>>(`/identity/outposts${queryString(filters)}`)
    .then((res) => res.data ?? [])
}

export function createIdentityOutpost(input: IdentityOutpostInput) {
  return api
    .post<ApiResponse<IdentityOutpost>>('/identity/outposts', input)
    .then((res) => res.data)
}

export function updateIdentityOutpost(outpostId: string, input: IdentityOutpostInput) {
  return api
    .put<ApiResponse<IdentityOutpost>>(`/identity/outposts/${encodeURIComponent(outpostId)}`, input)
    .then((res) => res.data)
}

export function deleteIdentityOutpost(outpostId: string) {
  return api.delete<ApiResponse<{ status: string }>>(
    `/identity/outposts/${encodeURIComponent(outpostId)}`,
  )
}
