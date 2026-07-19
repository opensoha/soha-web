import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type {
  ApplicationEnvironment,
  ApplicationRuntimeDetail,
  ApplicationServiceComponent,
  ApplicationWorkloadRuntimeDetail,
  BlueprintBootstrapResult,
  BuildRecord,
  BuildTemplate,
  BuildTemplateInput,
  DeliveryApplication,
  DeliveryApplicationDetail,
  DeliveryApplicationEnvironmentDetail,
  DeliveryBlueprint,
  DeliveryClusterList,
  DeliveryDeploymentRef,
  DeliveryDeploymentRollbackInput,
  DeliveryDraft,
  DeliveryDraftConfirmResult,
  DeliveryDraftInput,
  DeliveryExecutionLog,
  DeliveryGatewayManifest,
  DeliveryGatewayReadinessParams,
  DeliveryListParams,
  RepositoryListParams,
  GitReferenceParams,
  GitCommitParams,
  DeliveryRepository,
  GitProject,
  GitReference,
  GitCommit,
  DeliveryPlan,
  DeliveryPlanConfirmResult,
  DeliveryPlanRequest,
  DeliveryRecordInput,
  DeliveryRegistryList,
  DeliveryRuntimeDetail,
  DeliveryRuntimeKind,
  DeliveryStringRecordInput,
  DeliveryTargetCandidate,
  DeliveryTargetCandidateParams,
  DeliveryWorkloadMetricsRef,
  DeliveryWorkloadRef,
  DeliveryWorkloadRestartInput,
  ExecutionArtifact,
  ExecutionCallbackInput,
  ExecutionTask,
  ExecutionTaskActionInput,
  RegistryRecord,
  ReleaseBoardEntry,
  ReleaseBundle,
  ReleaseRecord,
  ReleaseTriggerInput,
  RenderedDeliverySpec,
  ResourceMetrics,
  RolloutHistoryRecord,
  TemplateUsageSummary,
  WorkflowDecisionInput,
  WorkflowRun,
  WorkflowTemplate,
  WorkflowTriggerInput,
} from './types'

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request
  return response.data
}

async function discard(request: Promise<unknown>): Promise<void> {
  await request
}

function segment(value: string) {
  return encodeURIComponent(value.trim())
}

function withQuery(path: string, params: Record<string, unknown> = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  })
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export function deliveryRuntimeDetailPath(kind: DeliveryRuntimeKind, id: string) {
  const encoded = segment(id)
  switch (kind) {
    case 'build':
      return `/delivery/runtime/builds/${encoded}`
    case 'workflow':
      return `/delivery/runtime/workflows/${encoded}`
    case 'release':
      return `/delivery/runtime/releases/${encoded}`
    case 'release_bundle':
      return `/delivery/runtime/release-bundles/${encoded}`
    case 'execution_task':
      return `/delivery/runtime/execution-tasks/${encoded}`
  }
}

function applicationListPath(
  base: '/builds' | '/releases' | '/workflows',
  params: DeliveryListParams,
) {
  return withQuery(base, { applicationId: params.applicationId?.trim() })
}

function workloadRuntimePath(ref: DeliveryWorkloadRef) {
  return `/applications/${segment(ref.applicationId)}/application-environments/${segment(ref.applicationEnvironmentId)}/workloads/${segment(ref.workloadName)}/runtime`
}

function workloadMetricsPath(ref: DeliveryWorkloadMetricsRef) {
  return withQuery(
    `/clusters/${segment(ref.clusterId)}/workloads/deployments/${segment(ref.workloadName)}/metrics`,
    {
      namespace: ref.namespace.trim(),
      rangeMinutes: ref.rangeMinutes ?? 60,
    },
  )
}

function deploymentRolloutsPath(ref: DeliveryDeploymentRef) {
  return withQuery(
    `/clusters/${segment(ref.clusterId)}/workloads/deployments/${segment(ref.workloadName)}/rollouts`,
    { namespace: ref.namespace.trim() },
  )
}

function gatewayReadinessPath(params: DeliveryGatewayReadinessParams) {
  return withQuery('/ai-gateway/capabilities', {
    source: params.source?.trim() || 'delivery-workbench',
    skillId: params.skillId.trim(),
  })
}

