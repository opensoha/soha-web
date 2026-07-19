import { queryOptions } from '@tanstack/react-query'
import { deliveryApi } from './api'
import {
  deliveryKeys,
  normalizeDeliveryId,
  normalizeDeliveryListParams,
  normalizeDeploymentRef,
  normalizeGatewayReadinessParams,
  normalizeTargetCandidateParams,
  normalizeWorkloadMetricsRef,
  normalizeWorkloadRef,
  normalizeRepositoryListParams,
  normalizeGitReferenceParams,
  normalizeGitCommitParams,
} from './keys'
import type {
  DeliveryDeploymentRef,
  DeliveryGatewayReadinessParams,
  DeliveryListParams,
  DeliveryRuntimeKind,
  DeliveryTargetCandidateParams,
  DeliveryWorkloadMetricsRef,
  DeliveryWorkloadRef,
  RepositoryListParams,
  GitReferenceParams,
  GitCommitParams,
} from './types'

export interface DeliveryQueryOptions {
  enabled?: boolean
  refetchInterval?: number | false
}

function hasValue(value: string) {
  return Boolean(value.trim())
}

function pollingOptions(options: DeliveryQueryOptions) {
  return {
    enabled: options.enabled ?? true,
    ...(options.refetchInterval !== undefined ? { refetchInterval: options.refetchInterval } : {}),
  }
}

