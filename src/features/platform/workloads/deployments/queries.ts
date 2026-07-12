import { queryOptions } from '@tanstack/react-query'
import type { Pod, ScopeKey } from '@/types'
import { workloadKeys } from '@/features/platform/workloads/shared/keys'
import {
  hasNamespacedWorkloadScope,
  hasWorkloadCluster,
} from '@/features/platform/workloads/shared/scope'
import {
  getDeploymentDetail,
  getDeploymentMetrics,
  getDeploymentRolloutStatus,
  listDeploymentEvents,
  listDeploymentPods,
  listDeploymentRollouts,
  listDeployments,
} from './api'
import type {
  Deployment,
  DeploymentDetail,
  DeploymentRolloutStatus,
  ResourceMetrics,
  RolloutHistory,
} from './types'

function target(scope: ScopeKey, name: string) {
  return { scope, name }
}

function hasDeploymentReference(scope: ScopeKey, name: string) {
  return hasNamespacedWorkloadScope(scope) && Boolean(name.trim())
}

export const deploymentQueries = {
  list: (scope: ScopeKey) =>
    queryOptions<Deployment[]>({
      queryKey: workloadKeys.list('deployments', scope),
      queryFn: () => listDeployments(scope),
      enabled: hasWorkloadCluster(scope),
    }),
  detail: (scope: ScopeKey, name: string) =>
    queryOptions<DeploymentDetail>({
      queryKey: workloadKeys.detail('deployments', scope, name),
      queryFn: () => getDeploymentDetail(target(scope, name)),
      enabled: hasDeploymentReference(scope, name),
    }),
  metrics: (scope: ScopeKey, name: string) =>
    queryOptions<ResourceMetrics>({
      queryKey: workloadKeys.metrics('deployments', scope, name),
      queryFn: () => getDeploymentMetrics(target(scope, name)),
      enabled: hasDeploymentReference(scope, name),
    }),
  rolloutStatus: (scope: ScopeKey, name: string) =>
    queryOptions<DeploymentRolloutStatus>({
      queryKey: workloadKeys.rolloutStatus(scope, name),
      queryFn: () => getDeploymentRolloutStatus(target(scope, name)),
      enabled: hasDeploymentReference(scope, name),
    }),
  rollouts: (scope: ScopeKey, name: string) =>
    queryOptions<RolloutHistory[]>({
      queryKey: workloadKeys.rollouts(scope, name),
      queryFn: () => listDeploymentRollouts(target(scope, name)),
      enabled: hasDeploymentReference(scope, name),
    }),
  events: (scope: ScopeKey, name: string) =>
    queryOptions({
      queryKey: workloadKeys.events('deployments', scope, name),
      queryFn: () => listDeploymentEvents(target(scope, name)),
      enabled: hasDeploymentReference(scope, name),
    }),
  pods: (scope: ScopeKey, name: string, selector: Record<string, string>) =>
    queryOptions<Pod[]>({
      queryKey: workloadKeys.relatedPods('deployments', scope, name, selector),
      queryFn: () => listDeploymentPods(target(scope, name), selector),
      enabled: hasDeploymentReference(scope, name) && Object.keys(selector).length > 0,
    }),
}
