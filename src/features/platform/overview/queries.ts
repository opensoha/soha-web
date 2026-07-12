import { queryOptions } from '@tanstack/react-query'
import { getOverviewMonitoringSummary, getOverviewWorkload, listOverviewClusters } from './api'
import { platformOverviewKeys } from './keys'

export const platformOverviewQueries = {
  clusters: () =>
    queryOptions({
      queryKey: platformOverviewKeys.clusters(),
      queryFn: listOverviewClusters,
    }),
  monitoringSummary: () =>
    queryOptions({
      queryKey: platformOverviewKeys.monitoringSummary(),
      queryFn: getOverviewMonitoringSummary,
    }),
  workload: (clusterId: string | null | undefined) =>
    queryOptions({
      queryKey: platformOverviewKeys.workload(clusterId),
      queryFn: () => getOverviewWorkload(clusterId!),
      enabled: Boolean(clusterId),
    }),
}