export const deliveryQueries = {
  repositories: {
    list: (params: RepositoryListParams = {}, enabled = true) => {
      const normalized = normalizeRepositoryListParams(params)
      return queryOptions({ queryKey: deliveryKeys.repositories.list(normalized), queryFn: () => deliveryApi.repositories.list(normalized), enabled })
    },
    gitProjects: (params: RepositoryListParams = {}, enabled = true) => {
      const normalized = normalizeRepositoryListParams(params)
      return queryOptions({ queryKey: deliveryKeys.repositories.gitProjects(normalized), queryFn: () => deliveryApi.gitlab.projects(normalized), enabled })
    },
    gitBranches: (params: GitReferenceParams, enabled = true) => {
      const normalized = normalizeGitReferenceParams(params)
      return queryOptions({ queryKey: deliveryKeys.repositories.gitBranches(normalized), queryFn: () => deliveryApi.gitlab.branches(normalized), enabled: enabled && hasValue(normalized.projectId) })
    },
    gitTags: (params: GitReferenceParams, enabled = true) => {
      const normalized = normalizeGitReferenceParams(params)
      return queryOptions({ queryKey: deliveryKeys.repositories.gitTags(normalized), queryFn: () => deliveryApi.gitlab.tags(normalized), enabled: enabled && hasValue(normalized.projectId) })
    },
    gitCommits: (params: GitCommitParams, enabled = true) => {
      const normalized = normalizeGitCommitParams(params)
      return queryOptions({ queryKey: deliveryKeys.repositories.gitCommits(normalized), queryFn: () => deliveryApi.gitlab.commits(normalized), enabled: enabled && hasValue(normalized.projectId) })
    },
  },
  applications: {
    list: (enabled = true) =>
      queryOptions({
        queryKey: deliveryKeys.applications.list(),
        queryFn: deliveryApi.applications.list,
        enabled,
      }),
    detail: (id: string, enabled = true) => {
      const applicationId = normalizeDeliveryId(id)
      return queryOptions({
        queryKey: deliveryKeys.applications.detail(applicationId),
        queryFn: () => deliveryApi.applications.detail(applicationId),
        enabled: enabled && hasValue(applicationId),
      })
    },
    runtime: (id: string, enabled = true) => {
      const applicationId = normalizeDeliveryId(id)
      return queryOptions({
        queryKey: deliveryKeys.applications.runtime(applicationId),
        queryFn: () => deliveryApi.applications.runtime(applicationId),
        enabled: enabled && hasValue(applicationId),
      })
    },
    services: (id: string, enabled = true) => {
      const applicationId = normalizeDeliveryId(id)
      return queryOptions({
        queryKey: deliveryKeys.applications.services(applicationId),
        queryFn: () => deliveryApi.applications.services(applicationId),
        enabled: enabled && hasValue(applicationId),
      })
    },
  },
  environments: {
    list: (enabled = true) =>
      queryOptions({
        queryKey: deliveryKeys.environments.list(),
        queryFn: deliveryApi.environments.list,
        enabled,
      }),
    detail: (id: string, enabled = true) => {
      const environmentId = normalizeDeliveryId(id)
      return queryOptions({
        queryKey: deliveryKeys.environments.detail(environmentId),
        queryFn: () => deliveryApi.environments.detail(environmentId),
        enabled: enabled && hasValue(environmentId),
      })
    },
    targetCandidates: (params: DeliveryTargetCandidateParams, enabled = true) => {
      const normalized = normalizeTargetCandidateParams(params)
      return queryOptions({
        queryKey: deliveryKeys.environments.targetCandidates(normalized),
        queryFn: () => deliveryApi.environments.targetCandidates(normalized),
        enabled: enabled && hasValue(normalized.clusterId) && hasValue(normalized.namespace),
      })
    },
  },
  buildTemplates: {
    list: (enabled = true) =>
      queryOptions({
        queryKey: deliveryKeys.buildTemplates.list(),
        queryFn: deliveryApi.buildTemplates.list,
        enabled,
      }),
    usage: (id: string, enabled = true) => {
      const templateId = normalizeDeliveryId(id)
      return queryOptions({
        queryKey: deliveryKeys.buildTemplates.usage(templateId),
        queryFn: () => deliveryApi.buildTemplates.usage(templateId),
        enabled: enabled && hasValue(templateId),
      })
    },
  },
  workflowTemplates: {
    list: (enabled = true) =>
      queryOptions({
        queryKey: deliveryKeys.workflowTemplates.list(),
        queryFn: deliveryApi.workflowTemplates.list,
        enabled,
      }),
    usage: (id: string, enabled = true) => {
      const templateId = normalizeDeliveryId(id)
      return queryOptions({
        queryKey: deliveryKeys.workflowTemplates.usage(templateId),
        queryFn: () => deliveryApi.workflowTemplates.usage(templateId),
        enabled: enabled && hasValue(templateId),
      })
    },
  },
  blueprints: {
    list: (enabled = true) =>
      queryOptions({
        queryKey: deliveryKeys.blueprints.list(),
        queryFn: deliveryApi.blueprints.list,
        enabled,
      }),
    usage: (id: string, enabled = true) => {
      const blueprintId = normalizeDeliveryId(id)
      return queryOptions({
        queryKey: deliveryKeys.blueprints.usage(blueprintId),
        queryFn: () => deliveryApi.blueprints.usage(blueprintId),
        enabled: enabled && hasValue(blueprintId),
      })
    },
  },
  builds: {
    list: (params: DeliveryListParams = {}, enabled = true) => {
      const normalized = normalizeDeliveryListParams(params)
      return queryOptions({
        queryKey: deliveryKeys.builds.list(normalized),
        queryFn: () => deliveryApi.builds.list(normalized),
        enabled,
      })
    },
  },
  workflows: {
    list: (params: DeliveryListParams = {}, options: DeliveryQueryOptions = {}) => {
      const normalized = normalizeDeliveryListParams(params)
      return queryOptions({
        queryKey: deliveryKeys.workflows.list(normalized),
        queryFn: () => deliveryApi.workflows.list(normalized),
        ...pollingOptions(options),
      })
    },
  },
  releases: {
    list: (params: DeliveryListParams = {}, options: DeliveryQueryOptions = {}) => {
      const normalized = normalizeDeliveryListParams(params)
      return queryOptions({
        queryKey: deliveryKeys.releases.list(normalized),
        queryFn: () => deliveryApi.releases.list(normalized),
        ...pollingOptions(options),
      })
    },
  },
  registries: {
    list: (enabled = true) =>
      queryOptions({
        queryKey: deliveryKeys.registries.list(),
        queryFn: deliveryApi.registries.list,
        enabled,
      }),
  },
  releaseBoard: {
    list: (options: DeliveryQueryOptions = {}) =>
      queryOptions({
        queryKey: deliveryKeys.releaseBoard.list(),
        queryFn: deliveryApi.releaseBoard.list,
        ...pollingOptions(options),
      }),
  },
  releaseBundles: {
    list: (options: DeliveryQueryOptions = {}) =>
      queryOptions({
        queryKey: deliveryKeys.releaseBundles.list(),
        queryFn: deliveryApi.releaseBundles.list,
        ...pollingOptions(options),
      }),
    artifacts: (id: string, enabled = true) => {
      const bundleId = normalizeDeliveryId(id)
      return queryOptions({
        queryKey: deliveryKeys.releaseBundles.artifacts(bundleId),
        queryFn: () => deliveryApi.releaseBundles.artifacts(bundleId),
        enabled: enabled && hasValue(bundleId),
      })
    },
  },
  executionTasks: {
    list: (options: DeliveryQueryOptions = {}) =>
      queryOptions({
        queryKey: deliveryKeys.executionTasks.list(),
        queryFn: deliveryApi.executionTasks.list,
        ...pollingOptions(options),
      }),
    logs: (id: string, options: DeliveryQueryOptions = {}) => {
      const taskId = normalizeDeliveryId(id)
      return queryOptions({
        queryKey: deliveryKeys.executionTasks.logs(taskId),
        queryFn: () => deliveryApi.executionTasks.logs(taskId),
        ...pollingOptions({
          ...options,
          enabled: (options.enabled ?? true) && hasValue(taskId),
        }),
      })
    },
    artifacts: (id: string, enabled = true) => {
      const taskId = normalizeDeliveryId(id)
      return queryOptions({
        queryKey: deliveryKeys.executionTasks.artifacts(taskId),
        queryFn: () => deliveryApi.executionTasks.artifacts(taskId),
        enabled: enabled && hasValue(taskId),
      })
    },
  },
  runtime: {
    detail: (kind: DeliveryRuntimeKind, id: string, enabled = true) => {
      const recordId = normalizeDeliveryId(id)
      return queryOptions({
        queryKey: deliveryKeys.runtime.detail(kind, recordId),
        queryFn: () => deliveryApi.runtime.detail(kind, recordId),
        enabled: enabled && hasValue(recordId),
      })
    },
  },
  workloads: {
    runtime: (ref: DeliveryWorkloadRef, enabled = true) => {
      const normalized = normalizeWorkloadRef(ref)
      return queryOptions({
        queryKey: deliveryKeys.workloads.runtime(normalized),
        queryFn: () => deliveryApi.workloads.runtime(normalized),
        enabled:
          enabled &&
          hasValue(normalized.applicationId) &&
          hasValue(normalized.applicationEnvironmentId) &&
          hasValue(normalized.workloadName),
      })
    },
    metrics: (ref: DeliveryWorkloadMetricsRef, enabled = true) => {
      const normalized = normalizeWorkloadMetricsRef(ref)
      return queryOptions({
        queryKey: deliveryKeys.workloads.metrics(normalized),
        queryFn: () => deliveryApi.workloads.metrics(normalized),
        enabled:
          enabled &&
          hasValue(normalized.clusterId) &&
          hasValue(normalized.namespace) &&
          hasValue(normalized.workloadName),
      })
    },
  },
  deployments: {
    rollouts: (ref: DeliveryDeploymentRef, enabled = true) => {
      const normalized = normalizeDeploymentRef(ref)
      return queryOptions({
        queryKey: deliveryKeys.deployments.rollouts(normalized),
        queryFn: () => deliveryApi.deployments.rollouts(normalized),
        enabled:
          enabled &&
          hasValue(normalized.clusterId) &&
          hasValue(normalized.namespace) &&
          hasValue(normalized.workloadName),
      })
    },
  },
  gateway: {
    readiness: (params: DeliveryGatewayReadinessParams, enabled = true) => {
      const normalized = normalizeGatewayReadinessParams(params)
      return queryOptions({
        queryKey: deliveryKeys.gateway.readiness(normalized),
        queryFn: () => deliveryApi.gateway.readiness(normalized),
        enabled,
        retry: false,
        staleTime: 30_000,
      })
    },
  },
  dependencies: {
    clusters: (enabled = true) =>
      queryOptions({
        queryKey: deliveryKeys.dependencies.clusters(),
        queryFn: deliveryApi.dependencies.clusters,
        enabled,
      }),
  },
}

export const runtimeDetailQueries = {
  detail: (kind: DeliveryRuntimeKind, id: string, enabled = true) =>
    deliveryQueries.runtime.detail(kind, id, enabled),
}
