import { api } from '@/services/api-client'
import type { Pod } from '@/types'
import {
  getWorkloadDetail,
  getWorkloadMetrics,
  listWorkloadEvents,
  listWorkloads,
} from '@/features/platform/workloads/shared/api'
import {
  buildWorkloadActionPath,
  buildWorkloadItemPath,
} from '@/features/platform/workloads/shared/paths'
import { requireWorkloadNamespace } from '@/features/platform/workloads/shared/scope'
import type { WorkloadEvent } from '@/features/platform/workloads/shared/types'
import type {
  ResourceMetrics,
  ScaleStatefulSetVariables,
  StatefulSet,
  StatefulSetDetail,
  StatefulSetTarget,
} from './types'

const statefulSetKind = 'statefulsets' as const

function normalizeName(name: string) {
  const normalized = name.trim()
  if (!normalized) throw new Error('A StatefulSet name is required')
  return normalized
}

function matchesSelector(selector: Record<string, string>, labels?: Record<string, string>) {
  const entries = Object.entries(selector)
  return entries.length > 0 && entries.every(([key, value]) => labels?.[key] === value)
}

export function listStatefulSets(scope: StatefulSetTarget['scope']): Promise<StatefulSet[]> {
  return listWorkloads<StatefulSet>(statefulSetKind, scope)
}

export function getStatefulSetDetail(target: StatefulSetTarget): Promise<StatefulSetDetail> {
  return getWorkloadDetail<StatefulSetDetail>(statefulSetKind, target.scope, target.name)
}

export function getStatefulSetMetrics(target: StatefulSetTarget): Promise<ResourceMetrics> {
  return getWorkloadMetrics(statefulSetKind, target.scope, target.name)
}

export async function listStatefulSetEvents(target: StatefulSetTarget): Promise<WorkloadEvent[]> {
  const events = await listWorkloadEvents(target.scope, 100)
  const name = normalizeName(target.name)
  return events.filter(
    (event) =>
      event.involvedName === name &&
      (!event.involvedKind || event.involvedKind.toLowerCase() === 'statefulset'),
  )
}

export async function listStatefulSetPods(
  target: StatefulSetTarget,
  selector: Record<string, string>,
): Promise<Pod[]> {
  const pods = await listWorkloads<Pod>('pods', target.scope)
  return pods.filter((pod) => matchesSelector(selector, pod.labels))
}

export async function restartStatefulSet(target: StatefulSetTarget): Promise<void> {
  await api.post<unknown>(buildWorkloadActionPath(statefulSetKind, target.scope, 'restart'), {
    namespace: requireWorkloadNamespace(target.scope),
    name: normalizeName(target.name),
  })
}

export async function scaleStatefulSet({
  scope,
  name,
  replicas,
}: ScaleStatefulSetVariables): Promise<void> {
  await api.post<unknown>(buildWorkloadActionPath(statefulSetKind, scope, 'scale'), {
    namespace: requireWorkloadNamespace(scope),
    name: normalizeName(name),
    replicas,
  })
}

export async function deleteStatefulSet(target: StatefulSetTarget): Promise<void> {
  await api.delete<unknown>(buildWorkloadItemPath(statefulSetKind, target.scope, target.name))
}
