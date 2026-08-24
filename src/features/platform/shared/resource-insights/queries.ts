import { queryOptions } from '@tanstack/react-query'
import type { ScopeKey } from '@/types'
import { getKubernetesResourceGraph, getKubernetesSecurityPosture } from './api'
import { resourceInsightKeys } from './keys'

export const resourceInsightQueries = {
  graph: (scope: ScopeKey, kind: string, name: string) =>
    queryOptions({
      queryKey: resourceInsightKeys.graph(scope, kind, name),
      queryFn: () => getKubernetesResourceGraph(scope, kind, name),
      enabled: Boolean(scope.clusterId && kind.trim() && name.trim()),
    }),
  posture: (scope: ScopeKey, limit = 100) =>
    queryOptions({
      queryKey: resourceInsightKeys.posture(scope, limit),
      queryFn: () => getKubernetesSecurityPosture(scope, limit),
      enabled: Boolean(scope.clusterId),
    }),
}
