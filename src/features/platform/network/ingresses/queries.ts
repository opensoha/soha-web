import { queryOptions } from '@tanstack/react-query'
import type { ScopeKey } from '@/types'
import { hasNamespacedNetworkScope, hasNetworkCluster } from '../shared/scope'
import { getIngress, listIngresses } from './api'
import { ingressKeys } from './keys'

function hasReference(scope: ScopeKey, name: string) {
  return hasNamespacedNetworkScope(scope) && Boolean(name.trim())
}

export const ingressQueries = {
  list: (scope: ScopeKey) =>
    queryOptions({
      queryKey: ingressKeys.list(scope),
      queryFn: () => listIngresses(scope),
      enabled: hasNetworkCluster(scope),
    }),
  detail: (scope: ScopeKey, name: string) =>
    queryOptions({
      queryKey: ingressKeys.detail(scope, name),
      queryFn: () => getIngress(scope, name),
      enabled: hasReference(scope, name),
    }),
}
