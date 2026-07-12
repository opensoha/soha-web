import type {
  DeliveryDeploymentRef,
  DeliveryGatewayReadinessParams,
  DeliveryListParams,
  DeliveryRuntimeKind,
  DeliveryTargetCandidateParams,
  DeliveryWorkloadMetricsRef,
  DeliveryWorkloadRef,
} from './types'

const ROOT = ['delivery'] as const
const APPLICATIONS = [...ROOT, 'applications'] as const
const ENVIRONMENTS = [...ROOT, 'environments'] as const
const BUILD_TEMPLATES = [...ROOT, 'templates', 'build'] as const
const WORKFLOW_TEMPLATES = [...ROOT, 'templates', 'workflow'] as const
const BLUEPRINTS = [...ROOT, 'blueprints'] as const
const BUILDS = [...ROOT, 'builds'] as const
const WORKFLOWS = [...ROOT, 'workflows'] as const
const RELEASES = [...ROOT, 'releases'] as const
const REGISTRIES = [...ROOT, 'registries'] as const
const RELEASE_BOARD = [...ROOT, 'release-board'] as const
const RELEASE_BUNDLES = [...ROOT, 'release-bundles'] as const
const EXECUTION_TASKS = [...ROOT, 'execution-tasks'] as const
const RUNTIME = [...ROOT, 'runtime'] as const
const WORKLOADS = [...ROOT, 'workloads'] as const
const DEPLOYMENTS = [...ROOT, 'deployments'] as const
const GATEWAY = [...ROOT, 'gateway'] as const
const DRAFTS = [...ROOT, 'drafts'] as const
const PLANS = [...ROOT, 'plans'] as const
const DEPENDENCIES = [...ROOT, 'dependencies'] as const

export function normalizeDeliveryId(id: string) {
  return id.trim()
}

export function normalizeDeliveryListParams(params: DeliveryListParams = {}): DeliveryListParams {
  const applicationId = params.applicationId?.trim()
  return applicationId ? { applicationId } : {}
}

export function normalizeTargetCandidateParams(
  params: DeliveryTargetCandidateParams,
): DeliveryTargetCandidateParams {
  return {
    clusterId: params.clusterId.trim(),
    namespace: params.namespace.trim(),
  }
}

export function normalizeWorkloadRef(ref: DeliveryWorkloadRef): DeliveryWorkloadRef {
  return {
    applicationId: ref.applicationId.trim(),
    applicationEnvironmentId: ref.applicationEnvironmentId.trim(),
    workloadName: ref.workloadName.trim(),
  }
}

export function normalizeWorkloadMetricsRef(
  ref: DeliveryWorkloadMetricsRef,
): Required<DeliveryWorkloadMetricsRef> {
  return {
    clusterId: ref.clusterId.trim(),
    namespace: ref.namespace.trim(),
    workloadName: ref.workloadName.trim(),
    rangeMinutes: ref.rangeMinutes ?? 60,
  }
}

export function normalizeDeploymentRef(ref: DeliveryDeploymentRef): DeliveryDeploymentRef {
  return {
    clusterId: ref.clusterId.trim(),
    namespace: ref.namespace.trim(),
    workloadName: ref.workloadName.trim(),
  }
}

export function normalizeGatewayReadinessParams(
  params: DeliveryGatewayReadinessParams,
): Required<DeliveryGatewayReadinessParams> {
  return {
    skillId: params.skillId.trim(),
    source: params.source?.trim() || 'delivery-workbench',
  }
}

