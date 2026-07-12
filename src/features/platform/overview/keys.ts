import { clusterKeys } from '../clusters/keys'

export const platformOverviewKeys = {
  clusters: clusterKeys.legacyList,
  monitoringSummary: () => ['monitoring-summary'] as const,
  workload: (clusterId: string | null | undefined) =>
    ['overview-workload', clusterId, '__all__'] as const,
}
