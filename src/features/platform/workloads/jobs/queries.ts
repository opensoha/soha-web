import { queryOptions } from '@tanstack/react-query'
import type { ScopeKey } from '@/types'
import { workloadKeys } from '@/features/platform/workloads/shared/keys'
import {
  hasNamespacedWorkloadScope,
  hasWorkloadCluster,
} from '@/features/platform/workloads/shared/scope'
import { getJobDetail, listJobEvents, listJobs } from './api'
import type { Job, JobDetail } from './types'

function target(scope: ScopeKey, name: string) {
  return { scope, name }
}

function hasJobReference(scope: ScopeKey, name: string) {
  return hasNamespacedWorkloadScope(scope) && Boolean(name.trim())
}

export const jobQueries = {
  list: (scope: ScopeKey) =>
    queryOptions<Job[]>({
      queryKey: workloadKeys.list('jobs', scope),
      queryFn: () => listJobs(scope),
      enabled: hasWorkloadCluster(scope),
    }),
  detail: (scope: ScopeKey, name: string) =>
    queryOptions<JobDetail>({
      queryKey: workloadKeys.detail('jobs', scope, name),
      queryFn: () => getJobDetail(target(scope, name)),
      enabled: hasJobReference(scope, name),
    }),
  events: (scope: ScopeKey, name: string) =>
    queryOptions({
      queryKey: workloadKeys.events('jobs', scope, name),
      queryFn: () => listJobEvents(target(scope, name)),
      enabled: hasJobReference(scope, name),
    }),
}
