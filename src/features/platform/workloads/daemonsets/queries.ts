import { queryOptions } from '@tanstack/react-query'
import type { ScopeKey } from '@/types'
import { workloadKeys } from '@/features/platform/workloads/shared/keys'
import {
  hasNamespacedWorkloadScope,
  hasWorkloadCluster,
} from '@/features/platform/workloads/shared/scope'
import { getDaemonSetDetail, getDaemonSetMetrics, listDaemonSetEvents, listDaemonSets } from './api'
import type { DaemonSet, DaemonSetDetail, ResourceMetrics } from './types'

function target(scope: ScopeKey, name: string) {
  return { scope, name }
}

function hasDaemonSetReference(scope: ScopeKey, name: string) {
  return hasNamespacedWorkloadScope(scope) && Boolean(name.trim())
}

export const daemonSetQueries = {
  list: (scope: ScopeKey) =>
    queryOptions<DaemonSet[]>({
      queryKey: workloadKeys.list('daemonsets', scope),
      queryFn: () => listDaemonSets(scope),
      enabled: hasWorkloadCluster(scope),
    }),
  detail: (scope: ScopeKey, name: string) =>
    queryOptions<DaemonSetDetail>({
      queryKey: workloadKeys.detail('daemonsets', scope, name),
      queryFn: () => getDaemonSetDetail(target(scope, name)),
      enabled: hasDaemonSetReference(scope, name),
    }),
  metrics: (scope: ScopeKey, name: string) =>
    queryOptions<ResourceMetrics>({
      queryKey: workloadKeys.metrics('daemonsets', scope, name),
      queryFn: () => getDaemonSetMetrics(target(scope, name)),
      enabled: hasDaemonSetReference(scope, name),
    }),
  events: (scope: ScopeKey, name: string) =>
    queryOptions({
      queryKey: workloadKeys.events('daemonsets', scope, name),
      queryFn: () => listDaemonSetEvents(target(scope, name)),
      enabled: hasDaemonSetReference(scope, name),
    }),
}
