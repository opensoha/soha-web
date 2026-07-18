import { api } from '@/services/api-client'
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
import type { DaemonSet, DaemonSetDetail, DaemonSetTarget, ResourceMetrics } from './types'

const daemonSetKind = 'daemonsets' as const

function normalizeName(name: string) {
  const normalized = name.trim()
  if (!normalized) throw new Error('A DaemonSet name is required')
  return normalized
}

export function listDaemonSets(scope: DaemonSetTarget['scope']): Promise<DaemonSet[]> {
  return listWorkloads<DaemonSet>(daemonSetKind, scope)
}

export function getDaemonSetDetail(target: DaemonSetTarget): Promise<DaemonSetDetail> {
  return getWorkloadDetail<DaemonSetDetail>(daemonSetKind, target.scope, target.name)
}

export function getDaemonSetMetrics(target: DaemonSetTarget): Promise<ResourceMetrics> {
  return getWorkloadMetrics(daemonSetKind, target.scope, target.name)
}

export async function listDaemonSetEvents(target: DaemonSetTarget): Promise<WorkloadEvent[]> {
  const events = await listWorkloadEvents(target.scope, 100)
  const name = normalizeName(target.name)
  return events.filter(
    (event) =>
      event.involvedName === name &&
      (!event.involvedKind || event.involvedKind.toLowerCase() === 'daemonset'),
  )
}

export async function restartDaemonSet(target: DaemonSetTarget): Promise<void> {
  await api.post<unknown>(buildWorkloadActionPath(daemonSetKind, target.scope, 'restart'), {
    namespace: requireWorkloadNamespace(target.scope),
    name: normalizeName(target.name),
  })
}

export async function deleteDaemonSet(target: DaemonSetTarget): Promise<void> {
  await api.delete<unknown>(buildWorkloadItemPath(daemonSetKind, target.scope, target.name))
}
