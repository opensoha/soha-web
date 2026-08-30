import { useCallback, useEffect, useMemo, useState } from 'react'
import './styles.css'
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Tabs,
  Tooltip,
  Typography,
  type FormInstance,
} from 'antd'
import {
  ArrowRightOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  MinusCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ManagementIconButton,
  ManagementRefreshButton,
  ManagementState,
} from '@/components/management-list'
import { visuallyHiddenModalTitleStyle } from '@/components/modal-styles'
import { OverviewChip, OverviewSectionBar, type OverviewTone } from '@/components/overview-visuals'
import {
  analyzeReleaseDagDefinition,
  getDefaultReleaseDagNodeLabel,
  isReleaseDagValidationNodeType,
  type ReleaseDagNodeDefinition,
} from '@/components/release-flow-dag-definition'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useAIPageContext } from '@/features/copilot'
import { useClusterCapabilityForCluster } from '@/features/platform'
import { isApiError } from '@/services/api-error'
import { workflowTemplateValidationNodeCount } from '../delivery-status'
import { DeliveryTable } from '../delivery-table'
import {
  ApplicationCenterModals,
  summarizeBuildSource,
  useApplicationCenterState,
} from '../application-center-model'
import { deliveryMutations } from '../mutations'
import { ManifestLibraryWorkspace } from '../manifests'
import { deliveryQueries } from '../queries'
import type {
  ApplicationDeliveryActionKind,
  ApplicationDeliveryActionRequest,
  ApplicationEnvironment,
  ApplicationRuntimeDetail,
  ApplicationRuntimeWorkload,
  ApplicationServiceComponent,
  ApplicationServiceContainer,
  BuildRepositoryBinding,
  BuildRepositoryRefInput,
  BuildSource,
  DeliveryApplicationBindingSummary,
  DeliveryRepository,
  DeliveryPlan,
  DeliveryPlanConfirmResult,
  DeliveryPlanRequest,
  WorkflowTemplate,
} from '../types'
import {
  APPLICATION_WORKSPACE_LABELS,
  APPLICATION_WORKSPACE_NAV_ITEMS,
} from './workspace-navigation'

const { Text } = Typography

const SERVICE_KIND_OPTIONS = [
  {
    value: 'kubernetes_workload',
    label: 'Kubernetes 工作负载',
    description: '资源清单与容器镜像驱动',
  },
  { value: 'helm_release', label: 'Helm Release', description: 'Helm Chart 与 values 驱动' },
  { value: 'external_service', label: '外部服务', description: '只纳管依赖、端点与验证' },
  { value: 'job', label: '批处理任务', description: '一次性或周期任务交付' },
]

type ServiceFormValues = Omit<
  ApplicationServiceComponent,
  'applicationId' | 'createdAt' | 'updatedAt' | 'containers'
> & {
  containers?: Array<
    Omit<ApplicationServiceContainer, 'createdAt' | 'updatedAt' | 'runtimePorts'> & {
      runtimePortsText?: string
    }
  >
}

type RepositoryFormValues = {
  id?: string
  name: string
  provider: 'gitlab' | 'git'
  protocol: 'https' | 'ssh'
  url: string
  path: string
  gitlabProjectId?: string
  credentialRef?: string
  defaultBranch: string
}

type BuildSourceFormValues = Omit<BuildSource, 'id'> & { id?: string }

type DeliveryActionFormValues = {
  applicationEnvironmentId?: string
  targetId?: string
  buildSourceId?: string
  refType?: 'branch' | 'tag' | 'commit'
  refName?: string
  repositoryRefs?: BuildRepositoryRefInput[]
  imageTag?: string
  releaseName?: string
  containerName?: string
}

type WorkflowCreateFormValues = {
  name: string
  applicationEnvironmentId: string
  source: 'blank' | 'template'
  templateId?: string
}

const REF_TYPE_OPTIONS = [
  { value: 'branch', label: 'Branch' },
  { value: 'tag', label: 'Tag' },
  { value: 'commit', label: 'Commit' },
]

function buildRepositoryBindings(source?: BuildSource): BuildRepositoryBinding[] {
  const configured = source?.config?.repositoryBindings
  if (Array.isArray(configured) && configured.length > 0) {
    return configured.filter((item) => Boolean(item?.repositoryId))
  }
  const repositoryId = source?.config?.repositoryId
  return typeof repositoryId === 'string' && repositoryId
    ? [{ repositoryId, allowCommitSelection: false, submodules: false }]
    : []
}

function buildRepositoryRefs(
  source: BuildSource | undefined,
  repositories: DeliveryRepository[],
): BuildRepositoryRefInput[] {
  return buildRepositoryBindings(source).map((binding) => {
    const repository = repositories.find((item) => item.id === binding.repositoryId)
    return {
      repositoryId: binding.repositoryId,
      refType: 'branch',
      refName: binding.defaultBranch || repository?.defaultBranch || 'main',
    }
  })
}

const DELIVERY_ACTION_LABELS: Record<ApplicationDeliveryActionKind, string> = {
  build: '构建',
  deploy: '部署',
  build_deploy: '运行工作流',
  workflow: '工作流',
  verify: '测试',
  rollback: '回滚',
}

function summarizeStatus(item: ApplicationRuntimeWorkload | undefined) {
  if (!item) return 'unknown'
  return (
    item.latestRelease?.status ||
    item.latestWorkflow?.status ||
    item.latestBuild?.status ||
    'unknown'
  )
}

function workloadRuntimeStatus(item: ApplicationRuntimeWorkload): {
  tone: OverviewTone
  value: string
  label: string
} {
  const status = item.healthStatus?.trim().toLowerCase() ?? ''
  const desired = Math.max(item.desiredReplicas, 0)
  const ready = Math.max(item.readyReplicas, 0)

  if (
    ['critical', 'error', 'failed', 'notready', 'not-ready', 'unavailable'].includes(status) ||
    (desired > 0 && ready === 0)
  ) {
    return { tone: 'danger', value: 'unavailable', label: '运行异常' }
  }
  if (
    ['degraded', 'partial', 'pending', 'progressing', 'warning'].includes(status) ||
    (desired > 0 && ready < desired)
  ) {
    return { tone: 'warning', value: 'degraded', label: '部分就绪' }
  }
  if (
    ['available', 'completed', 'healthy', 'normal', 'ok', 'ready', 'running', 'succeeded'].includes(
      status,
    ) ||
    (desired > 0 && ready >= desired)
  ) {
    return { tone: 'success', value: 'healthy', label: '运行正常' }
  }

  return {
    tone: 'default',
    value: 'unknown',
    label: ['cronjob', 'job'].includes(item.workloadKind.toLowerCase()) ? '按需运行' : '状态未知',
  }
}

function parsePorts(value?: string) {
  return String(value ?? '')
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item) && item > 0)
}

function formatPorts(value?: number[]) {
  return value?.join(', ') ?? ''
}

function serviceInitialValues(service?: ApplicationServiceComponent | null): ServiceFormValues {
  if (!service) {
    return {
      serviceKind: 'kubernetes_workload',
      enabled: true,
      containers: [
        {
          name: 'main',
          runtimePortsText: '',
        },
      ],
    } as ServiceFormValues
  }
  return {
    ...service,
    containers: (service.containers ?? []).map((container) => ({
      ...container,
      runtimePortsText: formatPorts(container.runtimePorts),
    })),
  } as ServiceFormValues
}

function mapServicePayload(values: ServiceFormValues) {
  return {
    ...values,
    containers: (values.containers ?? []).map((container) => ({
      ...container,
      runtimePorts: parsePorts(container.runtimePortsText),
      runtimePortsText: undefined,
    })),
  }
}

function serviceKindLabel(value?: string) {
  return SERVICE_KIND_OPTIONS.find((item) => item.value === value)?.label ?? value ?? '-'
}

function serviceKindDescription(value?: string) {
  return SERVICE_KIND_OPTIONS.find((item) => item.value === value)?.description ?? '自定义交付模型'
}

function summarizeBindingStatus(binding?: DeliveryApplicationBindingSummary | null) {
  return (
    binding?.latestRelease?.status ||
    binding?.latestWorkflow?.status ||
    binding?.latestBuild?.status ||
    binding?.latestExecutionTask?.status ||
    binding?.latestBundle?.status ||
    'unknown'
  )
}

function applicationWorkflowDesignPath(
  applicationId: string,
  values: {
    applicationEnvironmentId: string
    name?: string
    source?: WorkflowCreateFormValues['source']
    templateId?: string
  },
) {
  const search = new URLSearchParams({ bindingId: values.applicationEnvironmentId })
  if (values.name) search.set('name', values.name)
  if (values.source) search.set('source', values.source)
  if (values.templateId) search.set('templateId', values.templateId)
  return `/applications/${encodeURIComponent(applicationId)}/workflows/design?${search}`
}

function releaseDagNodeLabel(type: Parameters<typeof getDefaultReleaseDagNodeLabel>[0]) {
  return getDefaultReleaseDagNodeLabel(type)
}

function renderWorkflowTemplateAnalysisTags(
  template: WorkflowTemplate | undefined,
  requiresApproval?: boolean,
  hasTemplateRef = false,
) {
  if (!template) {
    if (hasTemplateRef) return <StatusTag value="error" label="模板缺失" />
    return <StatusTag value="warning" label="无模板" />
  }
  const analysis = analyzeReleaseDagDefinition(template.definition)
  return (
    <Space wrap>
      <MetadataTag label={`${analysis.nodeCount} 个节点`} />
      <StatusTag
        value={analysis.validationNodeCount > 0 ? 'success' : 'warning'}
        label={analysis.validationNodeCount > 0 ? '有测试节点' : '无测试节点'}
      />
      <StatusTag
        value={analysis.rollbackNodeCount > 0 ? 'success' : 'warning'}
        label={analysis.rollbackNodeCount > 0 ? '有回滚节点' : '无回滚节点'}
      />
      {analysis.approvalNodeCount > 0 || requiresApproval ? (
        <StatusTag value="warning" label="包含审批" />
      ) : (
        <StatusTag value="default" label="无审批" />
      )}
      <StatusTag
        value={analysis.isReleaseDagCompatible ? 'success' : 'error'}
        label={analysis.isReleaseDagCompatible ? 'DAG 正常' : 'DAG 异常'}
      />
    </Space>
  )
}

function renderWorkflowTemplateHealth(binding: DeliveryApplicationBindingSummary) {
  return renderWorkflowTemplateAnalysisTags(
    binding.workflowTemplate,
    binding.requiresApproval,
    Boolean(binding.workflowTemplateId),
  )
}

function renderEnvironmentBindingWorkflowHealth(
  record: ApplicationEnvironment,
  summary: DeliveryApplicationBindingSummary | undefined,
  workflowTemplateMap: Record<string, WorkflowTemplate>,
) {
  const workflowTemplateId = summary?.workflowTemplateId || record.workflowTemplateId || ''
  const template = summary?.workflowTemplate ?? workflowTemplateMap[workflowTemplateId]
  const requiresApproval = summary?.requiresApproval ?? record.releasePolicy?.requiresApproval
  return renderWorkflowTemplateAnalysisTags(template, requiresApproval, Boolean(workflowTemplateId))
}

function renderWorkflowTemplatePreview(
  template?: DeliveryApplicationBindingSummary['workflowTemplate'] | null,
) {
  if (!template) {
    return (
      <ManagementState
        bordered={false}
        compact
        kind="not-configured"
        description="未绑定 DAG 模板"
      />
    )
  }
  const analysis = analyzeReleaseDagDefinition(template.definition)
  const nodes = analysis.definition.nodes.slice(0, 7)
  return (
    <div className="soha-workflow-template-mini-preview">
      {nodes.map((node, index) => (
        <div className="soha-workflow-template-mini-preview__step" key={node.id}>
          {index > 0 ? (
            <span className="soha-workflow-template-mini-preview__arrow">-&gt;</span>
          ) : null}
          <span
            className={`soha-workflow-template-mini-preview__node ${isReleaseDagValidationNodeType(node.type) ? 'is-validation' : ''}`}
          >
            <strong>{node.name}</strong>
            <Text type="secondary">{releaseDagNodeLabel(node.type)}</Text>
          </span>
        </div>
      ))}
      {analysis.definition.nodes.length > nodes.length ? (
        <MetadataTag label={`+${analysis.definition.nodes.length - nodes.length}`} />
      ) : null}
    </div>
  )
}

function workflowTemplateValidationNodes(
  template?: DeliveryApplicationBindingSummary['workflowTemplate'] | null,
) {
  if (!template) return []
  return analyzeReleaseDagDefinition(template.definition).definition.nodes.filter((node) =>
    isReleaseDagValidationNodeType(node.type),
  )
}

type WorkflowCapabilityRow = {
  id: string
  environment: string
  nodeName: string
  nodeType: string
  executorKind?: string
  targetKind?: string
  capabilityRef?: string
  providerRef?: string
  artifactKinds?: string[]
}

function collectWorkflowCapabilityRows(
  bindings: DeliveryApplicationBindingSummary[],
): WorkflowCapabilityRow[] {
  return bindings.flatMap((binding) => {
    if (!binding.workflowTemplate?.definition) return []
    const environment = binding.environmentName || binding.environmentKey || binding.environmentId
    const analysis = analyzeReleaseDagDefinition(binding.workflowTemplate.definition)
    return analysis.definition.nodes
      .filter(
        (node: ReleaseDagNodeDefinition) =>
          node.executorKind ||
          node.targetKind ||
          node.capabilityRef ||
          node.providerRef ||
          node.artifactKinds?.length,
      )
      .map((node: ReleaseDagNodeDefinition) => ({
        id: `${binding.applicationEnvironmentId}:${node.id}`,
        environment,
        nodeName: node.name,
        nodeType: node.type,
        executorKind: node.executorKind,
        targetKind: node.targetKind,
        capabilityRef: node.capabilityRef,
        providerRef: node.providerRef,
        artifactKinds: node.artifactKinds,
      }))
  })
}

function renderBindingTargets(targets?: ApplicationEnvironment['targets']) {
  if (!targets?.length) return '-'
  return (
    <Space orientation="vertical" size={2}>
      {targets.slice(0, 2).map((target, index) => (
        <Text key={`${target.clusterId}-${target.namespace}-${target.workloadName}-${index}`}>
          {`${target.clusterId} / ${target.namespace} / ${target.workloadName}`}
        </Text>
      ))}
      {targets.length > 2 ? <Text type="secondary">{`+${targets.length - 2}`}</Text> : null}
    </Space>
  )
}

function renderSelectorLabels(selector?: ApplicationEnvironment['resourceSelector']) {
  const labels = Object.entries(selector?.matchLabels ?? {})
  if (!labels.length) return '-'
  return labels.map(([key, value]) => `${key}=${value}`).join(', ')
}

function runtimeWorkloadForService(
  runtime: ApplicationRuntimeDetail | undefined,
  service: ApplicationServiceComponent,
  applicationEnvironmentId?: string,
) {
  return runtime?.environments
    ?.filter(
      (environment) =>
        !applicationEnvironmentId ||
        environment.applicationEnvironmentId === applicationEnvironmentId,
    )
    ?.flatMap((environment) => environment.workloads ?? [])
    .find((workload) => workload.serviceId === service.id || workload.serviceKey === service.key)
}

function deliveryTargetSummary(
  target?: {
    clusterId: string
    namespace: string
    workloadKind: string
    workloadName: string
    containerName?: string
    targetKind?: string
    executorKind?: string
    groupKey?: string
    waveKey?: string
    regionKey?: string
    configRef?: string
  },
  serviceName?: string,
) {
  if (!target) return '-'
  const parts = [target.clusterId, target.namespace, target.workloadName]
  return [serviceName, target.workloadKind, parts.join(' / '), target.containerName]
    .filter(Boolean)
    .join(' · ')
}

