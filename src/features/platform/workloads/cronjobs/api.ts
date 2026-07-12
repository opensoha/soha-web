import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import {
  getWorkloadDetail,
  listWorkloadEvents,
  listWorkloads,
} from '@/features/platform/workloads/shared/api'
import { buildWorkloadItemPath } from '@/features/platform/workloads/shared/paths'
import type { WorkloadEvent } from '@/features/platform/workloads/shared/types'
import type {
  CronJob,
  CronJobChildJob,
  CronJobDetail,
  CronJobTarget,
  SuspendCronJobVariables,
} from './types'

const cronJobKind = 'cronjobs' as const

function normalizedCronJobName(name: string) {
  const normalized = name.trim()
  if (!normalized) throw new Error('A cron job name is required')
  return normalized
}

function cronJobSubresourcePath(target: CronJobTarget, subresource: 'suspend') {
  const itemPath = buildWorkloadItemPath(cronJobKind, target.scope, target.name)
  const queryIndex = itemPath.indexOf('?')
  const item = queryIndex === -1 ? itemPath : itemPath.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : itemPath.slice(queryIndex)
  return `${item}/${subresource}${query}`
}

export function listCronJobs(scope: CronJobTarget['scope']): Promise<CronJob[]> {
  return listWorkloads<CronJob>(cronJobKind, scope)
}

export function getCronJobDetail(target: CronJobTarget): Promise<CronJobDetail> {
  return getWorkloadDetail<CronJobDetail>(cronJobKind, target.scope, target.name)
}

export async function listCronJobEvents(target: CronJobTarget): Promise<WorkloadEvent[]> {
  const name = normalizedCronJobName(target.name)
  const events = await listWorkloadEvents(target.scope, 100)
  return events.filter(
    (event) =>
      event.involvedName === name &&
      (!event.involvedKind || event.involvedKind.toLowerCase() === 'cronjob'),
  )
}

export async function listCronJobChildJobs(target: CronJobTarget): Promise<CronJobChildJob[]> {
  const prefix = `${normalizedCronJobName(target.name)}-`
  const jobs = await listWorkloads<CronJobChildJob>('jobs', target.scope)
  return jobs.filter((job) => job.name.startsWith(prefix))
}

export async function suspendCronJob({
  scope,
  name,
  suspend,
}: SuspendCronJobVariables): Promise<CronJobDetail> {
  const response = await api.post<ApiResponse<CronJobDetail>>(
    cronJobSubresourcePath({ scope, name }, 'suspend'),
    { suspend },
  )
  return response.data
}

export async function deleteCronJob(target: CronJobTarget): Promise<void> {
  await api.delete<unknown>(buildWorkloadItemPath(cronJobKind, target.scope, target.name))
}
