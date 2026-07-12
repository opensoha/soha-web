import { queryOptions } from '@tanstack/react-query'
import { listIdentityApplications, listIdentityProviderCapabilities } from './api'
import { identityApplicationKeys, identityProviderCapabilityKeys } from './keys'
import type { IdentityApplicationFilters } from './types'

export const identityApplicationQueries = {
  list: (filters: IdentityApplicationFilters) =>
    queryOptions({
      queryKey: identityApplicationKeys.list(filters),
      queryFn: () => listIdentityApplications(filters),
    }),
  providerCapabilities: () =>
    queryOptions({
      queryKey: identityProviderCapabilityKeys.all,
      queryFn: listIdentityProviderCapabilities,
    }),
}
