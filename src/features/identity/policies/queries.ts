import { queryOptions } from '@tanstack/react-query'
import { getIdentityPolicy, listIdentityPolicies } from './api'
import { identityPolicyKeys, normalizeIdentityPolicyFilters } from './keys'
import type { IdentityPolicyFilters } from './types'

export const identityPolicyQueries = {
  list: (filters: IdentityPolicyFilters = {}) => {
    const normalized = normalizeIdentityPolicyFilters(filters)
    return queryOptions({
      queryKey: identityPolicyKeys.list(normalized),
      queryFn: () => listIdentityPolicies(normalized),
    })
  },
  detail: (applicationId: string) => {
    const normalizedId = applicationId.trim()
    return queryOptions({
      queryKey: identityPolicyKeys.detail(normalizedId),
      queryFn: () => getIdentityPolicy(normalizedId),
      enabled: Boolean(normalizedId),
    })
  },
}