function RepositoryRefField({
  form,
  index,
  binding,
  repository,
}: {
  form: FormInstance<DeliveryActionFormValues>
  index: number
  binding: BuildRepositoryBinding
  repository?: DeliveryRepository
}) {
  const refType = Form.useWatch(['repositoryRefs', index, 'refType'], form) ?? 'branch'
  const gitProjectId = repository?.gitlabProjectId ?? ''
  const branchesQuery = useQuery(
    deliveryQueries.repositories.gitBranches(
      { projectId: gitProjectId },
      Boolean(gitProjectId && refType === 'branch'),
    ),
  )
  const tagsQuery = useQuery(
    deliveryQueries.repositories.gitTags(
      { projectId: gitProjectId },
      Boolean(gitProjectId && refType === 'tag'),
    ),
  )
  const commitsQuery = useQuery(
    deliveryQueries.repositories.gitCommits(
      { projectId: gitProjectId, page: 1, limit: 50 },
      Boolean(gitProjectId && refType === 'commit'),
    ),
  )
  const referenceOptions =
    refType === 'branch'
      ? (branchesQuery.data ?? []).map((item) => ({ value: item.name, label: item.name }))
      : refType === 'tag'
        ? (tagsQuery.data ?? []).map((item) => ({ value: item.name, label: item.name }))
        : (commitsQuery.data?.items ?? []).map((item) => ({
            value: item.id,
            label: `${item.shortId} ${item.title}`,
          }))
  const loading =
    refType === 'branch'
      ? branchesQuery.isFetching
      : refType === 'tag'
        ? tagsQuery.isFetching
        : commitsQuery.isFetching

  return (
    <div className="soha-application-delivery-repository-ref">
      <Form.Item name={['repositoryRefs', index, 'repositoryId']} hidden>
        <Input />
      </Form.Item>
      <div className="soha-application-delivery-repository-ref__identity">
        <Text strong>{repository?.name || binding.repositoryId}</Text>
        <Text type="secondary">
          {binding.checkoutPath || (index === 0 ? '.' : `repository-${index + 1}`)}
        </Text>
      </div>
      <Form.Item
        name={['repositoryRefs', index, 'refType']}
        label="版本类型"
        rules={[{ required: true, message: '请选择版本类型' }]}
      >
        <Select
          options={REF_TYPE_OPTIONS.filter(
            (item) => item.value !== 'commit' || binding.allowCommitSelection,
          )}
        />
      </Form.Item>
      <Form.Item
        name={['repositoryRefs', index, 'refName']}
        label="分支 / Tag / Commit"
        rules={[{ required: true, message: '请选择或输入版本' }]}
      >
        {gitProjectId ? (
          <Select
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            loading={loading}
            options={referenceOptions}
          />
        ) : (
          <Input placeholder={binding.defaultBranch || repository?.defaultBranch || 'main'} />
        )}
      </Form.Item>
    </div>
  )
}

function buildDeliveryActionPayload(
  action: ApplicationDeliveryActionKind,
  values: DeliveryActionFormValues,
): ApplicationDeliveryActionRequest {
  const repositoryRefs = values.repositoryRefs?.filter(
    (item) => item.repositoryId && item.refType && item.refName,
  )
  const primaryRepositoryRef = repositoryRefs?.[0]
  return {
    action,
    applicationEnvironmentId: values.applicationEnvironmentId ?? '',
    targetId: values.targetId,
    buildSourceId: values.buildSourceId,
    refType: primaryRepositoryRef?.refType ?? values.refType,
    refName: primaryRepositoryRef?.refName ?? values.refName,
    repositoryRefs: repositoryRefs?.length ? repositoryRefs : undefined,
    imageTag: values.imageTag,
    releaseName: values.releaseName,
    containerName: values.containerName,
  }
}

function buildDeliveryPlanPayload(
  applicationId: string,
  action: ApplicationDeliveryActionKind,
  values: DeliveryActionFormValues,
): DeliveryPlanRequest {
  return {
    ...buildDeliveryActionPayload(action, values),
    applicationId,
    source: 'manual',
    reason: `${DELIVERY_ACTION_LABELS[action]} from application runtime page`,
  }
}

function disabledReason(reasons: Array<string | false | undefined>) {
  return reasons.find(Boolean) || ''
}