export const deliveryKeys = {
  all: ROOT,
  applications: {
    all: APPLICATIONS,
    lists: [...APPLICATIONS, 'list'] as const,
    list: () => [...APPLICATIONS, 'list'] as const,
    details: [...APPLICATIONS, 'detail'] as const,
    detail: (id: string) => [...APPLICATIONS, 'detail', normalizeDeliveryId(id)] as const,
    runtime: (id: string) =>
      [...APPLICATIONS, 'detail', normalizeDeliveryId(id), 'runtime'] as const,
    services: (id: string) =>
      [...APPLICATIONS, 'detail', normalizeDeliveryId(id), 'services'] as const,
  },
  environments: {
    all: ENVIRONMENTS,
    lists: [...ENVIRONMENTS, 'list'] as const,
    list: () => [...ENVIRONMENTS, 'list'] as const,
    details: [...ENVIRONMENTS, 'detail'] as const,
    detail: (id: string) => [...ENVIRONMENTS, 'detail', normalizeDeliveryId(id)] as const,
    targetCandidates: (params: DeliveryTargetCandidateParams) =>
      [...ENVIRONMENTS, 'target-candidates', normalizeTargetCandidateParams(params)] as const,
  },
  buildTemplates: {
    all: BUILD_TEMPLATES,
    list: () => [...BUILD_TEMPLATES, 'list'] as const,
    detail: (id: string) => [...BUILD_TEMPLATES, 'detail', normalizeDeliveryId(id)] as const,
    usage: (id: string) =>
      [...BUILD_TEMPLATES, 'detail', normalizeDeliveryId(id), 'usage'] as const,
  },
  workflowTemplates: {
    all: WORKFLOW_TEMPLATES,
    list: () => [...WORKFLOW_TEMPLATES, 'list'] as const,
    detail: (id: string) => [...WORKFLOW_TEMPLATES, 'detail', normalizeDeliveryId(id)] as const,
    usage: (id: string) =>
      [...WORKFLOW_TEMPLATES, 'detail', normalizeDeliveryId(id), 'usage'] as const,
  },
  blueprints: {
    all: BLUEPRINTS,
    list: () => [...BLUEPRINTS, 'list'] as const,
    detail: (id: string) => [...BLUEPRINTS, 'detail', normalizeDeliveryId(id)] as const,
    usage: (id: string) => [...BLUEPRINTS, 'detail', normalizeDeliveryId(id), 'usage'] as const,
  },
  builds: {
    all: BUILDS,
    list: (params: DeliveryListParams = {}) =>
      [...BUILDS, 'list', normalizeDeliveryListParams(params)] as const,
  },
  workflows: {
    all: WORKFLOWS,
    list: (params: DeliveryListParams = {}) =>
      [...WORKFLOWS, 'list', normalizeDeliveryListParams(params)] as const,
  },
  releases: {
    all: RELEASES,
    list: (params: DeliveryListParams = {}) =>
      [...RELEASES, 'list', normalizeDeliveryListParams(params)] as const,
  },
  registries: {
    all: REGISTRIES,
    list: () => [...REGISTRIES, 'list'] as const,
  },
  releaseBoard: {
    all: RELEASE_BOARD,
    list: () => [...RELEASE_BOARD, 'list'] as const,
  },
  releaseBundles: {
    all: RELEASE_BUNDLES,
    list: () => [...RELEASE_BUNDLES, 'list'] as const,
    detail: (id: string) => [...RELEASE_BUNDLES, 'detail', normalizeDeliveryId(id)] as const,
    artifacts: (id: string) =>
      [...RELEASE_BUNDLES, 'detail', normalizeDeliveryId(id), 'artifacts'] as const,
  },
  executionTasks: {
    all: EXECUTION_TASKS,
    list: () => [...EXECUTION_TASKS, 'list'] as const,
    detail: (id: string) => [...EXECUTION_TASKS, 'detail', normalizeDeliveryId(id)] as const,
    logs: (id: string) => [...EXECUTION_TASKS, 'detail', normalizeDeliveryId(id), 'logs'] as const,
    artifacts: (id: string) =>
      [...EXECUTION_TASKS, 'detail', normalizeDeliveryId(id), 'artifacts'] as const,
  },
  runtime: {
    all: RUNTIME,
    detail: (kind: DeliveryRuntimeKind, id: string) =>
      [...RUNTIME, 'detail', kind, normalizeDeliveryId(id)] as const,
  },
  workloads: {
    all: WORKLOADS,
    runtime: (ref: DeliveryWorkloadRef) =>
      [...WORKLOADS, 'runtime', normalizeWorkloadRef(ref)] as const,
    metrics: (ref: DeliveryWorkloadMetricsRef) =>
      [...WORKLOADS, 'metrics', normalizeWorkloadMetricsRef(ref)] as const,
  },
  deployments: {
    all: DEPLOYMENTS,
    rollouts: (ref: DeliveryDeploymentRef) =>
      [...DEPLOYMENTS, 'rollouts', normalizeDeploymentRef(ref)] as const,
  },
  gateway: {
    all: GATEWAY,
    readiness: (params: DeliveryGatewayReadinessParams) =>
      [...GATEWAY, 'readiness', normalizeGatewayReadinessParams(params)] as const,
  },
  drafts: {
    all: DRAFTS,
    detail: (id: string) => [...DRAFTS, 'detail', normalizeDeliveryId(id)] as const,
  },
  plans: {
    all: PLANS,
    detail: (id: string) => [...PLANS, 'detail', normalizeDeliveryId(id)] as const,
  },
  dependencies: {
    all: DEPENDENCIES,
    clusters: () => [...DEPENDENCIES, 'clusters'] as const,
  },
}

export const deliveryMutationKeys = {
  all: [...ROOT, 'mutation'] as const,
  applications: (action: string) => [...deliveryMutationKeys.all, 'applications', action] as const,
  applicationServices: (action: string) =>
    [...deliveryMutationKeys.all, 'application-services', action] as const,
  environments: (action: string) => [...deliveryMutationKeys.all, 'environments', action] as const,
  buildTemplates: (action: string) =>
    [...deliveryMutationKeys.all, 'build-templates', action] as const,
  workflowTemplates: (action: string) =>
    [...deliveryMutationKeys.all, 'workflow-templates', action] as const,
  blueprints: (action: string) => [...deliveryMutationKeys.all, 'blueprints', action] as const,
  workflows: (action: string) => [...deliveryMutationKeys.all, 'workflows', action] as const,
  releases: (action: string) => [...deliveryMutationKeys.all, 'releases', action] as const,
  registries: (action: string) => [...deliveryMutationKeys.all, 'registries', action] as const,
  executionTasks: (action: string) =>
    [...deliveryMutationKeys.all, 'execution-tasks', action] as const,
  workloads: (action: string) => [...deliveryMutationKeys.all, 'workloads', action] as const,
  deployments: (action: string) => [...deliveryMutationKeys.all, 'deployments', action] as const,
  drafts: (action: string) => [...deliveryMutationKeys.all, 'drafts', action] as const,
  plans: (action: string) => [...deliveryMutationKeys.all, 'plans', action] as const,
}
