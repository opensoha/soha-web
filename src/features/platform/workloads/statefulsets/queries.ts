import { queryOptions } from '@tanstack/react-query'
import type { ScopeKey } from '@/types'
import { workloadKeys } from '@/features/platform/workloads/shared/keys'
import {
  hasNamespacedWorkloadScope,
  hasWorkloadCluster,
} from '@/features/platform/workloads/shared/scope'
import {
  getStatefulSetDetail,
  getStatefulSetMetrics,
  listStatefulSetEvents,
  listStatefulSets,
} from './api'
import type { ResourceMetrics, StatefulSet, StatefulSetDetail } from './types'

function target(scope: ScopeKey, name: string) {
  return { scope, name }
}

function hasStatefulSetReference(scope: ScopeKey, name: string) {
  return hasNamespacedWorkloadScope(scope) && Boolean(name.trim())
}

export const statefulSetQueries = {
  list: (scope: ScopeKey) =>
    queryOptions<StatefulSet[]>({
      queryKey: workloadKeys.list('statefulsets', scope),
      queryFn: () => listStatefulSets(scope),
      enabled: hasWorkloadCluster(scope),
    }),
  detail: (scope: ScopeKey, name: string) =>
    queryOptions<StatefulSetDetail>({
      queryKey: workloadKeys.detail('statefulsets', scope, name),
      queryFn: () => getStatefulSetDetail(target(scope, name)),
      enabled: hasStatefulSetReference(scope, name),
    }),
  metrics: (scope: ScopeKey, name: string) =>
    queryOptions<ResourceMetrics>({
      queryKey: workloadKeys.metrics('statefulsets', scope, name),
      queryFn: () => getStatefulSetMetrics(target(scope, name)),
      enabled: hasStatefulSetReference(scope, name),
    }),
  events: (scope: ScopeKey, name: string) =>
    queryOptions({
      queryKey: workloadKeys.events('statefulsets', scope, name),
      queryFn: () => listStatefulSetEvents(target(scope, name)),
      enabled: hasStatefulSetReference(scope, name),
    }),
}
