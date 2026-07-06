import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type {
  IdentityApplicationPolicy,
  IdentityApplicationPolicyInput,
} from '@/features/provider-portal/provider-portal-api'

export interface IdentityPolicyFilters {
  query?: string
  status?: string
}

export const identityPolicyQueryKeys = {
  policies: (filters: IdentityPolicyFilters) => ['identity', 'policies', filters] as const,
  policy: (applicationId: string) => ['identity', 'policies', applicationId] as const,
}

function queryString(filters: IdentityPolicyFilters) {
  const params = new URLSearchParams()
  if (filters.query?.trim()) params.set('q', filters.query.trim())
  if (filters.status?.trim()) params.set('status', filters.status.trim())
  const suffix = params.toString()
  return suffix ? `?${suffix}` : ''
}

export function listIdentityPolicies(filters: IdentityPolicyFilters) {
  return api
    .get<ApiResponse<IdentityApplicationPolicy[]>>(`/identity/policies${queryString(filters)}`)
    .then((res) => res.data ?? [])
}

export function updateIdentityPolicy(
  applicationId: string,
  input: IdentityApplicationPolicyInput,
) {
  return api
    .put<ApiResponse<IdentityApplicationPolicy>>(
      `/identity/policies/${encodeURIComponent(applicationId)}`,
      input,
    )
    .then((res) => res.data)
}
