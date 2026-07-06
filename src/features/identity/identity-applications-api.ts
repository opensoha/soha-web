import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type {
  IdentityApplication,
  IdentityApplicationInput,
  IdentityProviderType,
} from '@/features/provider-portal/provider-portal-api'

export interface IdentityApplicationFilters {
  query?: string
  status?: string
}

export interface IdentityProviderCapability {
  type: IdentityProviderType
  status: string
  endpoints: string[]
  description?: string
}

export const identityApplicationQueryKeys = {
  applications: (filters: IdentityApplicationFilters) =>
    ['identity', 'applications', filters] as const,
  providerCapabilities: ['identity', 'provider-capabilities'] as const,
}

function queryString(filters: IdentityApplicationFilters) {
  const params = new URLSearchParams()
  if (filters.query?.trim()) params.set('q', filters.query.trim())
  if (filters.status?.trim()) params.set('status', filters.status.trim())
  const suffix = params.toString()
  return suffix ? `?${suffix}` : ''
}

export function listIdentityApplications(filters: IdentityApplicationFilters) {
  return api
    .get<ApiResponse<IdentityApplication[]>>(`/identity/applications${queryString(filters)}`)
    .then((res) => res.data ?? [])
}

export function createIdentityApplication(input: IdentityApplicationInput) {
  return api
    .post<ApiResponse<IdentityApplication>>('/identity/applications', input)
    .then((res) => res.data)
}

export function updateIdentityApplication(applicationId: string, input: IdentityApplicationInput) {
  return api
    .put<ApiResponse<IdentityApplication>>(
      `/identity/applications/${encodeURIComponent(applicationId)}`,
      input,
    )
    .then((res) => res.data)
}

export function deleteIdentityApplication(applicationId: string) {
  return api.delete<ApiResponse<{ status: string }>>(
    `/identity/applications/${encodeURIComponent(applicationId)}`,
  )
}

export function listIdentityProviderCapabilities() {
  return api
    .get<ApiResponse<IdentityProviderCapability[]>>('/identity/provider-capabilities')
    .then((res) => res.data ?? [])
}
