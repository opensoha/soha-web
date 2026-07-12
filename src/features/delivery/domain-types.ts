import type { components as SohaAPIComponents } from '@opensoha/contracts/gen/ts/sohaapi'
import type { Ingress, Pod, Service, WorkloadCondition, WorkloadContainer } from '@/types/platform'

type SohaAPISchemas = SohaAPIComponents['schemas']
type ContractWorkflowNodeRun = SohaAPISchemas['WorkflowNodeRun']
type ContractReleaseTarget = SohaAPISchemas['ReleaseTarget']
type ContractBuildSource = SohaAPISchemas['BuildSource']
type ContractApplicationServiceContainer = SohaAPISchemas['ApplicationServiceContainer']
type ContractApplicationService = SohaAPISchemas['ApplicationService']
type ContractBuildPolicy = SohaAPISchemas['BuildPolicy']
type ContractReleasePolicy = SohaAPISchemas['ReleasePolicy']
type ContractBuildTemplate = SohaAPISchemas['BuildTemplate']
type ContractWorkflowTemplate = SohaAPISchemas['WorkflowTemplate']
type ContractApplication = SohaAPISchemas['Application']
type ContractBuildRecord = SohaAPISchemas['BuildRecord']
type ContractReleaseRecord = SohaAPISchemas['ReleaseRecord']
type ContractWorkflowRun = SohaAPISchemas['WorkflowRun']
type ContractReleaseBundle = SohaAPISchemas['ReleaseBundle']
type ContractExecutionArtifact = SohaAPISchemas['ExecutionArtifact']
type ContractExecutionTask = SohaAPISchemas['ExecutionTask']
type ContractApplicationDeliveryActionRequest = SohaAPISchemas['ApplicationDeliveryActionRequest']
type ContractDeliveryPlan = SohaAPISchemas['DeliveryPlan']

export interface WorkflowNodeRun extends ContractWorkflowNodeRun {
  nodeId: string
  name: string
  type: string
  status: string
  summary?: string
  startedAt?: string
  finishedAt?: string
}

