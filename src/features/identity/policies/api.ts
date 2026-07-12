import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import { normalizeIdentityPolicyFilters } from './keys'
import type {
  IdentityApplicationPolicy,
  IdentityPolicyFilters,
  UpdateIdentityPolicyVariables,
} from './types'

function queryString(filters: IdentityPolicyFilters) {
  const normalized = normalizeIdentityPolicyFilters(filters)
  const params = new URLSearchParams()
  if (normalized.query) params.set('q', normalized.query)
  if (normalized.status) params.set('status', normalized.status)
  if (normalized.limit !== undefined) params.set('limit', String(normalized.limit))
  if (normalized.offset !== undefined) params.set('offset', String(normalized.offset))
  const suffix = params.toString()
  return suffix ? `?${suffix}` : ''
}

export async function listIdentityPolicies(
  filters: IdentityPolicyFilters = {},
): Promise<IdentityApplicationPolicy[]> {
  const response = await api.get<ApiResponse<IdentityApplicationPolicy[]>>(
    `/identity/policies${queryString(filters)}`,
  )
  return response.data ?? []
}

export async function getIdentityPolicy(applicationId: string): Promise<IdentityApplicationPolicy> {
  const response = await api.get<ApiResponse<IdentityApplicationPolicy>>(
    `/identity/policies/${encodeURIComponent(applicationId.trim())}`,
  )
  return response.data
}

export async function updateIdentityPolicy({
  applicationId,
  input,
}: UpdateIdentityPolicyVariables): Promise<IdentityApplicationPolicy> {
  const response = await api.put<ApiResponse<IdentityApplicationPolicy>>(
    `/identity/policies/${encodeURIComponent(applicationId.trim())}`,
    input,
  )
  return response.data
}
