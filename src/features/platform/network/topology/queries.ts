import { queryOptions } from '@tanstack/react-query'
import type { ScopeKey } from '@/types'
import { hasNetworkCluster } from '../shared/scope'
import { getNetworkTopology } from './api'
import { topologyKeys } from './keys'

export const topologyQueries = {
  detail: (scope: ScopeKey) =>
    queryOptions({
      queryKey: topologyKeys.detail(scope),
      queryFn: () => getNetworkTopology(scope),
      enabled: hasNetworkCluster(scope),
    }),
}
