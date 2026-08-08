import { queryOptions } from '@tanstack/react-query'
import { clusterQueries } from '@/features/platform/clusters/queries'
import { getOverviewMonitoringSummary, getOverviewWorkload } from './api'
import { platformOverviewKeys } from './keys'

export const platformOverviewQueries = {
  clusters: clusterQueries.list,
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
