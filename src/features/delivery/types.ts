import type {
  ApplicationEnvironment,
  ApplicationRuntimeDetail,
  ApplicationServiceComponent,
  ApplicationWorkloadRuntimeDetail,
  BlueprintBootstrapResult,
  BuildRecord,
  BuildTemplate,
  DeliveryApplication,
  DeliveryApplicationEnvironmentDetail,
  DeliveryApplicationDetail,
  DeliveryBlueprint,
  DeliveryDraft,
  DeliveryDraftConfirmResult,
  DeliveryPlan,
  DeliveryPlanConfirmResult,
  DeliveryPlanRequest,
  DeliveryTargetCandidate,
  ExecutionArtifact,
  ExecutionTask,
  ReleaseBoardEntry,
  ReleaseBundle,
  ReleaseRecord,
  RenderedDeliverySpec,
  RuntimeObjectDetail,
  TemplateUsageSummary,
  WorkflowRun,
  WorkflowTemplate,
} from './domain-types'
import type { Cluster, DeploymentDetail, Pod, ResourceMetrics } from '@/types/platform'
import type { GatewayManifest, GatewayTool } from '@/features/copilot'

export type * from './domain-types'

export type DeliveryRecordInput = Record<string, unknown>
export type DeliveryStringRecordInput = Record<string, string>

export interface DeliveryUpdateInput<TPayload> {
  id: string
  payload: TPayload
}

export interface ApplicationServiceUpdateInput {
  applicationId: string
  payload: DeliveryRecordInput
  serviceId: string
}

export interface ApplicationServiceCreateInput {
  applicationId: string
  payload: DeliveryRecordInput
}

export interface ApplicationServiceDeleteInput {
  applicationId: string
  serviceId: string
}

export interface BuildTemplateInput {
  key?: string
  name?: string
  description?: string
  builderKind?: string
  dockerfileTemplate?: string
  buildCommands: string[]
  variableSchema: Record<string, unknown>
  defaultVariables: Record<string, unknown>
  enabled?: boolean
}

export interface WorkflowTriggerInput {
  applicationId: string
  workflowName: string
  clusterId?: string
  namespace?: string
  deploymentName?: string
  triggerBuild: boolean
  triggerRelease: boolean
}

export interface WorkflowDecisionInput {
  comment: string
  id: string
}

export interface ReleaseTriggerInput {
  applicationId: string
  applicationEnvironmentId?: string
  clusterId: string
  namespace: string
  deploymentName: string
  containerName?: string
  image?: string
  imageTag?: string
  releaseName?: string
  actionKind?: string
}

export interface RegistryRecord {
  id: string
  name: string
  type: string
  endpoint: string
  username: string
  status: string
}

export interface DeliveryListParams {
  applicationId?: string
}

export interface DeliveryTargetCandidateParams {
  clusterId: string
  namespace: string
}

export interface DeliveryExecutionLog {
  id: string
  logLevel: string
  message: string
  createdAt: string
}

export interface ExecutionCallbackInput {
  callbackToken?: string
  status: string
  payload?: Record<string, unknown>
}

export interface ExecutionTaskActionInput {
  id: string
  reason: string
}

export interface DeliveryDraftInput {
  source: DeliveryDraft['source']
  blueprintId?: string
  applicationDraft: DeliveryDraft['applicationDraft']
  services?: DeliveryDraft['services']
  buildSources?: DeliveryDraft['buildSources']
  environmentBindings?: DeliveryDraft['environmentBindings']
  files?: DeliveryDraft['files']
  executionHints?: DeliveryDraft['executionHints']
  postCreateActions?: DeliveryDraft['postCreateActions']
}

export type DeliveryRuntimeKind =
  | 'build'
  | 'workflow'
  | 'release'
  | 'release_bundle'
  | 'execution_task'

export type DeliveryRuntimeRecord =
  | BuildRecord
  | WorkflowRun
  | ReleaseRecord
  | ReleaseBundle
  | ExecutionTask

export type DeliveryRuntimeDetail = RuntimeObjectDetail<DeliveryRuntimeRecord>
export type RuntimeKind = DeliveryRuntimeKind
export type RuntimeRecord = DeliveryRuntimeRecord

export interface DeliveryWorkloadRef {
  applicationEnvironmentId: string
  applicationId: string
  workloadName: string
}

export interface DeliveryWorkloadMetricsRef {
  clusterId: string
  namespace: string
  workloadName: string
  rangeMinutes?: number
}

export interface DeliveryDeploymentRef {
  clusterId: string
  namespace: string
  workloadName: string
}

export interface DeliveryDeploymentRollbackInput extends DeliveryDeploymentRef {
  revision: string
}

export type DeliveryWorkloadRestartInput = DeliveryDeploymentRef

export interface RolloutHistoryRecord {
  name: string
  namespace: string
  revision: string
  images?: string[]
  replicas: number
  readyReplicas: number
  createdAt?: string
}

export type DeliveryGatewayTool = GatewayTool
export type DeliveryGatewayManifest = GatewayManifest

export interface DeliveryGatewayReadinessParams {
  skillId: string
  source?: string
}

export type DeliveryApplicationList = DeliveryApplication[]
export type DeliveryEnvironmentList = ApplicationEnvironment[]
export type DeliveryBuildTemplateList = BuildTemplate[]
export type DeliveryWorkflowTemplateList = WorkflowTemplate[]
export type DeliveryBlueprintList = DeliveryBlueprint[]
export type DeliveryWorkflowList = WorkflowRun[]
export type DeliveryReleaseList = ReleaseRecord[]
export type DeliveryRegistryList = RegistryRecord[]
export type DeliveryReleaseBoard = ReleaseBoardEntry[]
export type DeliveryReleaseBundleList = ReleaseBundle[]
export type DeliveryExecutionTaskList = ExecutionTask[]
export type DeliveryClusterList = Cluster[]

export type {
  ApplicationEnvironment,
  ApplicationRuntimeDetail,
  ApplicationServiceComponent,
  ApplicationWorkloadRuntimeDetail,
  BlueprintBootstrapResult,
  BuildRecord,
  BuildTemplate,
  Cluster,
  DeliveryApplication,
  DeliveryApplicationEnvironmentDetail,
  DeliveryApplicationDetail,
  DeliveryBlueprint,
  DeploymentDetail,
  DeliveryDraft,
  DeliveryDraftConfirmResult,
  DeliveryPlan,
  DeliveryPlanConfirmResult,
  DeliveryPlanRequest,
  DeliveryTargetCandidate,
  ExecutionArtifact,
  ExecutionTask,
  Pod,
  ReleaseBoardEntry,
  ReleaseBundle,
  ReleaseRecord,
  RenderedDeliverySpec,
  ResourceMetrics,
  TemplateUsageSummary,
  WorkflowRun,
  WorkflowTemplate,
}