export const deliveryApi = {
  repositories: {
    list: (params: RepositoryListParams = {}) =>
      unwrap(api.get<ApiResponse<DeliveryRepository[]>>(withQuery('/repositories', { applicationId: params.applicationId?.trim(), search: params.search?.trim(), limit: params.limit }))),
    create: (payload: DeliveryRecordInput) =>
      unwrap(api.post<ApiResponse<DeliveryRepository>>('/repositories', payload)),
    update: (id: string, payload: DeliveryRecordInput) =>
      unwrap(api.put<ApiResponse<DeliveryRepository>>(`/repositories/${segment(id)}`, payload)),
    delete: (id: string) => discard(api.delete(`/repositories/${segment(id)}`)),
  },
  gitlab: {
    projects: async (params: Omit<RepositoryListParams, 'applicationId'> = {}) =>
      (await api.get<{ items: GitProject[] }>(withQuery('/integrations/gitlab/projects', { search: params.search?.trim(), limit: params.limit }))).items,
    branches: async (params: GitReferenceParams) =>
      (await api.get<{ items: GitReference[] }>(withQuery('/integrations/gitlab/branches', { projectId: params.projectId, search: params.search, limit: params.limit }))).items,
    tags: async (params: GitReferenceParams) =>
      (await api.get<{ items: GitReference[] }>(withQuery('/integrations/gitlab/tags', { projectId: params.projectId, search: params.search, limit: params.limit }))).items,
    commits: (params: GitCommitParams) =>
      api.get<{ items: GitCommit[]; page: number; limit: number; hasMore: boolean }>(
        withQuery('/integrations/gitlab/commits', {
          projectId: params.projectId,
          search: params.search,
          limit: params.limit,
          page: params.page,
        }),
      ),
  },
  applications: {
    list: () => unwrap(api.get<ApiResponse<DeliveryApplication[]>>('/applications')),
    detail: (id: string) =>
      unwrap(
        api.get<ApiResponse<DeliveryApplicationDetail>>(`/applications/${segment(id)}/detail`),
      ),
    runtime: (id: string) =>
      unwrap(
        api.get<ApiResponse<ApplicationRuntimeDetail>>(`/applications/${segment(id)}/runtime`),
      ),
    create: (payload: DeliveryRecordInput) =>
      unwrap(api.post<ApiResponse<DeliveryApplication>>('/applications', payload)),
    update: (id: string, payload: DeliveryRecordInput) =>
      discard(api.put(`/applications/${segment(id)}`, payload)),
    delete: (id: string) => discard(api.delete(`/applications/${segment(id)}`)),
    services: (applicationId: string) =>
      unwrap(
        api.get<ApiResponse<ApplicationServiceComponent[]>>(
          `/applications/${segment(applicationId)}/services`,
        ),
      ),
    createService: (applicationId: string, payload: DeliveryRecordInput) =>
      discard(api.post(`/applications/${segment(applicationId)}/services`, payload)),
    updateService: (applicationId: string, serviceId: string, payload: DeliveryRecordInput) =>
      discard(
        api.put(`/applications/${segment(applicationId)}/services/${segment(serviceId)}`, payload),
      ),
    deleteService: (applicationId: string, serviceId: string) =>
      discard(api.delete(`/applications/${segment(applicationId)}/services/${segment(serviceId)}`)),
  },
  environments: {
    list: () => unwrap(api.get<ApiResponse<ApplicationEnvironment[]>>('/application-environments')),
    detail: (id: string) =>
      unwrap(
        api.get<ApiResponse<DeliveryApplicationEnvironmentDetail>>(
          `/application-environments/${segment(id)}/detail`,
        ),
      ),
    targetCandidates: (params: DeliveryTargetCandidateParams) =>
      unwrap(
        api.get<ApiResponse<DeliveryTargetCandidate[]>>(
          withQuery('/application-environments/target-candidates', {
            clusterId: params.clusterId.trim(),
            namespace: params.namespace.trim(),
          }),
        ),
      ),
    create: (payload: DeliveryRecordInput) =>
      discard(api.post('/application-environments', payload)),
    update: (id: string, payload: DeliveryRecordInput) =>
      discard(api.put(`/application-environments/${segment(id)}`, payload)),
    delete: (id: string) => discard(api.delete(`/application-environments/${segment(id)}`)),
  },
  buildTemplates: {
    list: () => unwrap(api.get<ApiResponse<BuildTemplate[]>>('/build-templates')),
    usage: (id: string) =>
      unwrap(api.get<ApiResponse<TemplateUsageSummary>>(`/build-templates/${segment(id)}/usage`)),
    create: (payload: BuildTemplateInput) =>
      unwrap(api.post<ApiResponse<BuildTemplate>>('/build-templates', payload)),
    update: (id: string, payload: BuildTemplateInput) =>
      unwrap(api.put<ApiResponse<BuildTemplate>>(`/build-templates/${segment(id)}`, payload)),
    delete: (id: string) => discard(api.delete(`/build-templates/${segment(id)}`)),
  },
  workflowTemplates: {
    list: () => unwrap(api.get<ApiResponse<WorkflowTemplate[]>>('/workflow-templates')),
    usage: (id: string) =>
      unwrap(
        api.get<ApiResponse<TemplateUsageSummary>>(`/workflow-templates/${segment(id)}/usage`),
      ),
    create: (payload: DeliveryRecordInput) =>
      unwrap(api.post<ApiResponse<WorkflowTemplate>>('/workflow-templates', payload)),
    update: (id: string, payload: DeliveryRecordInput) =>
      unwrap(api.put<ApiResponse<WorkflowTemplate>>(`/workflow-templates/${segment(id)}`, payload)),
    delete: (id: string) => discard(api.delete(`/workflow-templates/${segment(id)}`)),
  },
  blueprints: {
    list: () => unwrap(api.get<ApiResponse<DeliveryBlueprint[]>>('/delivery/blueprints')),
    usage: (id: string) =>
      unwrap(
        api.get<ApiResponse<TemplateUsageSummary>>(`/delivery/blueprints/${segment(id)}/usage`),
      ),
    create: (payload: DeliveryRecordInput) =>
      unwrap(api.post<ApiResponse<DeliveryBlueprint>>('/delivery/blueprints', payload)),
    update: (id: string, payload: DeliveryRecordInput) =>
      unwrap(
        api.put<ApiResponse<DeliveryBlueprint>>(`/delivery/blueprints/${segment(id)}`, payload),
      ),
    renderSpec: (id: string) =>
      unwrap(
        api.post<ApiResponse<RenderedDeliverySpec>>(
          `/delivery/blueprints/${segment(id)}/render-spec`,
          {},
        ),
      ),
    bootstrapApplication: (id: string) =>
      unwrap(
        api.post<ApiResponse<BlueprintBootstrapResult>>(
          `/delivery/blueprints/${segment(id)}/bootstrap-application`,
          {},
        ),
      ),
  },
  builds: {
    list: (params: DeliveryListParams = {}) =>
      unwrap(api.get<ApiResponse<BuildRecord[]>>(applicationListPath('/builds', params))),
  },
  workflows: {
    list: (params: DeliveryListParams = {}) =>
      unwrap(api.get<ApiResponse<WorkflowRun[]>>(applicationListPath('/workflows', params))),
    trigger: (payload: WorkflowTriggerInput) => discard(api.post('/workflows/trigger', payload)),
    approve: ({ id, comment }: WorkflowDecisionInput) =>
      discard(api.post(`/workflows/${segment(id)}/approve`, { comment })),
    reject: ({ id, comment }: WorkflowDecisionInput) =>
      discard(api.post(`/workflows/${segment(id)}/reject`, { comment })),
  },
  releases: {
    list: (params: DeliveryListParams = {}) =>
      unwrap(api.get<ApiResponse<ReleaseRecord[]>>(applicationListPath('/releases', params))),
    trigger: (payload: ReleaseTriggerInput) => discard(api.post('/releases/trigger', payload)),
  },
  registries: {
    list: () => unwrap(api.get<ApiResponse<DeliveryRegistryList>>('/registries')),
    create: (payload: DeliveryStringRecordInput) => discard(api.post('/registries', payload)),
    update: (id: string, payload: DeliveryStringRecordInput) =>
      discard(api.put(`/registries/${segment(id)}`, payload)),
    delete: (id: string) => discard(api.delete(`/registries/${segment(id)}`)),
  },
  releaseBoard: {
    list: () => unwrap(api.get<ApiResponse<ReleaseBoardEntry[]>>('/delivery/release-board')),
  },
  releaseBundles: {
    list: () => unwrap(api.get<ApiResponse<ReleaseBundle[]>>('/delivery/release-bundles')),
    artifacts: (id: string) =>
      unwrap(
        api.get<ApiResponse<ExecutionArtifact[]>>(
          `/delivery/release-bundles/${segment(id)}/artifacts`,
        ),
      ),
  },
  executionTasks: {
    list: () => unwrap(api.get<ApiResponse<ExecutionTask[]>>('/delivery/execution-tasks')),
    logs: (id: string) =>
      unwrap(
        api.get<ApiResponse<DeliveryExecutionLog[]>>(
          `/delivery/execution-tasks/${segment(id)}/logs`,
        ),
      ),
    artifacts: (id: string) =>
      unwrap(
        api.get<ApiResponse<ExecutionArtifact[]>>(
          `/delivery/execution-tasks/${segment(id)}/artifacts`,
        ),
      ),
    callback: (payload: ExecutionCallbackInput) =>
      discard(api.post('/delivery/execution-callbacks', payload)),
    cancel: ({ id, reason }: ExecutionTaskActionInput) =>
      discard(api.post(`/delivery/execution-tasks/${segment(id)}/cancel`, { reason })),
    retry: ({ id, reason }: ExecutionTaskActionInput) =>
      discard(api.post(`/delivery/execution-tasks/${segment(id)}/retry`, { reason })),
  },
  runtime: {
    detail: (kind: DeliveryRuntimeKind, id: string) =>
      unwrap(api.get<ApiResponse<DeliveryRuntimeDetail>>(deliveryRuntimeDetailPath(kind, id))),
  },
  workloads: {
    runtime: (ref: DeliveryWorkloadRef) =>
      unwrap(api.get<ApiResponse<ApplicationWorkloadRuntimeDetail>>(workloadRuntimePath(ref))),
    metrics: (ref: DeliveryWorkloadMetricsRef) =>
      unwrap(api.get<ApiResponse<ResourceMetrics>>(workloadMetricsPath(ref))),
    restart: (input: DeliveryWorkloadRestartInput) =>
      discard(
        api.post(`/clusters/${segment(input.clusterId)}/workloads/deployments/restart`, {
          namespace: input.namespace,
          name: input.workloadName,
        }),
      ),
  },
  deployments: {
    rollouts: (ref: DeliveryDeploymentRef) =>
      unwrap(api.get<ApiResponse<RolloutHistoryRecord[]>>(deploymentRolloutsPath(ref))),
    rollback: (input: DeliveryDeploymentRollbackInput) =>
      discard(
        api.post(`/clusters/${segment(input.clusterId)}/workloads/deployments/rollback`, {
          namespace: input.namespace,
          name: input.workloadName,
          revision: input.revision,
        }),
      ),
  },
  gateway: {
    readiness: (params: DeliveryGatewayReadinessParams) =>
      unwrap(api.get<ApiResponse<DeliveryGatewayManifest>>(gatewayReadinessPath(params))),
  },
  drafts: {
    create: (payload: DeliveryDraftInput) =>
      unwrap(api.post<ApiResponse<DeliveryDraft>>('/delivery/drafts', payload)),
    confirm: (id: string) =>
      unwrap(
        api.post<ApiResponse<DeliveryDraftConfirmResult>>(
          `/delivery/drafts/${segment(id)}/confirm`,
          {},
        ),
      ),
  },
  plans: {
    create: (payload: DeliveryPlanRequest) =>
      unwrap(api.post<ApiResponse<DeliveryPlan>>('/delivery/plans', payload)),
    confirm: (id: string) =>
      unwrap(
        api.post<ApiResponse<DeliveryPlanConfirmResult>>(
          `/delivery/plans/${segment(id)}/confirm`,
          {},
        ),
      ),
    approval: (id: string, payload: { action: 'approve' | 'reject'; comment?: string }) =>
      unwrap(api.post<ApiResponse<DeliveryPlan>>(`/delivery/plans/${segment(id)}/approval`, payload)),
  },
  dependencies: {
    clusters: () => unwrap(api.get<ApiResponse<DeliveryClusterList>>('/clusters')),
  },
}

export type { RegistryRecord }
