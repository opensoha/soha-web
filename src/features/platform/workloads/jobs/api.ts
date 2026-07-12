import { api } from '@/services/api-client'
import { buildWorkloadItemPath } from '@/features/platform/workloads/shared/paths'
import {
  getWorkloadDetail,
  listWorkloadEvents,
  listWorkloads,
} from '@/features/platform/workloads/shared/api'
import type { WorkloadEvent } from '@/features/platform/workloads/shared/types'
import type { Job, JobDetail, JobTarget, Pod } from './types'

const jobKind = 'jobs' as const

function normalizedJobName(name: string) {
  const normalized = name.trim()
  if (!normalized) throw new Error('A job name is required')
  return normalized
}

export function listJobs(scope: JobTarget['scope']): Promise<Job[]> {
  return listWorkloads<Job>(jobKind, scope)
}

export function getJobDetail(target: JobTarget): Promise<JobDetail> {
  return getWorkloadDetail<JobDetail>(jobKind, target.scope, target.name)
}

export async function listJobEvents(target: JobTarget): Promise<WorkloadEvent[]> {
  const name = normalizedJobName(target.name)
  const events = await listWorkloadEvents(target.scope, 100)
  return events.filter(
    (event) =>
      event.involvedName === name &&
      (!event.involvedKind || event.involvedKind.toLowerCase() === 'job'),
  )
}

export async function listJobPods(target: JobTarget): Promise<Pod[]> {
  const name = normalizedJobName(target.name)
  const pods = await listWorkloads<Pod>('pods', target.scope)
  return pods.filter(
    (pod) =>
      pod.labels?.['job-name'] === name || pod.labels?.['batch.kubernetes.io/job-name'] === name,
  )
}

export async function deleteJob(target: JobTarget): Promise<void> {
  await api.delete<unknown>(buildWorkloadItemPath(jobKind, target.scope, target.name))
}
