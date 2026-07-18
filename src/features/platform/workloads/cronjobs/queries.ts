import { queryOptions } from '@tanstack/react-query'
import type { ScopeKey } from '@/types'
import { workloadKeys } from '@/features/platform/workloads/shared/keys'
import {
  hasNamespacedWorkloadScope,
  hasWorkloadCluster,
} from '@/features/platform/workloads/shared/scope'
import { getCronJobDetail, listCronJobEvents, listCronJobs } from './api'
import type { CronJob, CronJobDetail } from './types'

function target(scope: ScopeKey, name: string) {
  return { scope, name }
}

function hasCronJobReference(scope: ScopeKey, name: string) {
  return hasNamespacedWorkloadScope(scope) && Boolean(name.trim())
}

export const cronJobQueries = {
  list: (scope: ScopeKey) =>
    queryOptions<CronJob[]>({
      queryKey: workloadKeys.list('cronjobs', scope),
      queryFn: () => listCronJobs(scope),
      enabled: hasWorkloadCluster(scope),
    }),
  detail: (scope: ScopeKey, name: string) =>
    queryOptions<CronJobDetail>({
      queryKey: workloadKeys.detail('cronjobs', scope, name),
      queryFn: () => getCronJobDetail(target(scope, name)),
      enabled: hasCronJobReference(scope, name),
    }),
  events: (scope: ScopeKey, name: string) =>
    queryOptions({
      queryKey: workloadKeys.events('cronjobs', scope, name),
      queryFn: () => listCronJobEvents(target(scope, name)),
      enabled: hasCronJobReference(scope, name),
    }),
}
