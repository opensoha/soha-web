import { queryOptions } from '@tanstack/react-query'
import type { ScopeKey } from '@/types'
import { getClusterDetail, listClusterNodes, listClusters } from './api'
import { clusterKeys } from './keys'
import type { Cluster, ClusterDetail, Node } from './types'

function hasCluster(scope: ScopeKey) {
  return Boolean(scope.clusterId?.trim())
}

export const clusterQueries = {
  list: () =>
    queryOptions<Cluster[]>({
      queryKey: clusterKeys.list(),
      queryFn: listClusters,
    }),
  detail: (scope: ScopeKey) =>
    queryOptions<ClusterDetail>({
      queryKey: clusterKeys.detail(scope),
      queryFn: () => getClusterDetail({ scope }),
      enabled: hasCluster(scope),
    }),
  nodes: (scope: ScopeKey) =>
    queryOptions<Node[]>({
      queryKey: clusterKeys.nodes(scope),
      queryFn: () => listClusterNodes({ scope }),
      enabled: hasCluster(scope),
    }),
}