export interface DeliveryEnvironment {
  id: string
  key: string
  name: string
  tier?: string
  stageLevel: number
  sortOrder: number
  isProduction: boolean
  requiresApproval: boolean
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ReleaseTarget extends Partial<ContractReleaseTarget> {
  id: string
  applicationEnvironmentId?: string
  clusterId: string
  namespace: string
  targetKind?: string
  executorKind?: string
  groupKey?: string
  waveKey?: string
  regionKey?: string
  configRef?: string
  workloadKind: string
  workloadName: string
  containerName?: string
  metadata?: Record<string, unknown>
  enabled: boolean
}

export interface BlueprintFileTemplate {
  path: string
  kind: string
  content: string
  required: boolean
  purpose?: string
}

export interface BlueprintApplicationDraft {
  id?: string
  name: string
  key: string
  group: string
  businessLineId?: string
  language: string
  description?: string
  ownerTeam?: string
  repositoryProvider?: string
  repositoryProjectId?: string
  repositoryPath?: string
  defaultBranch?: string
  defaultTag?: string
  buildImage?: string
  buildContextDir?: string
  dockerfilePath?: string
  enabled: boolean
  metadata?: Record<string, unknown>
}

export interface BlueprintEnvironmentBindingTemplate {
  environmentId?: string
  environmentKey?: string
  businessLineId?: string
  strategyProfileId?: string
  promotionPolicyId?: string
  artifactPolicyId?: string
  workflowTemplateId?: string
  buildPolicy?: BuildPolicy
  releasePolicy?: ReleasePolicy
  resourceSelector?: {
    matchLabels?: Record<string, string>
  }
  targets?: ReleaseTarget[]
}

export interface DeliveryBlueprint {
  id: string
  key: string
  name: string
  description?: string
  applicationDraft: BlueprintApplicationDraft
  buildSources?: BuildSource[]
  environmentBindings?: BlueprintEnvironmentBindingTemplate[]
  files?: BlueprintFileTemplate[]
  executionHints?: Record<string, unknown>
  postCreateActions?: string[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type DeliveryDraftSource = 'manual' | 'ai' | 'blueprint'
export type DeliveryDraftStatus = 'draft' | 'confirming' | 'confirmed'

export interface DeliveryDraftServiceInput {
  id?: string
  key: string
  name: string
  description?: string
  serviceKind: ApplicationServiceKind
  ownerTeam?: string
  repositoryProvider?: string
  repositoryProjectId?: string
  repositoryPath?: string
  defaultBranch?: string
  buildSourceId?: string
  enabled: boolean
  metadata?: Record<string, unknown>
  containers?: ApplicationServiceContainerInput[]
}

export interface ApplicationServiceContainerInput {
  id?: string
  name: string
  imageRepository?: string
  defaultTagTemplate?: string
  dockerfilePath?: string
  buildContextDir?: string
  runtimePorts?: number[]
  envSchema?: Record<string, unknown>
  resourceProfile?: Record<string, unknown>
  healthCheck?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface DeliveryDraft {
  id: string
  source: DeliveryDraftSource
  status: DeliveryDraftStatus
  applicationDraft: BlueprintApplicationDraft
  services?: DeliveryDraftServiceInput[]
  buildSources?: BuildSource[]
  environmentBindings?: BlueprintEnvironmentBindingTemplate[]
  files?: BlueprintFileTemplate[]
  executionHints?: Record<string, unknown>
  postCreateActions?: string[]
  createdBy?: string
  confirmedAt?: string
  createdAt: string
  updatedAt: string
}

export interface RenderedDeliverySpec {
  applicationDraft: BlueprintApplicationDraft
  services?: DeliveryDraftServiceInput[]
  buildSources?: BuildSource[]
  environmentBindings?: BlueprintEnvironmentBindingTemplate[]
  files?: BlueprintFileTemplate[]
  executionHints?: Record<string, unknown>
  postCreateActions?: string[]
}

export interface BlueprintBootstrapResult {
  application: DeliveryApplication
  services?: ApplicationServiceComponent[]
  environmentBindings?: ApplicationEnvironment[]
  spec: RenderedDeliverySpec
}

export interface DeliveryDraftConfirmResult {
  draft: DeliveryDraft
  application: DeliveryApplication
  services?: ApplicationServiceComponent[]
  environmentBindings?: ApplicationEnvironment[]
  spec: RenderedDeliverySpec
}

export interface BuildSource extends ContractBuildSource {
  id: string
  name: string
  type: 'repo_dockerfile' | 'platform_build_template' | 'external_pipeline'
  enabled: boolean
  isDefault: boolean
  buildImage?: string
  defaultTag?: string
  config?: Record<string, unknown>
}

export type ApplicationServiceKind =
  | 'kubernetes_workload'
  | 'helm_release'
  | 'external_service'
  | 'job'

export interface ApplicationServiceContainer extends ContractApplicationServiceContainer {
  id: string
  serviceId?: string
  name: string
  imageRepository?: string
  defaultTagTemplate?: string
  dockerfilePath?: string
  buildContextDir?: string
  runtimePorts?: number[]
  envSchema?: Record<string, unknown>
  resourceProfile?: Record<string, unknown>
  healthCheck?: Record<string, unknown>
  metadata?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface ApplicationServiceComponent extends ContractApplicationService {
  id: string
  applicationId: string
  key: string
  name: string
  description?: string
  serviceKind: ApplicationServiceKind
  ownerTeam?: string
  repositoryProvider?: string
  repositoryProjectId?: string
  repositoryPath?: string
  defaultBranch?: string
  buildSourceId?: string
  enabled: boolean
  metadata?: Record<string, unknown>
  containers?: ApplicationServiceContainer[]
  createdAt: string
  updatedAt: string
}

export interface BuildPolicy extends ContractBuildPolicy {
  sourceId?: string
  refType?: string
  refValue?: string
  imageTagMode?: string
  imageTagTemplate?: string
  variables?: Record<string, unknown>
  buildArgs?: Record<string, unknown>
}

export interface ReleasePolicy extends ContractReleasePolicy {
  actionKind?: 'deploy' | 'release'
  requiresApproval?: boolean
  approverRoles?: string[]
  autoRollback?: boolean
  rolloutTimeoutSeconds?: number
  verificationMode?: 'none' | 'workflow'
}

export interface ApplicationEnvironment {
  id: string
  applicationId: string
  businessLineId?: string
  applicationGroup?: string
  environmentId: string
  environmentKey?: string
  strategyProfileId?: string
  promotionPolicyId?: string
  artifactPolicyId?: string
  workflowTemplateId?: string
  workflowTemplate?: WorkflowTemplate
  buildPolicy?: BuildPolicy
  releasePolicy?: ReleasePolicy
  resourceSelector?: {
    matchLabels?: Record<string, string>
  }
  targets?: ReleaseTarget[]
  createdAt: string
  updatedAt: string
}

export interface BuildTemplate extends ContractBuildTemplate {
  id: string
  key: string
  name: string
  description?: string
  builderKind?: string
  dockerfileTemplate?: string
  buildCommands?: string[]
  variableSchema?: Record<string, unknown>
  defaultVariables?: Record<string, unknown>
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkflowTemplate extends ContractWorkflowTemplate {
  id: string
  key: string
  name: string
  description?: string
  category?: string
  definition?: Record<string, unknown>
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type TemplateUsageKind = 'workflow' | 'build' | 'blueprint'
export type TemplateUsageRiskLevel = 'low' | 'medium' | 'high'

export interface TemplateUsageApplication {
  id: string
  name?: string
  key?: string
  businessLineId?: string
  group?: string
}

export interface TemplateUsageEnvironment {
  id?: string
  key?: string
  name?: string
  isProduction: boolean
  requiresApproval: boolean
}

export interface TemplateUsageBinding {
  id?: string
  applicationId?: string
  environmentId?: string
  environmentKey?: string
  requiresApproval: boolean
  targetCount: number
  riskLevel: TemplateUsageRiskLevel
  application?: TemplateUsageApplication
  environment?: TemplateUsageEnvironment
}

export interface TemplateUsageBuildSource {
  applicationId: string
  buildSourceId: string
  buildSourceName?: string
  application?: TemplateUsageApplication
  bindingCount: number
  riskLevel: TemplateUsageRiskLevel
}

export interface TemplateUsageRuntimeItem {
  kind: string
  id: string
  status?: string
  observedAt?: string
  applicationId?: string
  applicationEnvironmentId?: string
  buildSourceId?: string
  releaseBundleId?: string
  executionTaskId?: string
  workflowTemplateId?: string
  workflowName?: string
  version?: string
  sourceType?: string
  artifactRef?: string
  sourceSystem?: string
  clusterId?: string
  namespace?: string
  deploymentName?: string
  taskKind?: string
  providerKind?: string
  operationState?: Record<string, unknown>
}

export interface TemplateUsageRuntimeSummary {
  source?: string
  note?: string
  items?: TemplateUsageRuntimeItem[]
  latest?: TemplateUsageRuntimeItem
  latestAt?: string
  statusCounts?: Record<string, number>
  stateCounts?: Record<string, number>
  kindCounts?: Record<string, number>
}

export interface TemplateUsageSummary {
  templateKind: TemplateUsageKind
  templateId: string
  usageCount: number
  applicationCount: number
  environmentCount: number
  productionEnvironmentCount: number
  approvalBindingCount: number
  targetCount: number
  riskLevel: TemplateUsageRiskLevel
  riskReasons?: string[]
  recommendedAction?: string
  applications?: TemplateUsageApplication[]
  bindings?: TemplateUsageBinding[]
  buildSources?: TemplateUsageBuildSource[]
  fileKindCounts?: Record<string, number>
  lastExecutionSummary?: TemplateUsageRuntimeSummary
}

export interface DeliveryApplication extends ContractApplication {
  id: string
  name: string
  key: string
  group: string
  businessLineId?: string
  language: string
  repositoryProvider?: string
  repositoryProjectId?: string
  repositoryPath?: string
  defaultBranch?: string
  defaultTag?: string
  buildImage?: string
  buildContextDir?: string
  dockerfilePath?: string
  enabled: boolean
  metadata?: Record<string, unknown>
  buildSources?: BuildSource[]
  environmentCount?: number
  createdAt: string
  updatedAt: string
}

export interface BuildRecord extends ContractBuildRecord {
  id: string
  applicationId: string
  sourceSystem: string
  status: string
  metadata?: Record<string, unknown>
  startedAt?: string
  finishedAt?: string
  createdAt: string
}

export interface ReleaseRecord extends ContractReleaseRecord {
  id: string
  applicationId: string
  clusterId: string
  namespace: string
  deploymentName: string
  status: string
  metadata?: Record<string, unknown>
  deployedAt?: string
  createdAt: string
}

export interface WorkflowRun extends ContractWorkflowRun {
  id: string
  applicationId: string
  workflowName: string
  clusterId?: string
  namespace?: string
  deploymentName?: string
  status: string
  steps: Array<{ name: string; status: string; summary?: string }>
  nodeRuns?: WorkflowNodeRun[]
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ReleaseBundle extends ContractReleaseBundle {
  id: string
  applicationId: string
  applicationEnvironmentId?: string
  version: string
  sourceType: string
  status: string
  artifactRef?: string
  artifactDigest?: string
  artifacts?: ExecutionArtifact[]
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ExecutionArtifact extends ContractExecutionArtifact {
  id?: string
  applicationId?: string
  applicationEnvironmentId?: string
  workflowRunId?: string
  workflowNodeId?: string
  releaseBundleId?: string
  executionTaskId?: string
  kind: string
  name?: string
  ref?: string
  digest?: string
  path?: string
  status?: string
  sizeBytes?: number
  metadata?: Record<string, unknown>
  retentionUntil?: string
  createdAt?: string
  updatedAt?: string
  modifiedAt?: string
}

export interface RuntimeObjectLinks {
  application?: string
  audit?: string
  operations?: string
  artifacts?: string
}

export interface RuntimeObjectPermissions {
  canViewArtifacts: boolean
  canViewAudit: boolean
  canViewOperations: boolean
  canRetry?: boolean
  canCancel?: boolean
}

export interface RuntimeObjectDetail<TObject = unknown> {
  kind: string
  id: string
  object: TObject
  application?: DeliveryApplication
  binding?: ApplicationEnvironment
  environment?: DeliveryEnvironment
  buildSource?: BuildSource
  workflowTemplate?: WorkflowTemplate
  evidence?: Record<string, unknown>
  artifacts?: ExecutionArtifact[]
  links: RuntimeObjectLinks
  permissions: RuntimeObjectPermissions
}

export interface ExecutionTask extends Partial<ContractExecutionTask> {
  id: string
  releaseBundleId?: string
  applicationId: string
  applicationEnvironmentId?: string
  taskKind: string
  providerKind: string
  targetKind: string
  status: string
  queueKey?: string
  lockKey?: string
  maxRetries: number
  attemptCount: number
  timeoutSeconds: number
  callbackToken?: string
  payload?: Record<string, unknown>
  result?: Record<string, unknown>
  artifacts?: ExecutionArtifact[]
  startedAt?: string
  lastHeartbeatAt?: string
  finishedAt?: string
  createdAt: string
  updatedAt: string
}

export interface DeliveryApplicationBindingSummary {
  applicationEnvironmentId: string
  environmentId: string
  environmentName?: string
  environmentKey?: string
  actionKind?: string
  requiresApproval: boolean
  workflowTemplateId?: string
  workflowTemplateName?: string
  workflowTemplate?: WorkflowTemplate
  targetCount: number
  targets?: ReleaseTarget[]
  buildSourceId?: string
  buildSource?: BuildSource
  buildPolicy?: BuildPolicy
  latestBundle?: ReleaseBundle
  latestExecutionTask?: ExecutionTask
  latestBuild?: BuildRecord
  latestWorkflow?: WorkflowRun
  latestRelease?: ReleaseRecord
}

export interface DeliveryApplicationDetail {
  application: DeliveryApplication
  bindings?: DeliveryApplicationBindingSummary[]
  latestBundle?: ReleaseBundle
  latestExecutionTask?: ExecutionTask
  latestBuild?: BuildRecord
  latestWorkflow?: WorkflowRun
  latestRelease?: ReleaseRecord
}

export type ApplicationDeliveryActionKind =
  | 'build'
  | 'deploy'
  | 'build_deploy'
  | 'workflow'
  | 'verify'
  | 'rollback'

export interface ApplicationDeliveryActionRequest extends ContractApplicationDeliveryActionRequest {
  action: ApplicationDeliveryActionKind
  applicationEnvironmentId: string
  targetId?: string
  buildSourceId?: string
  refType?: string
  refName?: string
  imageTag?: string
  releaseName?: string
  containerName?: string
  variables?: Record<string, unknown>
  buildArgs?: Record<string, unknown>
}

export interface ApplicationDeliveryActionResponse {
  action: ApplicationDeliveryActionKind
  applicationId: string
  applicationEnvironmentId: string
  target?: ReleaseTarget
  build?: BuildRecord
  workflow?: WorkflowRun
  release?: ReleaseRecord
  relatedIds?: {
    releaseBundleId?: string
    executionTaskId?: string
    workflowRunId?: string
  }
}

export type DeliveryPlanSource = 'manual' | 'ai'
export type DeliveryPlanStatus = 'draft' | 'confirming' | 'confirmed'

export interface DeliveryPlanRequest extends ApplicationDeliveryActionRequest {
  id?: string
  source?: DeliveryPlanSource
  applicationId: string
  reason?: string
}

export interface DeliveryPlan extends ContractDeliveryPlan {
  id: string
  source: DeliveryPlanSource
  status: DeliveryPlanStatus
  applicationId: string
  applicationName?: string
  applicationEnvironmentId: string
  environmentKey?: string
  action: ApplicationDeliveryActionKind
  targetId?: string
  targetSummary?: string
  buildSourceId?: string
  releaseBundleId?: string
  refType?: string
  refName?: string
  imageTag?: string
  releaseName?: string
  containerName?: string
  reason?: string
  riskLevel?: string
  requiresApproval: boolean
  impact?: Record<string, unknown>
  rollbackStrategy?: string
  variables?: Record<string, unknown>
  buildArgs?: Record<string, unknown>
  createdBy?: string
  confirmedAt?: string
  createdAt: string
  updatedAt: string
}

export interface DeliveryPlanConfirmResult {
  plan: DeliveryPlan
  result: ApplicationDeliveryActionResponse
}

export interface ApplicationRuntimeWorkload {
  applicationEnvironmentId: string
  clusterId: string
  namespace: string
  workloadKind: string
  workloadName: string
  labels?: Record<string, string>
  selector?: Record<string, string>
  desiredReplicas: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  buildSource?: BuildSource
  latestBundle?: ReleaseBundle
  latestExecutionTask?: ExecutionTask
  latestBuild?: BuildRecord
  latestWorkflow?: WorkflowRun
  latestRelease?: ReleaseRecord
}

export interface ApplicationRuntimeEnvironment {
  applicationEnvironmentId: string
  environmentId: string
  environmentName?: string
  environmentKey?: string
  actionKind?: string
  requiresApproval: boolean
  resourceSelector?: {
    matchLabels?: Record<string, string>
  }
  targets?: ReleaseTarget[]
  workloads?: ApplicationRuntimeWorkload[]
}

export interface ApplicationRuntimeDetail {
  application: DeliveryApplication
  environments?: ApplicationRuntimeEnvironment[]
}

export interface ApplicationWorkloadRuntimeDetail {
  application: DeliveryApplication
  binding: ApplicationEnvironment
  environment?: DeliveryEnvironment
  workload: ApplicationRuntimeWorkload
  deployment: {
    name: string
    namespace: string
    desiredReplicas: number
    readyReplicas: number
    updatedReplicas: number
    availableReplicas: number
    observedGeneration: number
    strategy: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    selector?: Record<string, string>
    containers?: WorkloadContainer[]
    conditions?: WorkloadCondition[]
    allowedActions?: string[]
  }
  pods?: Pod[]
  services?: Service[]
  ingresses?: Ingress[]
}

export interface DeliveryApplicationEnvironmentDetail {
  binding: ApplicationEnvironment
  application: DeliveryApplication
  environment?: DeliveryEnvironment
  actionKind?: string
  requiresApproval: boolean
  buildSource?: BuildSource
  latestBundle?: ReleaseBundle
  latestExecutionTask?: ExecutionTask
  latestBuild?: BuildRecord
  latestWorkflow?: WorkflowRun
  latestRelease?: ReleaseRecord
}

export interface ReleaseBoardEntry {
  applicationEnvironmentId: string
  applicationId: string
  applicationName: string
  businessLineId?: string
  environmentId: string
  environmentName?: string
  environmentKey?: string
  actionKind?: string
  requiresApproval: boolean
  workflowTemplateId?: string
  workflowTemplateName?: string
  buildSourceId?: string
  buildSource?: BuildSource
  buildPolicy?: BuildPolicy
  latestBundle?: ReleaseBundle
  latestExecutionTask?: ExecutionTask
  targets?: ReleaseTarget[]
  latestBuild?: BuildRecord
  latestWorkflow?: WorkflowRun
  latestRelease?: ReleaseRecord
}

export interface DeliveryTargetCandidate {
  clusterId: string
  namespace: string
  workloadKind: string
  workloadName: string
  containers?: string[]
  labels?: Record<string, string>
}
