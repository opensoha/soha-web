import { queryOptions } from '@tanstack/react-query'
import { clusterQueries } from '@/features/platform/clusters/queries'
import { getOverviewMonitoringSummary, getOverviewWorkload } from './api'
import { platformOverviewKeys } from './keys'

export const platformOverviewQueries = {
  clusters: clusterQueries.list,
  monitoringSummary: (enabled = true) =>
    queryOptions({
      queryKey: platformOverviewKeys.monitoringSummary(),
      queryFn: getOverviewMonitoringSummary,
      enabled,
    }),
  workload: (clusterId: string | null | undefined, enabled = true) =>
    queryOptions({
      queryKey: platformOverviewKeys.workload(clusterId),
      queryFn: () => getOverviewWorkload(clusterId!),
      enabled: enabled && Boolean(clusterId),
    }),
}