export function ApplicationDetailPage() {
  const { applicationId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const requestedTab = searchParams.get('tab')
  const requestedEnvironmentId = searchParams.get('applicationEnvironmentId')?.trim() ?? ''
  const focusedServiceId = searchParams.get('serviceId')?.trim() ?? ''
  const activeTab = APPLICATION_WORKSPACE_NAV_ITEMS.some(({ key }) => key === requestedTab)
    ? requestedTab!
    : 'overview'
  const [serviceModalVisible, setServiceModalVisible] = useState(false)
  const [editingService, setEditingService] = useState<ApplicationServiceComponent | null>(null)
  const [repositoryModalVisible, setRepositoryModalVisible] = useState(false)
  const [editingRepositoryId, setEditingRepositoryId] = useState('')
  const [repositoryBindingTarget, setRepositoryBindingTarget] = useState<number | null>(null)
  const [buildSourceModalVisible, setBuildSourceModalVisible] = useState(false)
  const [editingBuildSourceId, setEditingBuildSourceId] = useState('')
  const [buildSourceType, setBuildSourceType] = useState<BuildSource['type']>('repo_dockerfile')
  const [buildSourceDraft, setBuildSourceDraft] = useState<BuildSourceFormValues | null>(null)
  const [workflowCreateModalVisible, setWorkflowCreateModalVisible] = useState(false)
  const [deliveryActionModalVisible, setDeliveryActionModalVisible] = useState(false)
  const [deliveryPlanModalVisible, setDeliveryPlanModalVisible] = useState(false)
  const [pendingDeliveryPlan, setPendingDeliveryPlan] = useState<DeliveryPlan | null>(null)
  const [confirmedDeliveryPlan, setConfirmedDeliveryPlan] =
    useState<DeliveryPlanConfirmResult | null>(null)
  const [serviceForm] = Form.useForm<ServiceFormValues>()
  const [repositoryForm] = Form.useForm<RepositoryFormValues>()
  const [buildSourceForm] = Form.useForm<BuildSourceFormValues>()
  const [workflowCreateForm] = Form.useForm<WorkflowCreateFormValues>()
  const [deliveryForm] = Form.useForm<DeliveryActionFormValues>()
  const workflowCreateSource = Form.useWatch('source', workflowCreateForm)
  const workflowCreateEnvironmentId = Form.useWatch('applicationEnvironmentId', workflowCreateForm)
  const setActiveTab = (tab: string, environmentId?: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    if (environmentId) next.set('applicationEnvironmentId', environmentId)
    if (tab !== 'services') next.delete('serviceId')
    if (tab !== 'delivery') {
      next.delete('buildId')
      next.delete('releaseId')
      next.delete('workflowRunId')
    }
    setSearchParams(next, { replace: true })
  }
  const setActiveEnvironmentId = (environmentId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('applicationEnvironmentId', environmentId)
    setSearchParams(next)
  }
  const setFocusedService = (serviceId?: string) => {
    const next = new URLSearchParams(searchParams)
    if (serviceId) {
      next.set('tab', 'services')
      next.set('serviceId', serviceId)
    } else {
      next.delete('serviceId')
    }
    setSearchParams(next, { replace: true })
  }
  const permissionSnapshotQuery = usePermissionSnapshot()
  const runtimeQuery = useQuery(
    deliveryQueries.applications.runtime(applicationId ?? '', Boolean(applicationId)),
  )
  const detailQuery = useQuery(
    deliveryQueries.applications.detail(applicationId ?? '', Boolean(applicationId)),
  )
  const servicesQuery = useQuery(
    deliveryQueries.applications.services(applicationId ?? '', Boolean(applicationId)),
  )
  const repositoriesQuery = useQuery(
    deliveryQueries.repositories.list({ applicationId }, Boolean(applicationId)),
  )
  const managementState = useApplicationCenterState({
    currentApplication: runtimeQuery.data?.application,
    loadApplications: false,
    loadWorkflowTemplates: workflowCreateModalVisible && workflowCreateSource === 'template',
    loadClusters: activeTab === 'services',
  })
  const permissionSnapshot = permissionSnapshotQuery.data?.data
  const canCreateService = hasPermission(permissionSnapshot, 'delivery.application-services.create')
  const canUpdateService = hasPermission(permissionSnapshot, 'delivery.application-services.update')
  const canDeleteService = hasPermission(permissionSnapshot, 'delivery.application-services.delete')
  const canUpdateApplicationEnvironment = hasPermission(
    permissionSnapshot,
    'delivery.application-environments.update',
  )
  const canManageRepositories = managementState.canUpdateApplication
  const canTriggerBuild = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.builds.trigger',
  )
  const canTriggerWorkflow = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.workflows.trigger',
  )
  const canTriggerRelease = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.releases.trigger',
  )
  const selectedServiceRepositoryId = Form.useWatch('repositoryId', serviceForm)
  const selectedServiceBuildSourceId = Form.useWatch('buildSourceId', serviceForm)
  const selectedRepositoryProvider = Form.useWatch('provider', repositoryForm)
  const selectedGitLabProjectId = Form.useWatch('gitlabProjectId', repositoryForm)
  const gitProjectsQuery = useQuery(
    deliveryQueries.repositories.gitProjects(
      {},
      repositoryModalVisible && selectedRepositoryProvider === 'gitlab',
    ),
  )
  const gitBranchesQuery = useQuery(
    deliveryQueries.repositories.gitBranches(
      { projectId: selectedGitLabProjectId ?? '' },
      repositoryModalVisible &&
        selectedRepositoryProvider === 'gitlab' &&
        Boolean(selectedGitLabProjectId),
    ),
  )
  const buildTemplatesQuery = useQuery(
    deliveryQueries.buildTemplates.list(
      serviceModalVisible ||
        (buildSourceModalVisible && buildSourceType === 'platform_build_template'),
    ),
  )

  const runtime = runtimeQuery.data
  const detail = detailQuery.data
  const environments = runtime?.environments ?? []
  const activeEnvironment =
    environments.find((item) => item.applicationEnvironmentId === requestedEnvironmentId) ??
    environments[0]
  const activeEnvironmentId = activeEnvironment?.applicationEnvironmentId ?? ''
  const services = servicesQuery.data ?? []
  const repositories = repositoriesQuery.data ?? []
  const selectedServiceRepository = repositories.find(
    (item) => item.id === selectedServiceRepositoryId,
  )
  const selectedServiceBuildSource = (runtime?.application.buildSources ?? []).find(
    (item) => item.id === selectedServiceBuildSourceId,
  )
  const selectedServiceBuildRepositoryBindings = buildRepositoryBindings(selectedServiceBuildSource)
  const selectedServiceBuildTemplate = (buildTemplatesQuery.data ?? []).find(
    (item) => item.id === selectedServiceBuildSource?.config?.buildTemplateId,
  )
  const bindings = detail?.bindings ?? []
  const selectedDeliveryBindingId = Form.useWatch('applicationEnvironmentId', deliveryForm)
  const selectedTargetId = Form.useWatch('targetId', deliveryForm)
  const selectedBuildSourceId = Form.useWatch('buildSourceId', deliveryForm)
  const selectedImageTag = Form.useWatch('imageTag', deliveryForm)
  const buildSourceRepositoryBindings = Form.useWatch(
    ['config', 'repositoryBindings'],
    buildSourceForm,
  ) as BuildRepositoryBinding[] | undefined
  const selectedBuildTemplateId = Form.useWatch(['config', 'buildTemplateId'], buildSourceForm) as
    | string
    | undefined

  useAIPageContext({
    sourceWorkbench: 'delivery',
    sourceTitle: detail?.application?.name ? `应用 ${detail.application.name}` : '应用详情',
    entityKind: 'delivery.application',
    entityName: detail?.application?.name ?? detail?.application?.key ?? applicationId,
    applicationId,
    visibleFilters: {
      tab: activeTab,
      activeEnvironmentId,
      focusedServiceId,
    },
    pinnedData: {
      environmentCount: environments.length,
      serviceCount: services.length,
      bindingCount: bindings.length,
    },
  })
  const serviceBuildSourceOptions = useMemo(
    () =>
      (runtime?.application.buildSources ?? []).map((item) => ({
        value: item.id,
        label: `${item.name} · ${summarizeBuildSource(item)}`,
      })),
    [runtime?.application.buildSources],
  )
  const populateDeliveryBinding = useCallback(
    (bindingId?: string) => {
      const binding =
        bindings.find((item) => item.applicationEnvironmentId === bindingId) ?? bindings[0]
      if (!binding) {
        deliveryForm.resetFields()
        return
      }
      const target = binding.targets?.find((item) => item.enabled) ?? binding.targets?.[0]
      const source =
        binding.buildSource ??
        runtime?.application.buildSources?.find((item) => item.isDefault) ??
        runtime?.application.buildSources?.[0]
      const repositoryRefs = buildRepositoryRefs(source, repositories)
      const primaryRepositoryRef = repositoryRefs[0]
      deliveryForm.setFieldsValue({
        applicationEnvironmentId: binding.applicationEnvironmentId,
        targetId: target?.id,
        buildSourceId: binding.buildSourceId || source?.id,
        refType:
          primaryRepositoryRef?.refType ||
          (binding.buildPolicy?.refType as DeliveryActionFormValues['refType']) ||
          'branch',
        refName: primaryRepositoryRef?.refName || binding.buildPolicy?.refValue || 'main',
        repositoryRefs,
        imageTag: source?.defaultTag || runtime?.application.defaultTag,
        containerName: target?.containerName,
      })
    },
    [
      bindings,
      deliveryForm,
      repositories,
      runtime?.application.buildSources,
      runtime?.application.defaultTag,
    ],
  )

  useEffect(() => {
    if (!applicationId || managementState.selectedApplicationId === applicationId) return
    managementState.setSelectedApplicationId(applicationId)
  }, [applicationId, managementState])
  const createDeliveryPlanOptions = deliveryMutations.plans.create(queryClient)
  const createDeliveryPlanMutation = useMutation({
    ...createDeliveryPlanOptions,
    onSuccess: (plan, variables, onMutateResult, context) => {
      void createDeliveryPlanOptions.onSuccess?.(plan, variables, onMutateResult, context)
      setDeliveryActionModalVisible(false)
      setPendingDeliveryPlan(plan)
      setConfirmedDeliveryPlan(null)
      setDeliveryPlanModalVisible(true)
      message.success('交付计划已生成')
    },
    onError: (err: Error) => message.error(err.message),
  })

  const confirmDeliveryPlanOptions = deliveryMutations.plans.confirm(queryClient)
  const confirmDeliveryPlanMutation = useMutation({
    ...confirmDeliveryPlanOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void confirmDeliveryPlanOptions.onSuccess?.(result, variables, onMutateResult, context)
      setPendingDeliveryPlan(result.plan)
      setConfirmedDeliveryPlan(result.plan.status === 'confirmed' ? result : null)
      message.success(
        result.plan.status === 'waiting_approval'
          ? '交付计划已提交审批'
          : `${DELIVERY_ACTION_LABELS[result.plan.action]}已触发`,
      )
    },
    onError: (err: Error) => message.error(err.message),
  })
  const approvalOptions = deliveryMutations.plans.approval(queryClient)
  const approvalMutation = useMutation({
    ...approvalOptions,
    onSuccess: (plan, variables, onMutateResult, context) => {
      void approvalOptions.onSuccess?.(plan, variables, onMutateResult, context)
      setPendingDeliveryPlan(plan)
      message.success(
        variables.action === 'approve' ? '交付计划已批准，可再次确认执行' : '交付计划已拒绝',
      )
    },
    onError: (err: Error) => message.error(err.message),
  })

  const createServiceOptions = deliveryMutations.applications.createService(queryClient)
  const createServiceMutation = useMutation({
    ...createServiceOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void createServiceOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('服务组件已创建')
      setServiceModalVisible(false)
      setEditingService(null)
      serviceForm.resetFields()
    },
    onError: (err: Error) => message.error(err.message),
  })
  const updateServiceOptions = deliveryMutations.applications.updateService(queryClient)
  const updateServiceMutation = useMutation({
    ...updateServiceOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void updateServiceOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('服务组件已更新')
      setServiceModalVisible(false)
      setEditingService(null)
      serviceForm.resetFields()
    },
    onError: (err: Error) => message.error(err.message),
  })
  const deleteServiceOptions = deliveryMutations.applications.deleteService(queryClient)
  const deleteServiceMutation = useMutation({
    ...deleteServiceOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void deleteServiceOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('服务组件已删除')
    },
    onError: (err: Error) => message.error(err.message),
  })

  const createRepositoryOptions = deliveryMutations.repositories.create(queryClient)
  const closeRepositoryModal = () => {
    setRepositoryModalVisible(false)
    setEditingRepositoryId('')
    setRepositoryBindingTarget(null)
    repositoryForm.resetFields()
  }
  const createRepositoryMutation = useMutation({
    ...createRepositoryOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void createRepositoryOptions.onSuccess?.(result, variables, onMutateResult, context)
      if (repositoryBindingTarget !== null) {
        buildSourceForm.setFieldValue(
          ['config', 'repositoryBindings', repositoryBindingTarget, 'repositoryId'],
          result.id,
        )
        buildSourceForm.setFieldValue(
          ['config', 'repositoryBindings', repositoryBindingTarget, 'defaultBranch'],
          result.defaultBranch,
        )
      }
      message.success('代码仓库已创建')
      closeRepositoryModal()
    },
    onError: (err: Error) => message.error(err.message),
  })
  const updateRepositoryOptions = deliveryMutations.repositories.update(queryClient)
  const updateRepositoryMutation = useMutation({
    ...updateRepositoryOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void updateRepositoryOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('代码仓库已更新')
      closeRepositoryModal()
    },
    onError: (err: Error) => message.error(err.message),
  })
  const deleteRepositoryOptions = deliveryMutations.repositories.delete(queryClient)
  const deleteRepositoryMutation = useMutation({
    ...deleteRepositoryOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void deleteRepositoryOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('代码仓库已删除')
    },
    onError: (err: Error) => message.error(err.message),
  })

  const openServiceModal = (service?: ApplicationServiceComponent) => {
    const nextService = service ?? null
    setEditingService(nextService)
    setServiceModalVisible(true)
  }

  useEffect(() => {
    if (!serviceModalVisible) return
    const values = serviceInitialValues(editingService)
    const source =
      runtime?.application.buildSources?.find((item) => item.id === values.buildSourceId) ??
      runtime?.application.buildSources?.find((item) => item.isDefault) ??
      runtime?.application.buildSources?.[0]
    const primaryBinding = buildRepositoryBindings(source)[0]
    const repository = repositories.find((item) => item.id === primaryBinding?.repositoryId)
    serviceForm.setFieldsValue({
      ...values,
      buildSourceId: values.buildSourceId || source?.id,
      repositoryId: values.repositoryId || repository?.id,
      repositoryPath: values.repositoryPath || repository?.path,
      defaultBranch:
        values.defaultBranch || primaryBinding?.defaultBranch || repository?.defaultBranch,
    })
  }, [
    editingService,
    repositories,
    runtime?.application.buildSources,
    serviceForm,
    serviceModalVisible,
  ])

  const openRepositoryModal = (repositoryId = '', bindingTarget: number | null = null) => {
    const repository = repositories.find((item) => item.id === repositoryId)
    setEditingRepositoryId(repositoryId)
    setRepositoryBindingTarget(bindingTarget)
    setRepositoryModalVisible(true)
    repositoryForm.setFieldsValue(
      repository
        ? { ...repository }
        : { provider: 'gitlab', protocol: 'https', defaultBranch: 'main' },
    )
  }

  const openBuildSourceModal = (source?: BuildSource) => {
    if (!canManageRepositories) return
    const repositoryBindings = source
      ? buildRepositoryBindings(source)
      : repositories[0]
        ? [
            {
              repositoryId: repositories[0].id,
              checkoutPath: '.',
              defaultBranch: repositories[0].defaultBranch,
              allowCommitSelection: false,
              submodules: false,
            },
          ]
        : [
            {
              repositoryId: '',
              checkoutPath: '.',
              defaultBranch: 'main',
              allowCommitSelection: false,
              submodules: false,
            },
          ]
    setEditingBuildSourceId(source?.id ?? '')
    setBuildSourceType(source?.type ?? 'repo_dockerfile')
    setBuildSourceDraft(
      source
        ? {
            ...source,
            config: { ...source.config, repositoryBindings },
          }
        : {
            name: '',
            type: 'repo_dockerfile',
            enabled: true,
            isDefault: !runtime?.application.buildSources?.length,
            config: {
              repositoryId: repositories[0]?.id,
              repositoryBindings,
              contextDir: '.',
              dockerfilePath: 'Dockerfile',
              builderKind: 'docker',
            },
          },
    )
    setBuildSourceModalVisible(true)
  }

  useEffect(() => {
    populateDeliveryBinding(deliveryForm.getFieldValue('applicationEnvironmentId'))
  }, [deliveryForm, populateDeliveryBinding])

  const workloads = activeEnvironment?.workloads ?? []
  const runtimeWorkloads = workloads
  const runtimeStatusCounts = runtimeWorkloads.reduce<Record<OverviewTone, number>>(
    (counts, workload) => {
      counts[workloadRuntimeStatus(workload).tone] += 1
      return counts
    },
    { default: 0, success: 0, warning: 0, danger: 0 },
  )
  const selectedDeliveryBinding =
    bindings.find((item) => item.applicationEnvironmentId === selectedDeliveryBindingId) ??
    bindings[0]
  const enabledTargets = selectedDeliveryBinding?.targets?.filter((item) => item.enabled) ?? []
  const selectedDeliveryTarget =
    selectedDeliveryBinding?.targets?.find((item) => item.id === selectedTargetId) ??
    enabledTargets[0] ??
    selectedDeliveryBinding?.targets?.[0]
  const deliveryActionsCapability = useClusterCapabilityForCluster(
    'delivery.actions',
    'zh_CN',
    activeTab === 'delivery' || activeTab === 'verification' || activeTab === 'capabilities'
      ? selectedDeliveryTarget?.clusterId
      : undefined,
  )
  const selectedBuildSource =
    runtime?.application.buildSources?.find((item) => item.id === selectedBuildSourceId) ??
    selectedDeliveryBinding?.buildSource ??
    runtime?.application.buildSources?.find((item) => item.isDefault) ??
    runtime?.application.buildSources?.[0]
  const selectedBuildRepositoryBindings = buildRepositoryBindings(selectedBuildSource)
  const selectedBuildTemplate = (buildTemplatesQuery.data ?? []).find(
    (item) => item.id === selectedBuildTemplateId,
  )
  const effectiveImageTag =
    selectedImageTag || selectedBuildSource?.defaultTag || runtime?.application.defaultTag || ''
  const validationNodeCount = workflowTemplateValidationNodeCount(
    selectedDeliveryBinding?.workflowTemplate,
  )
  const selectedWorkflowValidationNodes = workflowTemplateValidationNodes(
    selectedDeliveryBinding?.workflowTemplate,
  )
  const selectedWorkflowAnalysis = selectedDeliveryBinding?.workflowTemplate
    ? analyzeReleaseDagDefinition(selectedDeliveryBinding.workflowTemplate.definition)
    : null
  const workflowCapabilityRows = useMemo(() => collectWorkflowCapabilityRows(bindings), [bindings])
  const bindingSummaryById = useMemo(
    () =>
      Object.fromEntries(bindings.map((binding) => [binding.applicationEnvironmentId, binding])),
    [bindings],
  )
  const openApplicationEdit = () => {
    if (!runtime?.application) return
    managementState.setEditingApp(runtime.application)
    managementState.setBuildSources(runtime.application.buildSources ?? [])
    managementState.setAppModalVisible(true)
  }
  const openBindingCreate = () => {
    managementState.setEditingBinding(null)
    managementState.bindingForm.resetFields()
    managementState.setBindingModalVisible(true)
  }
  const openBindingEdit = (binding: ApplicationEnvironment) => {
    managementState.setEditingBinding(binding)
    managementState.setBindingModalVisible(true)
  }
  const openWorkflowCreate = () => {
    if (!canUpdateApplicationEnvironment) return
    workflowCreateForm.setFieldsValue({
      name: `${runtime?.application.name || '应用'}工作流`,
      applicationEnvironmentId: bindings[0]?.applicationEnvironmentId,
      source: 'blank',
      templateId: undefined,
    })
    setWorkflowCreateModalVisible(true)
  }
  const openWorkflowDesigner = (binding: DeliveryApplicationBindingSummary) => {
    if (!applicationId || !canUpdateApplicationEnvironment) return
    navigate(
      applicationWorkflowDesignPath(applicationId, {
        applicationEnvironmentId: binding.applicationEnvironmentId,
        templateId: binding.workflowTemplateId,
      }),
    )
  }
  const deliveryTargetActionsDisabled =
    deliveryActionsCapability.status !== 'unknown' &&
    deliveryActionsCapability.status !== 'available'
  const deliveryTargetCapabilityReason = deliveryTargetActionsDisabled
    ? deliveryActionsCapability.reason
    : ''
  const triggerDeliveryAction = async (action: ApplicationDeliveryActionKind) => {
    try {
      const values = await deliveryForm.validateFields()
      if (!applicationId) return
      createDeliveryPlanMutation.mutate(buildDeliveryPlanPayload(applicationId, action, values))
    } catch {
      // antd Form has already marked the invalid fields.
    }
  }
  const deliveryActionPending =
    createDeliveryPlanMutation.isPending || confirmDeliveryPlanMutation.isPending
  const buildDeployDisabledReason = disabledReason([
    !selectedDeliveryBinding && '无环境绑定',
    !selectedDeliveryTarget && '无服务 / Workload',
    !selectedDeliveryBinding?.workflowTemplate && '无工作流模板',
    deliveryTargetCapabilityReason,
    !effectiveImageTag && '缺少镜像 Tag / 默认 Tag',
    !canTriggerBuild && '缺少构建权限',
    !canTriggerWorkflow && '缺少工作流权限',
  ])

  if (runtimeQuery.isLoading) {
    return (
      <div className="soha-page">
        <Tabs
          className="soha-resource-tabs is-header-only"
          activeKey={activeTab}
          items={APPLICATION_WORKSPACE_NAV_ITEMS}
          onChange={setActiveTab}
        />
        <ManagementState kind="loading" title="正在加载应用" />
      </div>
    )
  }

  if (runtimeQuery.isError) {
    const notFound = isApiError(runtimeQuery.error) && runtimeQuery.error.status === 404
    return (
      <div className="soha-page">
        <ManagementState
          kind={notFound ? 'not-found' : 'error'}
          title={notFound ? '应用不存在' : '应用加载失败'}
          description={notFound ? '应用不存在或已被删除' : '暂时无法读取应用运行态，请重试。'}
          actions={
            notFound ? undefined : (
              <Button aria-label="重试" onClick={() => void runtimeQuery.refetch()}>
                重试
              </Button>
            )
          }
        />
      </div>
    )
  }

  if (!runtime) {
    return (
      <div className="soha-page">
        <ManagementState kind="not-found" title="应用不存在" description="应用不存在或已被删除" />
      </div>
    )
  }

  const focusedService = services.find((service) => service.id === focusedServiceId)
  const focusedServiceBuildSource = runtime.application.buildSources?.find(
    (source) => source.id === focusedService?.buildSourceId,
  )
  const focusedServiceWorkloads = focusedService
    ? (runtime.environments ?? []).flatMap((environment) =>
        (environment.workloads ?? [])
          .filter(
            (workload) =>
              workload.serviceId === focusedService.id ||
              workload.serviceKey === focusedService.key,
          )
          .map((workload) => ({
            ...workload,
            environmentName:
              environment.environmentName ||
              environment.environmentKey ||
              environment.environmentId,
          })),
      )
    : []
  const configuredWorkflowBindings = bindings.filter((binding) => binding.workflowTemplateId)
  const selectedWorkflowCreateBinding = bindings.find(
    (binding) => binding.applicationEnvironmentId === workflowCreateEnvironmentId,
  )
  const reusableWorkflowTemplates = (managementState.workflowTemplatesQuery.data ?? []).filter(
    (template) => !template.category?.startsWith('application:'),
  )
  const permissionRows = [
    { key: 'delivery.builds.trigger', label: '构建', enabled: canTriggerBuild },
    { key: 'delivery.workflows.trigger', label: '工作流', enabled: canTriggerWorkflow },
    { key: 'delivery.releases.trigger', label: '发布', enabled: canTriggerRelease },
    { key: 'delivery.application-services.create', label: '新建服务', enabled: canCreateService },
    { key: 'delivery.application-services.update', label: '修改服务', enabled: canUpdateService },
    { key: 'delivery.application-services.delete', label: '删除服务', enabled: canDeleteService },
  ]
  const applicationOverviewWorkspace = (
    <div className="soha-application-overview">
      <section className="soha-application-overview__section" aria-label="环境信息">
        <OverviewSectionBar title="环境信息" />
        {environments.length > 0 ? (
          <div
            className="soha-application-overview-list soha-application-overview-list--environments"
            role="table"
            aria-label="环境信息"
          >
            <div className="soha-application-overview-list__header" role="row">
              <span role="columnheader">环境</span>
              <span role="columnheader">交付流程</span>
              <span role="columnheader">服务</span>
              <span role="columnheader">状态</span>
            </div>
            {environments.map((environment) => {
              const binding = bindings.find(
                (item) => item.applicationEnvironmentId === environment.applicationEnvironmentId,
              )
              const environmentName =
                environment.environmentName ||
                environment.environmentKey ||
                environment.environmentId
              const workloads = environment.workloads ?? []
              const runtimeUnavailable = environment.status === 'unavailable'
              const runtimeStatus = runtimeUnavailable
                ? 'unavailable'
                : workloads.length
                  ? workloads.every((item) => item.readyReplicas >= item.desiredReplicas)
                    ? 'healthy'
                    : 'warning'
                  : summarizeBindingStatus(binding)
              return (
                <div
                  key={environment.applicationEnvironmentId}
                  className="soha-application-overview-list__row"
                  role="row"
                >
                  <div
                    className="soha-application-overview-list__cell soha-application-overview-list__identity"
                    role="cell"
                    data-label="环境"
                  >
                    <strong>{environmentName}</strong>
                    <Text type="secondary">
                      {environment.environmentKey || environment.environmentId}
                    </Text>
                  </div>
                  <div
                    className="soha-application-overview-list__cell"
                    role="cell"
                    data-label="交付流程"
                  >
                    {binding?.workflowTemplate?.name || binding?.workflowTemplateName || '未绑定'}
                  </div>
                  <div
                    className="soha-application-overview-list__cell"
                    role="cell"
                    data-label="服务"
                  >
                    {workloads.length} 个
                  </div>
                  <div
                    className="soha-application-overview-list__cell"
                    role="cell"
                    data-label="状态"
                  >
                    <StatusTag
                      value={runtimeStatus}
                      label={
                        runtimeUnavailable
                          ? '集群不可用'
                          : !binding && workloads.length === 0
                            ? '未部署'
                            : undefined
                      }
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <ManagementState bordered={false} compact kind="empty" description="暂无应用环境" />
        )}
      </section>

      <section className="soha-application-overview__section" aria-label="工作流信息">
        <OverviewSectionBar title="工作流信息" />
        {detailQuery.isLoading ? (
          <ManagementState bordered={false} compact kind="loading" title="正在加载工作流" />
        ) : bindings.length > 0 ? (
          <div
            className="soha-application-overview-list soha-application-overview-list--workflows"
            role="table"
            aria-label="工作流信息"
          >
            <div className="soha-application-overview-list__header" role="row">
              <span role="columnheader">工作流</span>
              <span role="columnheader">环境</span>
              <span role="columnheader">步骤</span>
              <span role="columnheader">最近运行</span>
            </div>
            {bindings.map((binding) => (
              <div
                key={binding.applicationEnvironmentId}
                className="soha-application-overview-list__row"
                role="row"
              >
                <div
                  className="soha-application-overview-list__cell soha-application-overview-list__identity"
                  role="cell"
                  data-label="工作流"
                >
                  <strong>
                    {binding.workflowTemplate?.name ||
                      binding.workflowTemplateName ||
                      '未绑定工作流'}
                  </strong>
                  <Text type="secondary">
                    {binding.workflowTemplate?.key || binding.workflowTemplateId || '-'}
                  </Text>
                </div>
                <div className="soha-application-overview-list__cell" role="cell" data-label="环境">
                  {binding.environmentName || binding.environmentKey || binding.environmentId}
                </div>
                <div className="soha-application-overview-list__cell" role="cell" data-label="步骤">
                  {binding.workflowTemplate
                    ? `${analyzeReleaseDagDefinition(binding.workflowTemplate.definition).nodeCount} 个`
                    : '-'}
                </div>
                <div
                  className="soha-application-overview-list__cell"
                  role="cell"
                  data-label="最近运行"
                >
                  <StatusTag
                    value={binding.latestWorkflow?.status || 'default'}
                    label={binding.latestWorkflow ? undefined : '未运行'}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ManagementState
            bordered={false}
            compact
            kind="not-configured"
            description="尚未为应用环境绑定交付工作流"
          />
        )}
      </section>
    </div>
  )

  return (
    <div className="soha-page">
      <Modal
        width={820}
        title="交付计划确认"
        open={deliveryPlanModalVisible}
        onCancel={() => setDeliveryPlanModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDeliveryPlanModalVisible(false)}>
            关闭
          </Button>,
          ...(pendingDeliveryPlan?.status === 'waiting_approval'
            ? [
                <Button
                  key="reject"
                  danger
                  loading={approvalMutation.isPending}
                  onClick={() =>
                    approvalMutation.mutate({ id: pendingDeliveryPlan.id, action: 'reject' })
                  }
                >
                  拒绝
                </Button>,
                <Button
                  key="approve"
                  type="primary"
                  loading={approvalMutation.isPending}
                  onClick={() =>
                    approvalMutation.mutate({ id: pendingDeliveryPlan.id, action: 'approve' })
                  }
                >
                  批准
                </Button>,
              ]
            : []),
          <Button
            key="confirm"
            type="primary"
            disabled={!pendingDeliveryPlan || pendingDeliveryPlan.status !== 'draft'}
            loading={confirmDeliveryPlanMutation.isPending}
            onClick={() =>
              pendingDeliveryPlan && confirmDeliveryPlanMutation.mutate(pendingDeliveryPlan.id)
            }
          >
            确认执行
          </Button>,
        ]}
      >
        {confirmedDeliveryPlan ? (
          <Alert
            showIcon
            type="success"
            title="计划已确认并触发执行"
            description={
              confirmedDeliveryPlan.result.relatedIds?.executionTaskId ||
              confirmedDeliveryPlan.result.relatedIds?.workflowRunId ||
              confirmedDeliveryPlan.result.relatedIds?.releaseBundleId ||
              '执行请求已提交'
            }
          />
        ) : (
          <Alert
            showIcon
            type="warning"
            title="确认前不会触发执行"
            description="请核对风险、审批要求、目标环境和回滚策略。确认后才会触发现有交付动作 API。"
          />
        )}
        {pendingDeliveryPlan ? (
          <Space orientation="vertical" size={12} style={{ width: '100%', marginTop: 12 }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: 'action',
                  label: '动作',
                  children: DELIVERY_ACTION_LABELS[pendingDeliveryPlan.action],
                },
                {
                  key: 'app',
                  label: '应用',
                  children:
                    pendingDeliveryPlan.applicationName || pendingDeliveryPlan.applicationId,
                },
                {
                  key: 'env',
                  label: '环境',
                  children:
                    pendingDeliveryPlan.environmentKey ||
                    pendingDeliveryPlan.applicationEnvironmentId,
                },
                {
                  key: 'target',
                  label: '目标',
                  children: pendingDeliveryPlan.targetSummary || '-',
                },
                {
                  key: 'ref',
                  label: '版本来源',
                  children:
                    [pendingDeliveryPlan.refType, pendingDeliveryPlan.refName]
                      .filter(Boolean)
                      .join(' / ') || '-',
                },
                {
                  key: 'risk',
                  label: '风险',
                  children: (
                    <StatusTag
                      value={pendingDeliveryPlan.riskLevel || 'unknown'}
                      label={pendingDeliveryPlan.riskLevel || 'unknown'}
                    />
                  ),
                },
                {
                  key: 'approval',
                  label: '审批',
                  children: pendingDeliveryPlan.requiresApproval ? (
                    <StatusTag value="warning" label="需要审批" />
                  ) : (
                    <StatusTag value="default" label="无需审批" />
                  ),
                },
                {
                  key: 'rollback',
                  label: '回滚策略',
                  children: pendingDeliveryPlan.rollbackStrategy || '-',
                },
              ]}
            />
            <Card size="small" title="影响范围">
              <pre className="soha-json-block">
                {JSON.stringify(pendingDeliveryPlan.impact ?? {}, null, 2)}
              </pre>
            </Card>
          </Space>
        ) : null}
      </Modal>
      <Modal
        forceRender
        title="创建工作流"
        styles={{ header: { minHeight: 32 }, title: visuallyHiddenModalTitleStyle }}
        okText="创建工作流"
        open={workflowCreateModalVisible}
        width={600}
        onCancel={() => setWorkflowCreateModalVisible(false)}
        onOk={() => workflowCreateForm.submit()}
      >
        <Form
          form={workflowCreateForm}
          layout="vertical"
          onFinish={(values) => {
            if (!applicationId) return
            setWorkflowCreateModalVisible(false)
            navigate(
              applicationWorkflowDesignPath(applicationId, {
                applicationEnvironmentId: values.applicationEnvironmentId,
                name: values.name.trim(),
                source: values.source,
                templateId: values.source === 'template' ? values.templateId : undefined,
              }),
            )
          }}
        >
          <Form.Item
            name="name"
            label="工作流名称"
            rules={[{ required: true, whitespace: true, message: '请输入工作流名称' }]}
          >
            <Input maxLength={80} placeholder="例如：测试环境发布" />
          </Form.Item>
          <Form.Item
            name="applicationEnvironmentId"
            label="运行环境"
            rules={[{ required: true, message: '请选择运行环境' }]}
          >
            <Select
              options={bindings.map((binding) => ({
                value: binding.applicationEnvironmentId,
                label: `${binding.environmentName || binding.environmentKey || binding.environmentId}${binding.workflowTemplateId ? ' · 已有工作流' : ''}`,
              }))}
              placeholder="选择工作流所属环境"
            />
          </Form.Item>
          {selectedWorkflowCreateBinding?.workflowTemplateId ? (
            <Alert
              showIcon
              type="warning"
              title="该环境已有工作流"
              description="保存新设计后会替换该环境当前绑定的工作流；原全局模板不会被修改。"
            />
          ) : null}
          <Form.Item name="source" label="创建方式" rules={[{ required: true }]}>
            <Radio.Group className="soha-application-workflow-source-options">
              <Radio value="blank">
                <span className="soha-application-workflow-source-option__copy">
                  <Text strong>空白画布</Text>
                  <Text type="secondary">自行添加构建、部署、测试与审批节点。</Text>
                </span>
              </Radio>
              <Radio value="template">
                <span className="soha-application-workflow-source-option__copy">
                  <Text strong>从模板开始</Text>
                  <Text type="secondary">复制平台模板作为起点，创建后可独立编辑。</Text>
                </span>
              </Radio>
            </Radio.Group>
          </Form.Item>
          {workflowCreateSource === 'template' ? (
            <Form.Item
              name="templateId"
              label="起始模板"
              rules={[{ required: true, message: '请选择起始模板' }]}
            >
              <Select
                loading={managementState.workflowTemplatesQuery.isFetching}
                options={reusableWorkflowTemplates.map((template) => ({
                  value: template.id,
                  label: `${template.name} · ${template.key}`,
                }))}
                placeholder="选择模板创建工作流"
              />
            </Form.Item>
          ) : (
            <Text type="secondary">创建后在空白画布中自行添加构建、部署、测试与审批流程。</Text>
          )}
        </Form>
      </Modal>
      <Tabs
        className="soha-resource-tabs"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={(() => {
          const existingTabs = [
            {
              key: 'settings',
              label: '配置',
              children: (
                <div className="soha-application-runtime-settings-grid">
                  <section className="soha-application-settings-summary soha-application-service-config-section">
                    <OverviewSectionBar
                      title="服务配置"
                      description="服务 → Git 仓库 → 构建定义 → 产物镜像"
                      extra={
                        <Space>
                          {canCreateService ? (
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={() => openServiceModal()}
                            >
                              新建服务
                            </Button>
                          ) : null}
                          {managementState.canUpdateApplication ? (
                            <Button icon={<EditOutlined />} onClick={openApplicationEdit}>
                              编辑应用档案
                            </Button>
                          ) : null}
                        </Space>
                      }
                    />
                    {services.length > 0 ? (
                      <div className="soha-application-long-card-list" role="list">
                        {services.map((service) => {
                          const repository = repositories.find(
                            (item) => item.id === service.repositoryId,
                          )
                          const buildSource = runtime.application.buildSources?.find(
                            (item) => item.id === service.buildSourceId,
                          )
                          return (
                            <Card
                              key={service.id}
                              size="small"
                              role="listitem"
                              className="soha-application-long-card"
                              title={
                                <Space size={6} wrap>
                                  <Text strong>{service.name}</Text>
                                  <MetadataTag label={serviceKindLabel(service.serviceKind)} />
                                  <StatusTag value={service.enabled ? 'enabled' : 'disabled'} />
                                </Space>
                              }
                              extra={
                                <Space size={2}>
                                  {canUpdateService ? (
                                    <ManagementIconButton
                                      aria-label={`编辑服务 ${service.name}`}
                                      icon={<EditOutlined />}
                                      size="small"
                                      tooltip="编辑服务"
                                      onClick={() => openServiceModal(service)}
                                    />
                                  ) : null}
                                  <ManagementIconButton
                                    aria-label={`查看服务 ${service.name}`}
                                    icon={<ArrowRightOutlined />}
                                    size="small"
                                    tooltip="查看服务"
                                    onClick={() => setFocusedService(service.id)}
                                  />
                                </Space>
                              }
                            >
                              <Descriptions
                                size="small"
                                column={{ xs: 1, sm: 2, lg: 4 }}
                                items={[
                                  {
                                    key: 'repository',
                                    label: 'Git 仓库',
                                    children:
                                      repository?.name || service.repositoryPath || '未配置',
                                  },
                                  {
                                    key: 'build-source',
                                    label: '构建来源',
                                    children: buildSource?.name || '未配置',
                                  },
                                  {
                                    key: 'artifact',
                                    label: '产物镜像',
                                    children:
                                      service.containers?.[0]?.imageRepository ||
                                      buildSource?.buildImage ||
                                      '未配置',
                                  },
                                  {
                                    key: 'branch',
                                    label: '默认分支',
                                    children:
                                      service.defaultBranch || repository?.defaultBranch || '-',
                                  },
                                ]}
                              />
                            </Card>
                          )
                        })}
                      </div>
                    ) : (
                      <ManagementState
                        bordered={false}
                        compact
                        kind="not-configured"
                        description="尚未配置服务。"
                      />
                    )}
                  </section>
                  <DeliveryTable
                    title="代码仓库"
                    actions={
                      canManageRepositories ? (
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => openRepositoryModal()}
                        >
                          添加仓库
                        </Button>
                      ) : null
                    }
                    rowKey="id"
                    pagination={false}
                    dataSource={repositories}
                    loading={repositoriesQuery.isLoading}
                    columns={[
                      { title: '名称', dataIndex: 'name' },
                      {
                        title: '提供方',
                        dataIndex: 'provider',
                        render: (value: string) => <MetadataTag label={value} />,
                      },
                      { title: '路径', dataIndex: 'path' },
                      { title: '默认分支', dataIndex: 'defaultBranch' },
                      { title: '协议', dataIndex: 'protocol' },
                      ...(canManageRepositories
                        ? [
                            {
                              title: '操作',
                              dataIndex: 'id',
                              width: 96,
                              render: (id: string) => (
                                <Space size={2}>
                                  <ManagementIconButton
                                    aria-label="编辑代码仓库"
                                    icon={<EditOutlined />}
                                    tooltip="编辑"
                                    onClick={() => openRepositoryModal(id)}
                                  />
                                  <Popconfirm
                                    title="确认删除该代码仓库？"
                                    onConfirm={() => deleteRepositoryMutation.mutate(id)}
                                  >
                                    <ManagementIconButton
                                      aria-label="删除代码仓库"
                                      danger
                                      icon={<DeleteOutlined />}
                                      tooltip="删除"
                                    />
                                  </Popconfirm>
                                </Space>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                  <DeliveryTable
                    title="构建来源"
                    actions={
                      managementState.canUpdateApplication ? (
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => openBuildSourceModal()}
                        >
                          添加构建
                        </Button>
                      ) : null
                    }
                    rowKey="id"
                    pagination={false}
                    dataSource={runtime.application.buildSources ?? []}
                    columns={[
                      { title: '名称', dataIndex: 'name' },
                      {
                        title: '类型',
                        dataIndex: 'type',
                        render: (_: unknown, record: BuildSource) => (
                          <MetadataTag label={summarizeBuildSource(record)} />
                        ),
                      },
                      {
                        title: '镜像',
                        dataIndex: 'buildImage',
                        render: (value: string) => value || '-',
                      },
                      {
                        title: '默认 Tag',
                        dataIndex: 'defaultTag',
                        render: (value: string) => value || '-',
                      },
                      {
                        title: '默认',
                        dataIndex: 'isDefault',
                        render: (value: boolean) => (
                          <StatusTag value={value ? 'enabled' : 'disabled'} />
                        ),
                      },
                      {
                        title: '启用',
                        dataIndex: 'enabled',
                        render: (value: boolean) => (
                          <StatusTag value={value ? 'enabled' : 'disabled'} />
                        ),
                      },
                      ...(managementState.canUpdateApplication
                        ? [
                            {
                              title: '操作',
                              dataIndex: 'id',
                              width: 96,
                              render: (id: string, record: BuildSource) => (
                                <Space size={2}>
                                  <ManagementIconButton
                                    aria-label="编辑构建源"
                                    icon={<EditOutlined />}
                                    tooltip="编辑"
                                    onClick={() => openBuildSourceModal(record)}
                                  />
                                  <Popconfirm
                                    title="确认删除该构建源？"
                                    onConfirm={() =>
                                      managementState.updateAppMutation.mutate({
                                        id: runtime.application.id,
                                        payload: {
                                          ...runtime.application,
                                          buildSources: (
                                            runtime.application.buildSources ?? []
                                          ).filter((item) => item.id !== id),
                                        },
                                      })
                                    }
                                  >
                                    <ManagementIconButton
                                      aria-label="删除构建源"
                                      danger
                                      icon={<DeleteOutlined />}
                                      tooltip="删除"
                                    />
                                  </Popconfirm>
                                </Space>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'environment-bindings',
              label: '环境绑定',
              children: (
                <Card
                  className="soha-management-panel-card"
                  title="环境绑定"
                  loading={managementState.bindingsQuery.isLoading}
                  extra={
                    <Space>
                      <ManagementRefreshButton
                        aria-label="刷新环境绑定"
                        tooltip="刷新"
                        loading={managementState.bindingsQuery.isFetching}
                        onClick={() => void managementState.bindingsQuery.refetch()}
                      />
                      {managementState.canCreateBinding ? (
                        <Button type="primary" icon={<PlusOutlined />} onClick={openBindingCreate}>
                          新建绑定
                        </Button>
                      ) : null}
                    </Space>
                  }
                >
                  {managementState.filteredBindings.length > 0 ? (
                    <div
                      className="soha-application-long-card-list soha-application-environment-binding-list"
                      role="list"
                    >
                      {managementState.filteredBindings.map((record) => (
                        <Card
                          key={record.id}
                          size="small"
                          role="listitem"
                          className="soha-application-long-card"
                          title={
                            <Space size={6} wrap>
                              <strong>{record.environmentKey || record.environmentId}</strong>
                              <StatusTag
                                value={summarizeBindingStatus(bindingSummaryById[record.id])}
                              />
                            </Space>
                          }
                          extra={
                            <Space className="soha-row-action-icons" size={2}>
                              <ManagementIconButton
                                aria-label="查看运行态"
                                icon={<ArrowRightOutlined />}
                                size="small"
                                tooltip="运行态"
                                onClick={() => setActiveTab('services', record.id)}
                              />
                              {managementState.canUpdateBinding ? (
                                <ManagementIconButton
                                  aria-label="编辑绑定"
                                  icon={<EditOutlined />}
                                  size="small"
                                  tooltip="编辑"
                                  onClick={() => openBindingEdit(record)}
                                />
                              ) : null}
                              {managementState.canDeleteBinding ? (
                                <Popconfirm
                                  title="确认删除绑定？"
                                  onConfirm={() =>
                                    managementState.deleteBindingMutation.mutate(record.id)
                                  }
                                  placement="topRight"
                                >
                                  <ManagementIconButton
                                    aria-label="删除绑定"
                                    danger
                                    icon={<DeleteOutlined />}
                                    size="small"
                                    tooltip="删除"
                                  />
                                </Popconfirm>
                              ) : null}
                            </Space>
                          }
                        >
                          <Descriptions
                            size="small"
                            column={{ xs: 1, sm: 2, lg: 4 }}
                            items={[
                              {
                                key: 'buildSource',
                                label: '构建来源',
                                children: record.buildPolicy?.sourceId || '-',
                              },
                              {
                                key: 'workflow',
                                label: '发布流程模板',
                                children:
                                  managementState.workflowTemplateMap[
                                    record.workflowTemplateId || ''
                                  ]?.name ||
                                  record.workflowTemplateId ||
                                  '-',
                              },
                              {
                                key: 'targets',
                                label: '发布目标',
                                children: renderBindingTargets(record.targets),
                              },
                              {
                                key: 'selector',
                                label: '资源选择器',
                                children: renderSelectorLabels(record.resourceSelector),
                              },
                              {
                                key: 'workflowHealth',
                                label: '模板健康',
                                children: renderEnvironmentBindingWorkflowHealth(
                                  record,
                                  bindingSummaryById[record.id],
                                  managementState.workflowTemplateMap,
                                ),
                              },
                            ]}
                          />
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <ManagementState
                      bordered={false}
                      compact
                      kind="not-configured"
                      description="尚未绑定交付环境"
                    />
                  )}
                </Card>
              ),
            },
            {
              key: 'permissions',
              label: '权限',
              children: (
                <div className="soha-application-runtime-settings-grid">
                  <Card className="soha-management-panel-card" title="应用与环境权限键">
                    <Descriptions
                      column={1}
                      items={[
                        {
                          key: 'app',
                          label: '应用',
                          children: `${runtime.application.name} / ${runtime.application.key}`,
                        },
                        {
                          key: 'scope',
                          label: '范围',
                          children:
                            bindings
                              .map((binding) => binding.environmentKey || binding.environmentId)
                              .filter(Boolean)
                              .join(', ') || 'default',
                        },
                        {
                          key: 'permissions',
                          label: '权限快照',
                          children: (
                            <Space wrap>
                              {permissionRows.map((item) => (
                                <StatusTag
                                  key={item.key}
                                  value={item.enabled ? 'success' : 'error'}
                                  label={`${item.label}: ${item.enabled ? '允许' : '缺失'}`}
                                />
                              ))}
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Card>
                  <DeliveryTable
                    title="环境授权上下文"
                    rowKey="applicationEnvironmentId"
                    pagination={false}
                    dataSource={bindings}
                    columns={[
                      {
                        title: '环境',
                        dataIndex: 'environmentId',
                        render: (_: string, record: DeliveryApplicationBindingSummary) =>
                          record.environmentName || record.environmentKey || record.environmentId,
                      },
                      { title: '绑定 ID', dataIndex: 'applicationEnvironmentId' },
                      {
                        title: '动作',
                        dataIndex: 'actionKind',
                        render: (value?: string) => value || 'deploy',
                      },
                      {
                        title: '审批',
                        dataIndex: 'requiresApproval',
                        render: (value: boolean) => (
                          <StatusTag
                            value={value ? 'warning' : 'default'}
                            label={value ? '需要' : '无需'}
                          />
                        ),
                      },
                      {
                        title: '发布目标',
                        dataIndex: 'targetCount',
                        render: (_: number, record: DeliveryApplicationBindingSummary) =>
                          record.targetCount || record.targets?.length || 0,
                      },
                      {
                        title: '工作流',
                        dataIndex: 'workflowTemplateName',
                        render: (_: string, record: DeliveryApplicationBindingSummary) =>
                          record.workflowTemplate?.name || record.workflowTemplateName || '-',
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'services',
              label: '服务',
              children: (
                <div className="soha-application-service-workspace">
                  <OverviewSectionBar
                    className="soha-application-service-environment-bar"
                    title="服务运行态"
                    description="选择环境查看该部署上下文中的 Workload"
                    extra={
                      managementState.canCreateBinding ? (
                        <Button type="primary" icon={<PlusOutlined />} onClick={openBindingCreate}>
                          新增环境
                        </Button>
                      ) : null
                    }
                  />
                  {environments.length > 0 ? (
                    <div
                      className="soha-application-service-environment-grid"
                      role="group"
                      aria-label="环境切换"
                    >
                      {environments.map((environment) => {
                        const binding = managementState.filteredBindings.find(
                          (item) => item.id === environment.applicationEnvironmentId,
                        )
                        const environmentWorkloads = environment.workloads ?? []
                        const environmentName =
                          environment.environmentName ||
                          environment.environmentKey ||
                          environment.environmentId
                        const alias = binding?.alias || environmentName
                        const clusterId =
                          binding?.clusterId ||
                          environmentWorkloads[0]?.clusterId ||
                          environment.targets?.[0]?.clusterId ||
                          '-'
                        const clusterName =
                          managementState.clustersQuery.data?.find((item) => item.id === clusterId)
                            ?.name || clusterId
                        const namespace =
                          binding?.namespace ||
                          environmentWorkloads[0]?.namespace ||
                          environment.targets?.[0]?.namespace ||
                          '-'
                        const unhealthyCount = environmentWorkloads.filter(
                          (item) => item.readyReplicas < item.desiredReplicas,
                        ).length
                        const runtimeUnavailable = environment.status === 'unavailable'
                        const statusTone = runtimeUnavailable
                          ? 'danger'
                          : environmentWorkloads.length
                            ? unhealthyCount
                              ? 'warning'
                              : 'success'
                            : 'empty'
                        const statusLabel = runtimeUnavailable
                          ? '集群不可用'
                          : environmentWorkloads.length
                            ? unhealthyCount
                              ? `${unhealthyCount} 个需关注`
                              : '运行正常'
                            : '尚未部署'
                        const active = environment.applicationEnvironmentId === activeEnvironmentId
                        return (
                          <button
                            key={environment.applicationEnvironmentId}
                            type="button"
                            aria-pressed={active}
                            className={`soha-application-service-environment-option is-${statusTone}${active ? ' is-active' : ''}`}
                            onClick={() =>
                              setActiveEnvironmentId(environment.applicationEnvironmentId)
                            }
                          >
                            <span className="soha-application-service-environment-option__head">
                              <span className="soha-application-service-environment-option__identity">
                                <span
                                  aria-hidden="true"
                                  className="soha-application-service-environment-option__status"
                                />
                                <span>
                                  <strong>{alias}</strong>
                                  <small>{environmentName}</small>
                                </span>
                              </span>
                              <span className="soha-application-service-environment-option__count">
                                <strong>{environmentWorkloads.length}</strong>
                                <small>Workload</small>
                              </span>
                            </span>
                            <span className="soha-application-service-environment-option__meta">
                              <span>{clusterName}</span>
                              <span>{namespace}</span>
                              <span>{statusLabel}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <ManagementState
                      bordered={false}
                      compact
                      kind="empty"
                      description="暂无环境，请先新增环境"
                    />
                  )}
                  {runtimeWorkloads.length > 0 ? (
                    <div className="soha-overview-chip-grid soha-application-service-workload-summary">
                      <OverviewChip
                        label="运行正常"
                        value={runtimeStatusCounts.success}
                        helper="副本全部就绪"
                        tone="success"
                      />
                      <OverviewChip
                        label="部分就绪"
                        value={runtimeStatusCounts.warning}
                        helper="需要关注"
                        tone="warning"
                      />
                      <OverviewChip
                        label="运行异常"
                        value={runtimeStatusCounts.danger}
                        helper="副本不可用"
                        tone="danger"
                      />
                      <OverviewChip
                        label="待运行 / 未知"
                        value={runtimeStatusCounts.default}
                        helper="暂无明确状态"
                      />
                    </div>
                  ) : null}
                  {runtimeWorkloads.length > 0 || services.length > 0 ? (
                    <div
                      className="soha-application-long-card-list soha-application-service-workload-list"
                      role="list"
                    >
                      {runtimeWorkloads.map((workload) => {
                        const service = services.find(
                          (item) =>
                            item.id === workload.serviceId || item.key === workload.serviceKey,
                        )
                        const environmentName =
                          activeEnvironment?.environmentName ||
                          activeEnvironment?.environmentKey ||
                          activeEnvironment?.environmentId ||
                          '-'
                        const runtimeStatus = workloadRuntimeStatus(workload)
                        return (
                          <Card
                            key={`${workload.applicationEnvironmentId}/${workload.workloadKind}/${workload.workloadName}`}
                            size="small"
                            role="listitem"
                            className={`soha-application-long-card is-${runtimeStatus.tone}`}
                            title={
                              <Space size={6} wrap>
                                <Text strong>{workload.workloadName}</Text>
                                <MetadataTag label={workload.workloadKind} />
                              </Space>
                            }
                            extra={
                              <Space size={4}>
                                <StatusTag
                                  value={runtimeStatus.value}
                                  label={runtimeStatus.label}
                                />
                                {service ? (
                                  <ManagementIconButton
                                    aria-label="查看服务详情"
                                    icon={<LinkOutlined />}
                                    size="small"
                                    tooltip="服务详情"
                                    onClick={() => setFocusedService(service.id)}
                                  />
                                ) : null}
                                <ManagementIconButton
                                  aria-label={`查看 ${workload.workloadName} Pods`}
                                  icon={<ArrowRightOutlined />}
                                  size="small"
                                  tooltip="查看 Pods"
                                  onClick={() =>
                                    navigate(
                                      `/applications/${runtime.application.id}/application-environments/${workload.applicationEnvironmentId}/workloads/${encodeURIComponent(workload.workloadName)}?tab=pods`,
                                    )
                                  }
                                />
                              </Space>
                            }
                          >
                            <Descriptions
                              size="small"
                              column={{ xs: 1, sm: 2, lg: 5 }}
                              items={[
                                {
                                  key: 'service',
                                  label: '服务',
                                  children: service?.name || workload.serviceKey || '-',
                                },
                                {
                                  key: 'environment',
                                  label: '环境',
                                  children: environmentName,
                                },
                                {
                                  key: 'namespace',
                                  label: 'Namespace',
                                  children: workload.namespace,
                                },
                                {
                                  key: 'replicas',
                                  label: 'Pod 就绪',
                                  children: (
                                    <Text
                                      strong
                                      className="soha-application-service-workload-ready"
                                    >
                                      {`${workload.readyReplicas}/${workload.desiredReplicas}`}
                                    </Text>
                                  ),
                                },
                                {
                                  key: 'cluster',
                                  label: '集群',
                                  children: workload.clusterId,
                                },
                              ]}
                            />
                          </Card>
                        )
                      })}
                      {services
                        .filter(
                          (service) =>
                            !runtimeWorkloadForService(runtime, service, activeEnvironmentId),
                        )
                        .map((service) => (
                          <Card
                            key={service.id}
                            size="small"
                            role="listitem"
                            className="soha-application-long-card"
                            title={
                              <Space size={6} wrap>
                                <Text strong>{service.name}</Text>
                                <MetadataTag label={serviceKindLabel(service.serviceKind)} />
                                <StatusTag value="warning" label="未绑定 Workload" />
                              </Space>
                            }
                            extra={
                              <ManagementIconButton
                                aria-label="查看服务详情"
                                icon={<ArrowRightOutlined />}
                                size="small"
                                tooltip="服务详情"
                                onClick={() => setFocusedService(service.id)}
                              />
                            }
                          >
                            <Descriptions
                              size="small"
                              column={{ xs: 1, sm: 2, lg: 4 }}
                              items={[
                                { key: 'key', label: '服务 Key', children: service.key },
                                {
                                  key: 'repository',
                                  label: '仓库',
                                  children: service.repositoryPath || '未配置',
                                },
                                {
                                  key: 'owner',
                                  label: '团队',
                                  children: service.ownerTeam || '-',
                                },
                                {
                                  key: 'status',
                                  label: '状态',
                                  children: (
                                    <StatusTag value={service.enabled ? 'enabled' : 'disabled'} />
                                  ),
                                },
                              ]}
                            />
                          </Card>
                        ))}
                    </div>
                  ) : (
                    <ManagementState
                      bordered={false}
                      compact
                      description={
                        activeEnvironment?.status === 'unavailable'
                          ? '集群不可用，暂时无法读取 Workload。'
                          : '尚未配置服务 Workload。先接入服务与环境，再运行工作流。'
                      }
                      kind={
                        activeEnvironment?.status === 'unavailable' ? 'error' : 'not-configured'
                      }
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'environments',
              label: '环境矩阵',
              children: (
                <div className="soha-application-runtime-environment-stack">
                  <Card className="soha-management-panel-card">
                    <Space wrap>
                      {environments.map((item) => (
                        <Button
                          key={item.applicationEnvironmentId}
                          size="small"
                          type={
                            activeEnvironmentId === item.applicationEnvironmentId
                              ? 'primary'
                              : 'default'
                          }
                          onClick={() => setActiveEnvironmentId(item.applicationEnvironmentId)}
                        >
                          {item.environmentName || item.environmentKey || item.environmentId}
                        </Button>
                      ))}
                    </Space>
                  </Card>
                  <div className="soha-application-runtime-grid">
                    {workloads.length > 0 ? (
                      workloads.map((workload) => (
                        <Card
                          key={`${workload.clusterId}/${workload.namespace}/${workload.workloadName}`}
                          hoverable
                          className="soha-application-runtime-card"
                          onClick={() =>
                            navigate(
                              `/applications/${runtime.application.id}/application-environments/${workload.applicationEnvironmentId}/workloads/${encodeURIComponent(workload.workloadName)}`,
                            )
                          }
                          actions={[
                            <Button
                              key="open"
                              type="link"
                              icon={<ArrowRightOutlined />}
                              onClick={(event) => {
                                event.stopPropagation()
                                navigate(
                                  `/applications/${runtime.application.id}/application-environments/${workload.applicationEnvironmentId}/workloads/${encodeURIComponent(workload.workloadName)}`,
                                )
                              }}
                            >
                              进入详情
                            </Button>,
                          ]}
                        >
                          <Space orientation="vertical" style={{ width: '100%' }}>
                            <div className="soha-application-runtime-card__head">
                              <strong>{workload.workloadName}</strong>
                              <StatusTag value={summarizeStatus(workload)} />
                            </div>
                            <Text type="secondary">{`${workload.workloadKind} · ${workload.namespace}`}</Text>
                            <Space wrap>
                              <MetadataTag label={`期望 ${workload.desiredReplicas}`} />
                              <MetadataTag label={`就绪 ${workload.readyReplicas}`} />
                              <MetadataTag label={workload.clusterId} />
                            </Space>
                          </Space>
                        </Card>
                      ))
                    ) : (
                      <ManagementState
                        className="soha-application-runtime-empty"
                        bordered={false}
                        compact
                        description={
                          activeEnvironment?.status === 'unavailable'
                            ? '集群不可用，暂时无法读取服务/Deployment'
                            : '当前环境下没有可显示的服务/Deployment'
                        }
                        kind={activeEnvironment?.status === 'unavailable' ? 'error' : 'empty'}
                      />
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'delivery',
              label: '运行工作流',
              children: (
                <Modal
                  title="运行工作流"
                  open={deliveryActionModalVisible}
                  width={960}
                  forceRender
                  footer={null}
                  onCancel={() => setDeliveryActionModalVisible(false)}
                >
                  <Form
                    form={deliveryForm}
                    layout="vertical"
                    size="middle"
                    className="soha-application-delivery-actions__form"
                  >
                    <div className="soha-application-delivery-actions__grid">
                      <Form.Item
                        name="applicationEnvironmentId"
                        label="环境"
                        rules={[{ required: true, message: '请选择环境' }]}
                      >
                        <Select
                          options={configuredWorkflowBindings.map((binding) => ({
                            value: binding.applicationEnvironmentId,
                            label:
                              binding.environmentName ||
                              binding.environmentKey ||
                              binding.environmentId,
                          }))}
                          onChange={populateDeliveryBinding}
                        />
                      </Form.Item>
                      <Form.Item name="targetId" label="服务 / Workload">
                        <Select
                          allowClear
                          placeholder="选择服务或 Workload"
                          options={(selectedDeliveryBinding?.targets ?? []).map((target) => {
                            const workload = environments
                              .find(
                                (environment) =>
                                  environment.applicationEnvironmentId ===
                                  selectedDeliveryBinding.applicationEnvironmentId,
                              )
                              ?.workloads?.find(
                                (item) =>
                                  item.workloadName === target.workloadName &&
                                  item.namespace === target.namespace,
                              )
                            const service = services.find(
                              (item) =>
                                item.id === workload?.serviceId ||
                                item.key === workload?.serviceKey,
                            )
                            return {
                              value: target.id,
                              disabled: !target.enabled,
                              label: deliveryTargetSummary(target, service?.name),
                            }
                          })}
                        />
                      </Form.Item>
                      <Form.Item name="buildSourceId" label="构建定义">
                        <Select
                          allowClear
                          options={serviceBuildSourceOptions}
                          onChange={(sourceId) => {
                            const source = runtime.application.buildSources?.find(
                              (item) => item.id === sourceId,
                            )
                            const repositoryRefs = buildRepositoryRefs(source, repositories)
                            const primaryRepositoryRef = repositoryRefs[0]
                            deliveryForm.setFieldsValue({
                              repositoryRefs,
                              refType: primaryRepositoryRef?.refType ?? 'branch',
                              refName: primaryRepositoryRef?.refName ?? 'main',
                              imageTag: source?.defaultTag || runtime.application.defaultTag,
                            })
                          }}
                        />
                      </Form.Item>
                      {selectedBuildRepositoryBindings.length > 0 ? (
                        <div className="soha-application-delivery-repository-refs">
                          <div className="soha-application-delivery-repository-refs__head">
                            <Text strong>运行版本</Text>
                            <Text type="secondary">
                              {`${selectedBuildRepositoryBindings.length} 个源码仓库`}
                            </Text>
                          </div>
                          {selectedBuildRepositoryBindings.map((binding, index) => (
                            <RepositoryRefField
                              key={binding.repositoryId}
                              form={deliveryForm}
                              index={index}
                              binding={binding}
                              repository={repositories.find(
                                (item) => item.id === binding.repositoryId,
                              )}
                            />
                          ))}
                        </div>
                      ) : (
                        <>
                          <Form.Item name="refType" label="版本类型">
                            <Select options={REF_TYPE_OPTIONS} />
                          </Form.Item>
                          <Form.Item name="refName" label="分支 / Tag / Commit">
                            <Input placeholder="main" />
                          </Form.Item>
                        </>
                      )}
                      <Form.Item name="imageTag" label="镜像 Tag">
                        <Input
                          placeholder={
                            selectedBuildSource?.defaultTag ||
                            runtime.application.defaultTag ||
                            '必填'
                          }
                        />
                      </Form.Item>
                      <Form.Item name="releaseName" label="发布名称">
                        <Input
                          placeholder={
                            effectiveImageTag ||
                            selectedDeliveryBinding?.applicationEnvironmentId ||
                            'release'
                          }
                        />
                      </Form.Item>
                      <Form.Item name="containerName" label="容器">
                        <Input placeholder={selectedDeliveryTarget?.containerName || '默认容器'} />
                      </Form.Item>
                    </div>
                    <div className="soha-application-delivery-actions__footer">
                      <div className="soha-application-delivery-actions__summary">
                        {deliveryTargetCapabilityReason ? (
                          <Alert
                            showIcon
                            type="warning"
                            title="当前目标集群限制交付写入"
                            description={deliveryTargetCapabilityReason}
                          />
                        ) : null}
                        <Space wrap>
                          <MetadataTag
                            label={
                              selectedDeliveryBinding?.workflowTemplateName ||
                              selectedDeliveryBinding?.workflowTemplate?.name ||
                              '未绑定工作流'
                            }
                          />
                          <MetadataTag
                            label={`${selectedDeliveryBinding?.targetCount ?? 0} 个 Workload 目标`}
                          />
                          <MetadataTag label={`${validationNodeCount} 个测试节点`} />
                          {effectiveImageTag ? (
                            <MetadataTag label={`镜像 Tag ${effectiveImageTag}`} />
                          ) : (
                            <StatusTag value="warning" label="缺少镜像 Tag" />
                          )}
                        </Space>
                      </div>
                      <Space>
                        <Button onClick={() => setDeliveryActionModalVisible(false)}>取消</Button>
                        <Tooltip title={buildDeployDisabledReason || '按工作流模板执行'}>
                          <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            disabled={!!buildDeployDisabledReason}
                            loading={deliveryActionPending}
                            onClick={() => void triggerDeliveryAction('build_deploy')}
                          >
                            运行工作流
                          </Button>
                        </Tooltip>
                      </Space>
                    </div>
                  </Form>
                </Modal>
              ),
            },
            {
              key: 'pipeline',
              label: '工作流',
              children: (
                <div className="soha-application-runtime-pipeline-grid">
                  <div className="soha-application-workflow-list">
                    <OverviewSectionBar
                      title="工作流"
                      description={`${configuredWorkflowBindings.length} 个已创建工作流`}
                      extra={
                        canUpdateApplicationEnvironment ? (
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={openWorkflowCreate}
                          >
                            创建工作流
                          </Button>
                        ) : null
                      }
                    />
                    {configuredWorkflowBindings.length > 0 ? (
                      <div className="soha-application-long-card-list" role="list">
                        {configuredWorkflowBindings.map((binding) => (
                          <div
                            className="soha-application-runtime-binding-row soha-application-runtime-binding-row--stacked"
                            key={binding.applicationEnvironmentId}
                            role="listitem"
                          >
                            <div className="soha-application-runtime-binding-row__head">
                              <div className="soha-application-runtime-binding-row__main">
                                <strong>
                                  {binding.workflowTemplate?.name ||
                                    binding.workflowTemplateName ||
                                    binding.workflowTemplateId}
                                </strong>
                                <Text type="secondary">
                                  {`${binding.environmentName || binding.environmentKey || binding.environmentId} · ${binding.workflowTemplate?.key || binding.workflowTemplateId}`}
                                </Text>
                              </div>
                              <Space wrap>
                                <StatusTag
                                  value={binding.latestWorkflow?.status || 'default'}
                                  label={binding.latestWorkflow ? undefined : '未运行'}
                                />
                                <Button
                                  type="primary"
                                  icon={<PlayCircleOutlined />}
                                  disabled={
                                    !binding.workflowTemplate ||
                                    !canTriggerBuild ||
                                    !canTriggerWorkflow
                                  }
                                  onClick={() => {
                                    populateDeliveryBinding(binding.applicationEnvironmentId)
                                    setDeliveryActionModalVisible(true)
                                  }}
                                >
                                  运行
                                </Button>
                                {canUpdateApplicationEnvironment ? (
                                  <Button
                                    icon={<LinkOutlined />}
                                    onClick={() => openWorkflowDesigner(binding)}
                                  >
                                    设计
                                  </Button>
                                ) : null}
                              </Space>
                            </div>
                            {renderWorkflowTemplatePreview(binding.workflowTemplate)}
                            {renderWorkflowTemplateHealth(binding)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ManagementState
                        bordered={false}
                        kind="not-configured"
                        title="还没有工作流"
                        description="从预设模板开始，或在 DAG 画布中创建工作流。"
                        actions={
                          canUpdateApplicationEnvironment ? (
                            <Button onClick={openWorkflowCreate}>创建工作流</Button>
                          ) : undefined
                        }
                      />
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'verification',
              label: '测试',
              children: (
                <div className="soha-application-runtime-verification-grid">
                  <Card className="soha-management-panel-card" title="测试门禁">
                    <Descriptions
                      column={1}
                      items={[
                        {
                          key: 'workflowTemplate',
                          label: 'Workflow Template',
                          children:
                            selectedDeliveryBinding?.workflowTemplate?.name ||
                            selectedDeliveryBinding?.workflowTemplateName ||
                            '-',
                        },
                        {
                          key: 'workflowNodes',
                          label: 'DAG 节点数',
                          children: selectedWorkflowAnalysis?.nodeCount ?? 0,
                        },
                        {
                          key: 'validationNodes',
                          label: '测试节点数',
                          children: selectedWorkflowValidationNodes.length,
                        },
                        {
                          key: 'approval',
                          label: '审批要求',
                          children: selectedDeliveryBinding?.requiresApproval
                            ? '需要审批'
                            : '无需审批',
                        },
                        {
                          key: 'releaseTarget',
                          label: '当前目标',
                          children: deliveryTargetSummary(selectedDeliveryTarget),
                        },
                      ]}
                    />
                  </Card>
                  <Card className="soha-management-panel-card" title="DAG 测试节点">
                    <Space orientation="vertical" style={{ width: '100%' }} size={10}>
                      <Alert
                        showIcon
                        type={selectedWorkflowValidationNodes.length > 0 ? 'success' : 'warning'}
                        title={
                          selectedWorkflowValidationNodes.length > 0
                            ? '测试动作会执行下列节点'
                            : '当前模板没有可执行的测试节点'
                        }
                      />
                      {selectedWorkflowValidationNodes.length > 0 ? (
                        selectedWorkflowValidationNodes.map((node) => (
                          <div className="soha-application-runtime-validation-node" key={node.id}>
                            <span>
                              <strong>{node.name}</strong>
                              <Text type="secondary">{releaseDagNodeLabel(node.type)}</Text>
                            </span>
                            <MetadataTag label={`${node.timeoutSeconds ?? 300}s`} />
                          </div>
                        ))
                      ) : (
                        <ManagementState
                          bordered={false}
                          compact
                          kind="not-configured"
                          description="支持 check_http、check_k8s_event、smoke_test、verify、check 类型节点。"
                        />
                      )}
                    </Space>
                  </Card>
                  <Card className="soha-management-panel-card" title="测试入口">
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <Button
                        type="primary"
                        onClick={() => setActiveTab('application')}
                        disabled={!bindings[0]?.applicationEnvironmentId}
                      >
                        查看绑定配置
                      </Button>
                      <Button
                        disabled={!selectedDeliveryBinding}
                        onClick={() =>
                          selectedDeliveryBinding && openWorkflowDesigner(selectedDeliveryBinding)
                        }
                      >
                        查看工作流设计
                      </Button>
                      <Button onClick={() => navigate('/delivery/release-bundles')}>
                        查看交付物中心
                      </Button>
                    </Space>
                  </Card>
                </div>
              ),
            },
            {
              key: 'capabilities',
              label: 'AI/MCP',
              children: (
                <div className="soha-application-runtime-verification-grid">
                  <Card className="soha-management-panel-card" title="能力就绪">
                    <Descriptions
                      column={1}
                      items={[
                        {
                          key: 'deliveryActions',
                          label: 'Delivery Actions',
                          children: <StatusTag value={deliveryActionsCapability.status} />,
                        },
                        {
                          key: 'reason',
                          label: '限制',
                          children: deliveryTargetCapabilityReason || '-',
                        },
                        {
                          key: 'capabilities',
                          label: '声明数量',
                          children: workflowCapabilityRows.length,
                        },
                        {
                          key: 'artifacts',
                          label: '交付物类型',
                          children:
                            [
                              ...new Set(
                                workflowCapabilityRows.flatMap((item) => item.artifactKinds ?? []),
                              ),
                            ].join(', ') || '-',
                        },
                      ]}
                    />
                  </Card>
                  <Card className="soha-management-panel-card" title="Workflow Capability Refs">
                    {workflowCapabilityRows.length > 0 ? (
                      <DeliveryTable
                        rowKey="id"
                        pagination={false}
                        dataSource={workflowCapabilityRows}
                        columns={[
                          { title: '环境', dataIndex: 'environment' },
                          { title: '节点', dataIndex: 'nodeName' },
                          {
                            title: '类型',
                            dataIndex: 'nodeType',
                            render: (value: string) =>
                              releaseDagNodeLabel(
                                value as Parameters<typeof releaseDagNodeLabel>[0],
                              ),
                          },
                          {
                            title: 'Executor',
                            dataIndex: 'executorKind',
                            render: (value?: string) => value || '-',
                          },
                          {
                            title: 'Target',
                            dataIndex: 'targetKind',
                            render: (value?: string) => value || '-',
                          },
                          {
                            title: 'Capability',
                            dataIndex: 'capabilityRef',
                            render: (value?: string) => value || '-',
                          },
                          {
                            title: 'Provider',
                            dataIndex: 'providerRef',
                            render: (value?: string) => value || '-',
                          },
                        ]}
                      />
                    ) : (
                      <ManagementState
                        bordered={false}
                        compact
                        kind="not-configured"
                        description="当前工作流模板尚未声明 capabilityRef / providerRef / executorKind。"
                      />
                    )}
                  </Card>
                  <Alert
                    showIcon
                    type="info"
                    title="外部 AI 测试平台尚未接入"
                    description="当前阶段只保存和展示 DAG 能力引用，真实 provider 由 ExecutionTask callback 与后续 MCP adapter 对接。"
                  />
                </div>
              ),
            },
          ]
          const tab = (key: string) => existingTabs.find((item) => item.key === key)!
          return [
            {
              key: 'overview',
              label: APPLICATION_WORKSPACE_LABELS.overview,
              children: applicationOverviewWorkspace,
            },
            {
              key: 'delivery',
              label: APPLICATION_WORKSPACE_LABELS.delivery,
              children: (
                <div className="soha-application-workflow-workspace">
                  {tab('delivery').children}
                  {tab('pipeline').children}
                </div>
              ),
            },
            { ...tab('services'), label: APPLICATION_WORKSPACE_LABELS.services },
            { ...tab('verification'), label: APPLICATION_WORKSPACE_LABELS.verification },
            {
              key: 'resources',
              label: APPLICATION_WORKSPACE_LABELS.resources,
              children: (
                <ManifestLibraryWorkspace applicationId={applicationId ?? ''} services={services} />
              ),
            },
            {
              ...tab('settings'),
              key: 'application',
              label: APPLICATION_WORKSPACE_LABELS.application,
              children: (
                <div className="soha-application-service-config-workspace">
                  {tab('settings').children}
                  {tab('environment-bindings').children}
                </div>
              ),
            },
            { ...tab('permissions'), label: APPLICATION_WORKSPACE_LABELS.permissions },
            { ...tab('capabilities'), label: APPLICATION_WORKSPACE_LABELS.capabilities },
          ]
        })()}
      />
      <Drawer
        open={Boolean(focusedService)}
        title={focusedService?.name}
        size={1040}
        destroyOnHidden
        onClose={() => setFocusedService()}
        extra={
          focusedService ? (
            <Space>
              {canDeleteService ? (
                <Popconfirm
                  title="确认删除该服务组件？"
                  onConfirm={() => {
                    setFocusedService()
                    deleteServiceMutation.mutate({
                      applicationId: applicationId ?? '',
                      serviceId: focusedService.id,
                    })
                  }}
                >
                  <Button danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              ) : null}
              {canUpdateService ? (
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    setFocusedService()
                    openServiceModal(focusedService)
                  }}
                >
                  编辑服务
                </Button>
              ) : null}
            </Space>
          ) : null
        }
      >
        {focusedService ? (
          <Tabs
            className="soha-resource-tabs"
            items={[
              {
                key: 'basic',
                label: '基本信息',
                children: (
                  <Descriptions
                    bordered
                    column={2}
                    items={[
                      { key: 'key', label: '服务 Key', children: focusedService.key },
                      {
                        key: 'kind',
                        label: '交付模型',
                        children: (
                          <Space size={6} wrap>
                            <MetadataTag label={serviceKindLabel(focusedService.serviceKind)} />
                            <Text type="secondary">
                              {serviceKindDescription(focusedService.serviceKind)}
                            </Text>
                          </Space>
                        ),
                      },
                      {
                        key: 'owner',
                        label: '负责人团队',
                        children: focusedService.ownerTeam || '-',
                      },
                      {
                        key: 'status',
                        label: '状态',
                        children: (
                          <StatusTag value={focusedService.enabled ? 'enabled' : 'disabled'} />
                        ),
                      },
                      {
                        key: 'repository',
                        label: '代码仓库',
                        children: focusedService.repositoryPath || '-',
                      },
                      {
                        key: 'branch',
                        label: '默认分支',
                        children: focusedService.defaultBranch || '-',
                      },
                      {
                        key: 'description',
                        label: '描述',
                        span: 2,
                        children: focusedService.description || '-',
                      },
                    ]}
                  />
                ),
              },
              {
                key: 'build',
                label: '构建',
                children: (
                  <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                    <Card className="soha-management-panel-card" title="构建来源">
                      <Descriptions
                        column={2}
                        items={[
                          {
                            key: 'source',
                            label: '来源',
                            children: focusedServiceBuildSource
                              ? summarizeBuildSource(focusedServiceBuildSource)
                              : focusedService.buildSourceId || '未配置',
                          },
                          {
                            key: 'repository',
                            label: '服务仓库',
                            children: focusedService.repositoryPath || '-',
                          },
                          {
                            key: 'branch',
                            label: '默认分支',
                            children: focusedService.defaultBranch || '-',
                          },
                        ]}
                      />
                    </Card>
                    <DeliveryTable
                      title="容器"
                      pagination={false}
                      rowKey={(container: ApplicationServiceContainer) =>
                        container.id || container.name
                      }
                      dataSource={focusedService.containers ?? []}
                      columns={[
                        { title: '容器', dataIndex: 'name' },
                        {
                          title: '镜像仓库',
                          dataIndex: 'imageRepository',
                          render: (value?: string) => value || '-',
                        },
                        {
                          title: 'Dockerfile',
                          dataIndex: 'dockerfilePath',
                          render: (value?: string) => value || 'Dockerfile',
                        },
                        {
                          title: '构建上下文',
                          dataIndex: 'buildContextDir',
                          render: (value?: string) => value || '.',
                        },
                        {
                          title: '端口',
                          dataIndex: 'runtimePorts',
                          render: (value?: number[]) => value?.join(', ') || '-',
                        },
                      ]}
                    />
                  </Space>
                ),
              },
              {
                key: 'deploy',
                label: '部署',
                children: (
                  <DeliveryTable
                    title="环境运行目标"
                    pagination={false}
                    rowKey={(workload: ApplicationRuntimeWorkload) =>
                      `${workload.applicationEnvironmentId}/${workload.workloadName}`
                    }
                    dataSource={focusedServiceWorkloads}
                    columns={[
                      { title: '环境', dataIndex: 'environmentName' },
                      { title: 'Workload', dataIndex: 'workloadName' },
                      { title: '类型', dataIndex: 'workloadKind' },
                      {
                        title: '目标',
                        key: 'target',
                        render: (_: unknown, workload: ApplicationRuntimeWorkload) =>
                          `${workload.clusterId} / ${workload.namespace}`,
                      },
                      {
                        title: '副本',
                        key: 'replicas',
                        render: (_: unknown, workload: ApplicationRuntimeWorkload) =>
                          `${workload.readyReplicas}/${workload.desiredReplicas}`,
                      },
                      {
                        title: '状态',
                        key: 'status',
                        render: (_: unknown, workload: ApplicationRuntimeWorkload) => (
                          <StatusTag value={workload.healthStatus || summarizeStatus(workload)} />
                        ),
                      },
                      {
                        title: '操作',
                        key: 'actions',
                        render: (_: unknown, workload: ApplicationRuntimeWorkload) => (
                          <ManagementIconButton
                            aria-label="查看服务运行态"
                            icon={<ArrowRightOutlined />}
                            size="small"
                            tooltip="运行态"
                            onClick={() =>
                              navigate(
                                `/applications/${runtime.application.id}/application-environments/${workload.applicationEnvironmentId}/workloads/${encodeURIComponent(workload.workloadName)}`,
                              )
                            }
                          />
                        ),
                      },
                    ]}
                  />
                ),
              },
              {
                key: 'resources',
                label: '扩展资源',
                children: (
                  <ManifestLibraryWorkspace
                    applicationId={applicationId ?? ''}
                    serviceId={focusedService.id}
                    services={services}
                  />
                ),
              },
            ]}
          />
        ) : null}
      </Drawer>
      <Drawer
        className="soha-application-service-editor-drawer"
        title={editingService ? '编辑服务组件' : '新建服务组件'}
        open={serviceModalVisible}
        onClose={() => {
          setServiceModalVisible(false)
          setEditingService(null)
          serviceForm.resetFields()
        }}
        footer={
          <div className="soha-form-actions soha-application-service-editor-footer">
            <Button
              onClick={() => {
                setServiceModalVisible(false)
                setEditingService(null)
                serviceForm.resetFields()
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              loading={createServiceMutation.isPending || updateServiceMutation.isPending}
              onClick={() => serviceForm.submit()}
            >
              保存
            </Button>
          </div>
        }
        destroyOnHidden
        size={880}
      >
        <Form
          form={serviceForm}
          layout="vertical"
          initialValues={serviceInitialValues(editingService)}
          onFinish={(values) => {
            if (editingService) {
              updateServiceMutation.mutate({
                applicationId: applicationId ?? '',
                serviceId: editingService.id,
                payload: mapServicePayload(values),
              })
            } else {
              createServiceMutation.mutate({
                applicationId: applicationId ?? '',
                payload: mapServicePayload(values),
              })
            }
          }}
        >
          <div className="soha-application-service-editor">
            <section className="soha-application-service-editor-section">
              <div className="soha-application-service-editor-section__head">
                <Text strong>基础信息</Text>
                <Text type="secondary">定义服务单元及交付类型</Text>
              </div>
              <div className="soha-application-service-form-grid">
                <Form.Item
                  name="key"
                  label="服务 Key"
                  rules={[{ required: true, message: '请输入服务 Key' }]}
                >
                  <Input placeholder="api" />
                </Form.Item>
                <Form.Item
                  name="name"
                  label="服务名称"
                  rules={[{ required: true, message: '请输入服务名称' }]}
                >
                  <Input placeholder="API 服务" />
                </Form.Item>
                <Form.Item name="serviceKind" label="服务类型">
                  <Select options={SERVICE_KIND_OPTIONS} />
                </Form.Item>
                <Form.Item name="ownerTeam" label="负责人团队">
                  <Input />
                </Form.Item>
                <Form.Item name="enabled" label="启用" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </div>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={2} />
              </Form.Item>
            </section>

            <section className="soha-application-service-editor-section">
              <div className="soha-application-service-editor-section__head">
                <span className="soha-application-service-editor-section__identity">
                  <Text strong>构建定义</Text>
                  <Text type="secondary">源码仓库、构建步骤与产物推送</Text>
                </span>
                {canManageRepositories ? (
                  <Space>
                    {selectedServiceBuildSource ? (
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => openBuildSourceModal(selectedServiceBuildSource)}
                      >
                        编辑构建
                      </Button>
                    ) : null}
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => openBuildSourceModal()}
                    >
                      添加构建
                    </Button>
                  </Space>
                ) : null}
              </div>
              <Form.Item name="repositoryId" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="repositoryPath" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="defaultBranch" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="buildSourceId" label="构建来源">
                <Select
                  allowClear
                  options={serviceBuildSourceOptions}
                  onChange={(sourceId) => {
                    const source = runtime?.application.buildSources?.find(
                      (item) => item.id === sourceId,
                    )
                    const primaryBinding = buildRepositoryBindings(source)[0]
                    const repository = repositories.find(
                      (item) => item.id === primaryBinding?.repositoryId,
                    )
                    serviceForm.setFieldsValue({
                      repositoryId: repository?.id,
                      repositoryPath: repository?.path,
                      defaultBranch: primaryBinding?.defaultBranch || repository?.defaultBranch,
                    })
                  }}
                />
              </Form.Item>
              <div className="soha-application-service-editor-summary">
                <Text strong>源码仓库</Text>
                <div className="soha-application-build-repository-list">
                  {selectedServiceBuildRepositoryBindings.length > 0 ? (
                    selectedServiceBuildRepositoryBindings.map((binding, index) => {
                      const repository = repositories.find(
                        (item) => item.id === binding.repositoryId,
                      )
                      return (
                        <div
                          key={binding.repositoryId}
                          className="soha-application-build-repository-row"
                        >
                          <span className="soha-application-service-editor-section__identity">
                            <Text strong>{repository?.name || binding.repositoryId}</Text>
                            <Text type="secondary">{repository?.path || '仓库目录未同步'}</Text>
                          </span>
                          <Space wrap>
                            <MetadataTag
                              label={
                                binding.checkoutPath ||
                                (index === 0 ? '检出到工作区根目录' : `repository-${index + 1}`)
                              }
                            />
                            <MetadataTag
                              label={binding.defaultBranch || repository?.defaultBranch || 'main'}
                            />
                            {binding.allowCommitSelection ? (
                              <MetadataTag label="可选 Commit" />
                            ) : null}
                            {binding.submodules ? <MetadataTag label="Submodule" /> : null}
                          </Space>
                        </div>
                      )
                    })
                  ) : selectedServiceRepository ? (
                    <div className="soha-application-build-repository-row">
                      <span className="soha-application-service-editor-section__identity">
                        <Text strong>{selectedServiceRepository.name}</Text>
                        <Text type="secondary">{selectedServiceRepository.path}</Text>
                      </span>
                      <MetadataTag label={selectedServiceRepository.defaultBranch} />
                    </div>
                  ) : (
                    <Text type="secondary">选择构建来源后显示仓库检出规则。</Text>
                  )}
                </div>
              </div>
              <div className="soha-application-service-build-steps">
                <Text strong>构建步骤</Text>
                {selectedServiceBuildSource?.type === 'platform_build_template' ? (
                  buildTemplatesQuery.isFetching ? (
                    <Text type="secondary">正在读取构建模板…</Text>
                  ) : selectedServiceBuildTemplate?.buildCommands?.length ? (
                    <ol>
                      {selectedServiceBuildTemplate.buildCommands.map((command) => (
                        <li key={command}>
                          <code>{command}</code>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Text type="secondary">当前模板暂无 Shell 命令。</Text>
                  )
                ) : selectedServiceBuildSource?.type === 'repo_dockerfile' ? (
                  <ol>
                    <li>读取仓库与容器 Dockerfile</li>
                    <li>
                      {typeof selectedServiceBuildSource.config?.builderKind === 'string'
                        ? selectedServiceBuildSource.config.builderKind
                        : 'Docker'}{' '}
                      执行镜像构建
                    </li>
                    <li>推送产物镜像</li>
                  </ol>
                ) : selectedServiceBuildSource?.type === 'external_pipeline' ? (
                  <Text>
                    触发外部流水线：
                    {typeof selectedServiceBuildSource.config?.pipelineRef === 'string'
                      ? selectedServiceBuildSource.config.pipelineRef
                      : '-'}
                  </Text>
                ) : (
                  <Text type="secondary">选择构建来源后显示 Docker、Shell 或流水线步骤。</Text>
                )}
              </div>
            </section>

            <section className="soha-application-service-editor-section">
              <Form.List name="containers">
                {(fields, { add, remove }) => (
                  <div className="soha-application-service-containers-editor">
                    <div className="soha-application-service-containers-editor__head">
                      <span>
                        <Text strong>产物容器</Text>
                        <Text type="secondary"> · 定义镜像、构建文件和运行端口</Text>
                      </span>
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => add({ name: 'main' })}
                      >
                        添加容器
                      </Button>
                    </div>
                    {fields.map((field) => (
                      <Card
                        key={field.key}
                        size="small"
                        className="soha-application-service-container-editor"
                      >
                        <div className="soha-application-service-container-editor__grid">
                          <Form.Item
                            name={[field.name, 'name']}
                            label="容器名"
                            rules={[{ required: true, message: '请输入容器名' }]}
                          >
                            <Input placeholder="main" />
                          </Form.Item>
                          <Form.Item name={[field.name, 'imageRepository']} label="产物镜像仓库">
                            <Input placeholder="registry.example.com/team/api" />
                          </Form.Item>
                          <Form.Item name={[field.name, 'defaultTagTemplate']} label="Tag 模板">
                            <Input placeholder="{{branch}}-{{sha}}" />
                          </Form.Item>
                          <Form.Item name={[field.name, 'runtimePortsText']} label="端口">
                            <Input placeholder="8080, 9090" />
                          </Form.Item>
                          <Form.Item name={[field.name, 'dockerfilePath']} label="Dockerfile">
                            <Input placeholder="Dockerfile" />
                          </Form.Item>
                          <Form.Item name={[field.name, 'buildContextDir']} label="构建上下文">
                            <Input placeholder="." />
                          </Form.Item>
                        </div>
                        <ManagementIconButton
                          aria-label="移除容器"
                          danger
                          icon={<MinusCircleOutlined />}
                          size="small"
                          tooltip="移除容器"
                          onClick={() => remove(field.name)}
                        />
                      </Card>
                    ))}
                  </div>
                )}
              </Form.List>
            </section>
          </div>
        </Form>
      </Drawer>
      <Modal
        title={
          editingRepositoryId
            ? '编辑代码仓库'
            : repositoryBindingTarget !== null
              ? '从代码源接入仓库'
              : '添加代码仓库'
        }
        open={repositoryModalVisible}
        footer={null}
        destroyOnHidden
        width={720}
        onCancel={() => {
          closeRepositoryModal()
        }}
      >
        <Form
          form={repositoryForm}
          layout="vertical"
          onFinish={(values) => {
            const payload = {
              ...values,
              applicationIds: [applicationId],
              gitlabProjectId: values.provider === 'gitlab' ? values.gitlabProjectId : undefined,
            }
            if (editingRepositoryId)
              updateRepositoryMutation.mutate({ id: editingRepositoryId, payload })
            else createRepositoryMutation.mutate(payload)
          }}
        >
          <div className="soha-application-service-form-grid">
            <Form.Item name="provider" label="提供方" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'gitlab', label: 'GitLab' },
                  { value: 'git', label: 'Git URL' },
                ]}
              />
            </Form.Item>
            <Form.Item name="protocol" label="协议" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'https', label: 'HTTPS' },
                  { value: 'ssh', label: 'SSH' },
                ]}
              />
            </Form.Item>
            {selectedRepositoryProvider === 'gitlab' ? (
              <Form.Item
                name="gitlabProjectId"
                label="代码源仓库"
                rules={[{ required: true, message: '请选择代码源仓库' }]}
              >
                <Select
                  showSearch={{ optionFilterProp: 'label' }}
                  loading={gitProjectsQuery.isFetching}
                  placeholder="选择设置中心已配置的仓库"
                  notFoundContent={
                    gitProjectsQuery.isFetching ? (
                      '正在读取代码源…'
                    ) : (
                      <Space orientation="vertical" size={2} align="center">
                        <Text type="secondary">没有可用仓库，请确认代码源已启用并完成授权</Text>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => navigate('/settings/source-control')}
                        >
                          检查代码源设置
                        </Button>
                      </Space>
                    )
                  }
                  options={(gitProjectsQuery.data ?? []).map((item) => ({
                    value: item.id,
                    label: item.pathWithNamespace,
                  }))}
                  onChange={(id) => {
                    const project = gitProjectsQuery.data?.find((item) => item.id === id)
                    if (project)
                      repositoryForm.setFieldsValue({
                        name: project.name,
                        path: project.pathWithNamespace,
                        url: project.webUrl,
                        defaultBranch: project.defaultBranch || 'main',
                      })
                  }}
                />
              </Form.Item>
            ) : null}
            <Form.Item name="name" label="仓库名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="path" label="仓库路径" rules={[{ required: true }]}>
              <Input placeholder="group/project" />
            </Form.Item>
            <Form.Item name="url" label="Git URL" rules={[{ required: true }]}>
              <Input placeholder="https://git.example.com/group/project.git" />
            </Form.Item>
            <Form.Item name="defaultBranch" label="默认分支" rules={[{ required: true }]}>
              {selectedRepositoryProvider === 'gitlab' ? (
                <Select
                  showSearch={{ optionFilterProp: 'label' }}
                  loading={gitBranchesQuery.isFetching}
                  options={(gitBranchesQuery.data ?? []).map((item) => ({
                    value: item.name,
                    label: item.name,
                  }))}
                />
              ) : (
                <Input placeholder="main" />
              )}
            </Form.Item>
            <Form.Item name="credentialRef" label="凭据引用">
              <Input placeholder="server-side credential ref" />
            </Form.Item>
          </div>
          <div className="soha-form-actions">
            <Button onClick={closeRepositoryModal}>取消</Button>
            <Button
              htmlType="submit"
              type="primary"
              loading={createRepositoryMutation.isPending || updateRepositoryMutation.isPending}
            >
              保存
            </Button>
          </div>
        </Form>
      </Modal>
      <Modal
        title={editingBuildSourceId ? '编辑构建' : '添加构建'}
        open={buildSourceModalVisible}
        footer={null}
        destroyOnHidden
        width={920}
        onCancel={() => {
          setBuildSourceModalVisible(false)
          setEditingBuildSourceId('')
          setBuildSourceDraft(null)
          buildSourceForm.resetFields()
        }}
      >
        <Form
          form={buildSourceForm}
          layout="vertical"
          initialValues={buildSourceDraft ?? undefined}
          onFinish={(values) => {
            const sources = [...(runtime?.application.buildSources ?? [])]
            const repositoryBindings = (values.config?.repositoryBindings ?? []).filter(
              (item) => item.repositoryId,
            )
            const source = {
              ...values,
              id: editingBuildSourceId || `source-${Date.now()}`,
              config: {
                ...values.config,
                repositoryId: repositoryBindings[0]?.repositoryId,
                repositoryBindings,
              },
            }
            const normalized = (
              source.isDefault ? sources.map((item) => ({ ...item, isDefault: false })) : sources
            )
              .filter((item) => item.id !== source.id)
              .concat(source as BuildSource)
            managementState.updateAppMutation.mutate(
              {
                id: runtime?.application.id ?? '',
                payload: { ...runtime?.application, buildSources: normalized },
              },
              {
                onSuccess: () => {
                  if (serviceModalVisible) {
                    const primaryBinding = repositoryBindings[0]
                    const repository = repositories.find(
                      (item) => item.id === primaryBinding?.repositoryId,
                    )
                    serviceForm.setFieldsValue({
                      buildSourceId: source.id,
                      repositoryId: repository?.id,
                      repositoryPath: repository?.path,
                      defaultBranch: primaryBinding?.defaultBranch || repository?.defaultBranch,
                    })
                  }
                  setBuildSourceModalVisible(false)
                  setEditingBuildSourceId('')
                  setBuildSourceDraft(null)
                  buildSourceForm.resetFields()
                },
              },
            )
          }}
        >
          <div className="soha-application-service-editor">
            <section className="soha-application-service-editor-section">
              <div className="soha-application-service-editor-section__head">
                <span className="soha-application-service-editor-section__identity">
                  <Text strong>基础信息</Text>
                  <Text type="secondary">定义构建方式与默认产物</Text>
                </span>
              </div>
              <div className="soha-application-service-form-grid">
                <Form.Item name="name" label="名称" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="type" label="构建方式" rules={[{ required: true }]}>
                  <Select
                    onChange={setBuildSourceType}
                    options={[
                      { value: 'repo_dockerfile', label: '仓库 Dockerfile' },
                      { value: 'platform_build_template', label: '平台 Shell 构建模板' },
                      { value: 'external_pipeline', label: '外部流水线' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="buildImage" label="产物镜像" extra="构建完成后自动推送产物镜像">
                  <Input />
                </Form.Item>
                <Form.Item name="defaultTag" label="默认 Tag">
                  <Input />
                </Form.Item>
                <Form.Item name="isDefault" label="默认构建源" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name="enabled" label="启用" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </div>
            </section>

            {buildSourceType !== 'external_pipeline' ? (
              <section className="soha-application-service-editor-section">
                <Form.List name={['config', 'repositoryBindings']}>
                  {(fields, { add, remove }) => (
                    <div className="soha-application-build-repository-editor">
                      <div className="soha-application-service-editor-section__head">
                        <span className="soha-application-service-editor-section__identity">
                          <Text strong>源码仓库</Text>
                          <Text type="secondary">多仓库独立检出；运行工作流时逐仓选择版本</Text>
                        </span>
                        <Space>
                          <Button
                            size="small"
                            icon={<LinkOutlined />}
                            onClick={() => openRepositoryModal('', fields[0]?.name ?? null)}
                          >
                            从代码源接入
                          </Button>
                          <Button
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() =>
                              add({
                                checkoutPath:
                                  fields.length === 0 ? '.' : `repository-${fields.length + 1}`,
                                allowCommitSelection: false,
                                submodules: false,
                              })
                            }
                          >
                            添加检出项
                          </Button>
                        </Space>
                      </div>
                      {fields.map((field, index) => {
                        const binding = buildSourceRepositoryBindings?.[field.name]
                        const repository = repositories.find(
                          (item) => item.id === binding?.repositoryId,
                        )
                        return (
                          <Card
                            key={field.key}
                            size="small"
                            className="soha-application-build-repository-editor__item"
                            title={`检出项 ${index + 1}`}
                            extra={
                              fields.length > 1 ? (
                                <ManagementIconButton
                                  aria-label={`移除检出项 ${index + 1}`}
                                  danger
                                  icon={<MinusCircleOutlined />}
                                  size="small"
                                  tooltip="移除检出项"
                                  onClick={() => remove(field.name)}
                                />
                              ) : null
                            }
                          >
                            <div className="soha-application-service-form-grid">
                              <Form.Item
                                name={[field.name, 'repositoryId']}
                                label="已接入仓库"
                                rules={[{ required: true, message: '请选择已接入仓库' }]}
                              >
                                <Select
                                  showSearch={{ optionFilterProp: 'label' }}
                                  loading={repositoriesQuery.isFetching}
                                  placeholder="选择已接入当前应用的仓库"
                                  notFoundContent={
                                    repositoriesQuery.isFetching ? (
                                      '正在加载仓库…'
                                    ) : (
                                      <Button
                                        type="link"
                                        size="small"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => openRepositoryModal('', field.name)}
                                      >
                                        未找到仓库，从代码源接入
                                      </Button>
                                    )
                                  }
                                  options={repositories.map((item) => ({
                                    value: item.id,
                                    label: `${item.name} · ${item.path}`,
                                    disabled: buildSourceRepositoryBindings?.some(
                                      (current, currentIndex) =>
                                        currentIndex !== index && current?.repositoryId === item.id,
                                    ),
                                  }))}
                                  onChange={(repositoryId) => {
                                    const nextRepository = repositories.find(
                                      (item) => item.id === repositoryId,
                                    )
                                    buildSourceForm.setFieldValue(
                                      ['config', 'repositoryBindings', field.name, 'defaultBranch'],
                                      nextRepository?.defaultBranch,
                                    )
                                  }}
                                />
                              </Form.Item>
                              <Form.Item name={[field.name, 'checkoutPath']} label="检出目录">
                                <Input
                                  placeholder={index === 0 ? '.' : `repository-${index + 1}`}
                                />
                              </Form.Item>
                              <Form.Item name={[field.name, 'defaultBranch']} label="默认分支">
                                <Input placeholder={repository?.defaultBranch || 'main'} />
                              </Form.Item>
                              <Form.Item
                                name={[field.name, 'allowCommitSelection']}
                                label="运行时允许选择 Commit"
                                valuePropName="checked"
                              >
                                <Switch />
                              </Form.Item>
                              <Form.Item
                                name={[field.name, 'submodules']}
                                label="拉取 Git Submodule"
                                valuePropName="checked"
                              >
                                <Switch />
                              </Form.Item>
                            </div>
                            {repository ? (
                              <Text type="secondary">{`${repository.url} · ${repository.protocol.toUpperCase()}`}</Text>
                            ) : null}
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </Form.List>
              </section>
            ) : null}

            <section className="soha-application-service-editor-section">
              <div className="soha-application-service-editor-section__head">
                <span className="soha-application-service-editor-section__identity">
                  <Text strong>构建执行</Text>
                  <Text type="secondary">选择 Docker、Shell 模板或外部流水线</Text>
                </span>
              </div>
              <div className="soha-application-service-form-grid">
                {buildSourceType === 'repo_dockerfile' ? (
                  <>
                    <Form.Item name={['config', 'dockerfilePath']} label="Dockerfile">
                      <Input placeholder="Dockerfile" />
                    </Form.Item>
                    <Form.Item name={['config', 'contextDir']} label="构建上下文">
                      <Input placeholder="." />
                    </Form.Item>
                    <Form.Item name={['config', 'builderKind']} label="构建执行器">
                      <Select
                        options={[
                          { value: 'docker', label: 'Docker' },
                          { value: 'buildx', label: 'Docker Buildx' },
                          { value: 'kaniko', label: 'Kaniko' },
                        ]}
                      />
                    </Form.Item>
                  </>
                ) : null}
                {buildSourceType === 'platform_build_template' ? (
                  <Form.Item
                    name={['config', 'buildTemplateId']}
                    label="Shell 构建模板"
                    rules={[{ required: true, message: '请选择构建模板' }]}
                  >
                    <Select
                      loading={buildTemplatesQuery.isFetching}
                      options={(buildTemplatesQuery.data ?? [])
                        .filter((template) => template.enabled !== false)
                        .map((template) => ({ value: template.id, label: template.name }))}
                    />
                  </Form.Item>
                ) : null}
                {buildSourceType === 'external_pipeline' ? (
                  <Form.Item
                    name={['config', 'pipelineRef']}
                    label="外部流水线"
                    rules={[{ required: true, message: '请输入外部流水线引用' }]}
                  >
                    <Input placeholder="pipeline/project/ref" />
                  </Form.Item>
                ) : null}
              </div>
              {buildSourceType === 'platform_build_template' ? (
                <div className="soha-application-service-build-steps">
                  <Text strong>Shell 构建步骤</Text>
                  {selectedBuildTemplate?.buildCommands?.length ? (
                    <ol>
                      {selectedBuildTemplate.buildCommands.map((command) => (
                        <li key={command}>
                          <code>{command}</code>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Text type="secondary">选择模板后显示执行命令。</Text>
                  )}
                </div>
              ) : null}
            </section>
          </div>
          <div className="soha-form-actions">
            <Button onClick={() => setBuildSourceModalVisible(false)}>取消</Button>
            <Button
              htmlType="submit"
              type="primary"
              loading={managementState.updateAppMutation.isPending}
            >
              保存
            </Button>
          </div>
        </Form>
      </Modal>
      <ApplicationCenterModals state={managementState} />
    </div>
  )
}
