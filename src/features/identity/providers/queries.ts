import { queryOptions } from '@tanstack/react-query'
import { getIdentityProvider, listIdentityOIDCClients, listIdentityProviders } from './api'
import { identityProviderKeys, normalizeIdentityProviderFilters } from './keys'
import type { IdentityProviderFilters } from './types'

export const identityProviderQueries = {
  list: (filters: IdentityProviderFilters = {}) => {
    const normalized = normalizeIdentityProviderFilters(filters)
    return queryOptions({
      queryKey: identityProviderKeys.list(normalized),
      queryFn: () => listIdentityProviders(normalized),
    })
  },
  detail: (providerId: string) => {
    const normalizedId = providerId.trim()
    return queryOptions({
      queryKey: identityProviderKeys.detail(normalizedId),
      queryFn: () => getIdentityProvider(normalizedId),
      enabled: Boolean(normalizedId),
    })
  },
  oidcClients: (providerId: string, enabled = true) => {
    const normalizedId = providerId.trim()
    return queryOptions({
      queryKey: identityProviderKeys.oidcClients(normalizedId),
      queryFn: () => listIdentityOIDCClients(normalizedId),
      enabled: enabled && Boolean(normalizedId),
    })
  },
}
