import { buildClusterScopedPath } from '@/features/platform/platform-scope-query'
import { listClusters } from '@/features/platform/clusters/api'
import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type { AlertSummary, WorkloadOverview } from './types'

export function listOverviewClusters() {
  return listClusters()
}

export function getOverviewMonitoringSummary() {
  return api.get<ApiResponse<AlertSummary>>('/monitoring/summary')
}

export function getOverviewWorkload(clusterId: string) {
  return api.get<ApiResponse<WorkloadOverview>>(
    buildClusterScopedPath(clusterId, 'workloads/overview', null),
  )
}
