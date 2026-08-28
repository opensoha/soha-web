import { useEffect, useMemo, useState } from 'react'
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
  Select,
  Space,
  Switch,
  Tabs,
  Tooltip,
  Typography,
} from 'antd'
import {
  ArrowRightOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  MinusCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ManagementIconButton, ManagementState } from '@/components/management-list'
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
import {
  countWorkflowValidationNodes,
  workflowTemplateValidationNodeCount,
} from '../delivery-status'
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
  BuildSource,
  DeliveryApplicationBindingSummary,
  DeliveryPlan,
  DeliveryPlanConfirmResult,
  DeliveryPlanRequest,
  ExecutionArtifact,
  ExecutionTask,
  ReleaseBundle,
  WorkflowRun,
  WorkflowTemplate,
} from '../types'

const { Text } = Typography

const SERVICE_KIND_OPTIONS = [
  { value: 'kubernetes_workload', label: 'Kubernetes Workload' },
  { value: 'helm_release', label: 'Helm Release' },
  { value: 'external_service', label: 'External Service' },
  { value: 'job', label: 'Job' },
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
  imageTag?: string
  releaseName?: string
  containerName?: string
}

const REF_TYPE_OPTIONS = [
  { value: 'branch', label: 'Branch' },
  { value: 'tag', label: 'Tag' },
  { value: 'commit', label: 'Commit' },
]

const DELIVERY_ACTION_LABELS: Record<ApplicationDeliveryActionKind, string> = {
  build: '构建',
  deploy: '部署',
  build_deploy: '构建并部署',
  workflow: '工作流',
  verify: '验证',
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

function summarizeExecutionTask(task?: ExecutionTask | null) {
  if (!task) return '-'
  return `${task.status} · ${task.taskKind}`
}

function summarizeReleaseBundle(bundle?: ReleaseBundle | null) {
  if (!bundle) return '-'
  return `${bundle.status} · ${bundle.version}`
}

function workflowTemplateDesignPath(templateId?: string) {
  return templateId
    ? `/workflow-templates?templateId=${encodeURIComponent(templateId)}`
    : '/workflow-templates'
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
        label={analysis.validationNodeCount > 0 ? '有验证节点' : '无验证节点'}
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

function summarizeArtifacts(artifacts?: ExecutionArtifact[] | null) {
  if (!artifacts?.length) return '-'
  return artifacts
    .slice(0, 3)
    .map((item) => item.name || item.ref || item.path || item.kind)
    .join(' / ')
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

function deliveryTargetSummary(target?: {
  clusterId: string
  namespace: string
  workloadName: string
  containerName?: string
  targetKind?: string
  executorKind?: string
  groupKey?: string
  waveKey?: string
  regionKey?: string
  configRef?: string
}) {
  if (!target) return '-'
  const parts = [target.clusterId, target.namespace, target.workloadName]
  return [parts.join(' / '), target.containerName, target.targetKind, target.executorKind]
    .filter(Boolean)
    .join(' · ')
}

function buildDeliveryActionPayload(
  action: ApplicationDeliveryActionKind,
  values: DeliveryActionFormValues,
): ApplicationDeliveryActionRequest {
  return {
    action,
    applicationEnvironmentId: values.applicationEnvironmentId ?? '',
    targetId: values.targetId,
    buildSourceId: values.buildSourceId,
    refType: values.refType,
    refName: values.refName,
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
  const activeTab =
    requestedTab === 'services' || requestedTab === 'environments' || requestedTab === 'delivery'
      ? requestedTab
      : 'overview'
  const requestedSection = searchParams.get('section')
  const activeSection =
    activeTab === 'delivery'
      ? requestedSection === 'pipeline' || requestedSection === 'verification'
        ? requestedSection
        : 'release'
      : activeTab === 'services'
        ? requestedSection === 'resources'
          ? requestedSection
          : 'components'
        : activeTab === 'overview'
          ? requestedSection === 'permissions' || requestedSection === 'capabilities'
            ? requestedSection
            : requestedSection === 'application'
              ? requestedSection
              : 'runtime'
          : undefined
  const focusedBuildId = searchParams.get('buildId')?.trim() ?? ''
  const focusedReleaseId = searchParams.get('releaseId')?.trim() ?? ''
  const focusedWorkflowRunId = searchParams.get('workflowRunId')?.trim() ?? ''
  const focusedServiceId = searchParams.get('serviceId')?.trim() ?? ''
  const [activeEnvironmentId, setActiveEnvironmentId] = useState('')
  const [serviceKeyword, setServiceKeyword] = useState('')
  const [serviceModalVisible, setServiceModalVisible] = useState(false)
  const [editingService, setEditingService] = useState<ApplicationServiceComponent | null>(null)
  const [repositoryModalVisible, setRepositoryModalVisible] = useState(false)
  const [editingRepositoryId, setEditingRepositoryId] = useState('')
  const [buildSourceModalVisible, setBuildSourceModalVisible] = useState(false)
  const [editingBuildSourceId, setEditingBuildSourceId] = useState('')
  const [deliveryPlanModalVisible, setDeliveryPlanModalVisible] = useState(false)
  const [pendingDeliveryPlan, setPendingDeliveryPlan] = useState<DeliveryPlan | null>(null)
  const [confirmedDeliveryPlan, setConfirmedDeliveryPlan] =
    useState<DeliveryPlanConfirmResult | null>(null)
  const [serviceForm] = Form.useForm<ServiceFormValues>()
  const [repositoryForm] = Form.useForm<RepositoryFormValues>()
  const [buildSourceForm] = Form.useForm<BuildSourceFormValues>()
  const [deliveryForm] = Form.useForm<DeliveryActionFormValues>()
  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    if (tab !== 'services') next.delete('serviceId')
    if (tab === 'delivery') next.set('section', 'release')
    else if (tab === 'services') next.set('section', 'components')
    else if (tab === 'overview') next.set('section', 'runtime')
    else next.delete('section')
    setSearchParams(next, { replace: true })
  }
  const setActiveSection = (section: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('section', section)
    if (section !== 'components') next.delete('serviceId')
    setSearchParams(next, { replace: true })
  }
  const setFocusedService = (serviceId?: string) => {
    const next = new URLSearchParams(searchParams)
    if (serviceId) {
      next.set('tab', 'services')
      next.set('section', 'components')
      next.set('serviceId', serviceId)
    } else {
      next.delete('serviceId')
    }
    setSearchParams(next, { replace: true })
  }
  const permissionSnapshotQuery = usePermissionSnapshot()
  const managementState = useApplicationCenterState()
  const permissionSnapshot = permissionSnapshotQuery.data?.data
  const canCreateService = hasPermission(permissionSnapshot, 'delivery.application-services.create')
  const canUpdateService = hasPermission(permissionSnapshot, 'delivery.application-services.update')
  const canDeleteService = hasPermission(permissionSnapshot, 'delivery.application-services.delete')
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

  const runtime = runtimeQuery.data
  const detail = detailQuery.data
  const environments = runtime?.environments ?? []
  const services = servicesQuery.data ?? []
  const repositories = repositoriesQuery.data ?? []
  const bindings = detail?.bindings ?? []
  const selectedDeliveryBindingId = Form.useWatch('applicationEnvironmentId', deliveryForm)
  const selectedTargetId = Form.useWatch('targetId', deliveryForm)
  const selectedBuildSourceId = Form.useWatch('buildSourceId', deliveryForm)
  const selectedRefType = Form.useWatch(
    'refType',
    deliveryForm,
  ) as DeliveryActionFormValues['refType']
  const selectedImageTag = Form.useWatch('imageTag', deliveryForm)

  useAIPageContext({
    sourceWorkbench: 'delivery',
    sourceTitle: detail?.application?.name ? `应用 ${detail.application.name}` : '应用详情',
    entityKind: 'delivery.application',
    entityName: detail?.application?.name ?? detail?.application?.key ?? applicationId,
    applicationId,
    visibleFilters: {
      tab: activeTab,
      focusedBuildId,
      focusedReleaseId,
      focusedWorkflowRunId,
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
        label: item.name,
      })),
    [runtime?.application.buildSources],
  )

  useEffect(() => {
    if (!applicationId || managementState.selectedApplicationId === applicationId) return
    managementState.setSelectedApplicationId(applicationId)
  }, [applicationId, managementState])
  const releaseBundleArtifactsQuery = useQuery(
    deliveryQueries.releaseBundles.artifacts(
      detail?.latestBundle?.id ?? '',
      Boolean(detail?.latestBundle?.id),
    ),
  )
  const latestExecutionArtifactsQuery = useQuery(
    deliveryQueries.executionTasks.artifacts(
      detail?.latestExecutionTask?.id ?? '',
      Boolean(detail?.latestExecutionTask?.id),
    ),
  )
  const latestBuildsQuery = useQuery(
    deliveryQueries.builds.list({ applicationId }, Boolean(applicationId)),
  )
  const latestReleasesQuery = useQuery(
    deliveryQueries.releases.list({ applicationId }, { enabled: Boolean(applicationId) }),
  )
  const latestWorkflowsQuery = useQuery(
    deliveryQueries.workflows.list({ applicationId }, { enabled: Boolean(applicationId) }),
  )
  const createDeliveryPlanOptions = deliveryMutations.plans.create(queryClient)
  const createDeliveryPlanMutation = useMutation({
    ...createDeliveryPlanOptions,
    onSuccess: (plan, variables, onMutateResult, context) => {
      void createDeliveryPlanOptions.onSuccess?.(plan, variables, onMutateResult, context)
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
  const createRepositoryMutation = useMutation({
    ...createRepositoryOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void createRepositoryOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('代码仓库已创建')
      setRepositoryModalVisible(false)
      repositoryForm.resetFields()
    },
    onError: (err: Error) => message.error(err.message),
  })
  const updateRepositoryOptions = deliveryMutations.repositories.update(queryClient)
  const updateRepositoryMutation = useMutation({
    ...updateRepositoryOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void updateRepositoryOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('代码仓库已更新')
      setRepositoryModalVisible(false)
      setEditingRepositoryId('')
      repositoryForm.resetFields()
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
    serviceForm.setFieldsValue(serviceInitialValues(nextService))
  }

  const openRepositoryModal = (repositoryId = '') => {
    const repository = repositories.find((item) => item.id === repositoryId)
    setEditingRepositoryId(repositoryId)
    setRepositoryModalVisible(true)
    repositoryForm.setFieldsValue(
      repository
        ? { ...repository }
        : { provider: 'gitlab', protocol: 'https', defaultBranch: 'main' },
    )
  }

  const openBuildSourceModal = (source?: BuildSource) => {
    setEditingBuildSourceId(source?.id ?? '')
    setBuildSourceModalVisible(true)
    buildSourceForm.setFieldsValue(
      source
        ? { ...source }
        : {
            name: '',
            type: 'repo_dockerfile',
            enabled: true,
            isDefault: !runtime?.application.buildSources?.length,
            config: {
              repositoryId: repositories[0]?.id,
              contextDir: '.',
              dockerfilePath: 'Dockerfile',
              builderKind: 'docker',
            },
          },
    )
  }

  useEffect(() => {
    if (!environments.length) {
      setActiveEnvironmentId('')
      return
    }
    if (
      activeEnvironmentId &&
      environments.some((item) => item.applicationEnvironmentId === activeEnvironmentId)
    ) {
      return
    }
    setActiveEnvironmentId(environments[0].applicationEnvironmentId)
  }, [activeEnvironmentId, environments])

  useEffect(() => {
    if (!bindings.length) {
      deliveryForm.resetFields()
      return
    }
    const currentBindingId = deliveryForm.getFieldValue('applicationEnvironmentId')
    const nextBinding =
      bindings.find((item) => item.applicationEnvironmentId === currentBindingId) ?? bindings[0]
    const enabledTarget =
      nextBinding.targets?.find((item) => item.enabled) ?? nextBinding.targets?.[0]
    const defaultSource =
      nextBinding.buildSource ??
      runtime?.application.buildSources?.find((item) => item.isDefault) ??
      runtime?.application.buildSources?.[0]
    deliveryForm.setFieldsValue({
      applicationEnvironmentId: nextBinding.applicationEnvironmentId,
      targetId: enabledTarget?.id,
      buildSourceId: nextBinding.buildSourceId || defaultSource?.id,
      refType:
        (nextBinding.buildPolicy?.refType as DeliveryActionFormValues['refType']) || 'branch',
      refName: nextBinding.buildPolicy?.refValue || 'main',
      imageTag: defaultSource?.defaultTag || runtime?.application.defaultTag,
      containerName: enabledTarget?.containerName,
    })
  }, [bindings, deliveryForm, runtime?.application.buildSources, runtime?.application.defaultTag])

  const activeEnvironment =
    environments.find((item) => item.applicationEnvironmentId === activeEnvironmentId) ??
    environments[0]
  const workloads = activeEnvironment?.workloads ?? []
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
    selectedDeliveryTarget?.clusterId,
  )
  const selectedBuildSource =
    runtime?.application.buildSources?.find((item) => item.id === selectedBuildSourceId) ??
    selectedDeliveryBinding?.buildSource ??
    runtime?.application.buildSources?.find((item) => item.isDefault) ??
    runtime?.application.buildSources?.[0]
  const selectedRepositoryId = String(selectedBuildSource?.config?.repositoryId ?? '')
  const selectedRepository = repositories.find((item) => item.id === selectedRepositoryId)
  const selectedGitProjectId = selectedRepository?.gitlabProjectId ?? ''
  const deliveryBranchesQuery = useQuery(
    deliveryQueries.repositories.gitBranches(
      { projectId: selectedGitProjectId },
      Boolean(selectedGitProjectId && selectedRefType === 'branch'),
    ),
  )
  const deliveryTagsQuery = useQuery(
    deliveryQueries.repositories.gitTags(
      { projectId: selectedGitProjectId },
      Boolean(selectedGitProjectId && selectedRefType === 'tag'),
    ),
  )
  const deliveryCommitsQuery = useQuery(
    deliveryQueries.repositories.gitCommits(
      { projectId: selectedGitProjectId, page: 1, limit: 50 },
      Boolean(selectedGitProjectId && selectedRefType === 'commit'),
    ),
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
  const buildDisabledReason = disabledReason([
    !selectedDeliveryBinding && '无环境绑定',
    !effectiveImageTag && '缺少镜像 Tag / 默认 Tag',
    !canTriggerBuild && '缺少构建权限',
  ])
  const deployDisabledReason = disabledReason([
    !selectedDeliveryBinding && '无环境绑定',
    !selectedDeliveryTarget && '无发布目标',
    deliveryTargetCapabilityReason,
    !effectiveImageTag && '缺少镜像 Tag / 默认 Tag',
    !canTriggerRelease && '缺少发布权限',
  ])
  const buildDeployDisabledReason = disabledReason([
    !selectedDeliveryBinding && '无环境绑定',
    !selectedDeliveryTarget && '无发布目标',
    !selectedDeliveryBinding?.workflowTemplate && '无发布流程模板',
    deliveryTargetCapabilityReason,
    !effectiveImageTag && '缺少镜像 Tag / 默认 Tag',
    !canTriggerBuild && '缺少构建权限',
    !canTriggerWorkflow && '缺少工作流权限',
  ])
  const verifyDisabledReason = disabledReason([
    !selectedDeliveryBinding && '无环境绑定',
    !selectedDeliveryTarget && '无发布目标',
    !selectedDeliveryBinding?.workflowTemplate && '无发布流程模板',
    validationNodeCount === 0 && '无验证节点',
    deliveryTargetCapabilityReason,
    !canTriggerWorkflow && '缺少工作流权限',
  ])

  if (runtimeQuery.isLoading) {
    return (
      <div className="soha-page">
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

  const visibleEnvironments = activeEnvironmentId
    ? environments.filter(
        (environment) => environment.applicationEnvironmentId === activeEnvironmentId,
      )
    : environments
  const normalizedServiceKeyword = serviceKeyword.trim().toLowerCase()
  const visibleServices = normalizedServiceKeyword
    ? services.filter((service) =>
        [service.name, service.key, service.ownerTeam]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedServiceKeyword)),
      )
    : services
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
  const latestBuilds = latestBuildsQuery.data ?? []
  const latestReleases = latestReleasesQuery.data ?? []
  const latestWorkflows = latestWorkflowsQuery.data ?? []
  const focusedRuntimeEvidenceId = focusedBuildId || focusedReleaseId || focusedWorkflowRunId
  const focusedRuntimeEvidence = [
    ...latestBuilds.map((item) => ({
      kind: 'build',
      id: item.id,
      status: item.status,
      label: item.sourceSystem,
      summary: item.metadata?.artifact ? 'artifact ready' : 'build record',
    })),
    ...latestReleases.map((item) => ({
      kind: 'release',
      id: item.id,
      status: item.status,
      label: `${item.clusterId}/${item.namespace}`,
      summary: item.deploymentName,
    })),
    ...latestWorkflows.map((item) => ({
      kind: 'workflow',
      id: item.id,
      status: item.status,
      label: item.workflowName,
      summary: `${item.steps?.length ?? 0} steps`,
    })),
  ]
  const focusedRuntimeRow = focusedRuntimeEvidenceId
    ? focusedRuntimeEvidence.find((item) => item.id === focusedRuntimeEvidenceId)
    : undefined
  const permissionRows = [
    { key: 'delivery.builds.trigger', label: '构建', enabled: canTriggerBuild },
    { key: 'delivery.workflows.trigger', label: '工作流', enabled: canTriggerWorkflow },
    { key: 'delivery.releases.trigger', label: '发布', enabled: canTriggerRelease },
    { key: 'delivery.application-services.create', label: '新建服务', enabled: canCreateService },
    { key: 'delivery.application-services.update', label: '修改服务', enabled: canUpdateService },
    { key: 'delivery.application-services.delete', label: '删除服务', enabled: canDeleteService },
  ]
  const serviceEnvironmentWorkspace = (
    <DeliveryTable
      title="服务与环境"
      shellClassName="soha-application-service-environment-matrix"
      rowKey="id"
      pagination={false}
      dataSource={visibleServices}
      loading={servicesQuery.isLoading || runtimeQuery.isLoading}
      actions={
        <div className="soha-application-service-environment-toolbar">
          <Input
            allowClear
            aria-label="搜索服务"
            placeholder="搜索服务"
            value={serviceKeyword}
            onChange={(event) => setServiceKeyword(event.target.value)}
          />
          <Select
            aria-label="筛选环境"
            value={activeEnvironmentId || 'all'}
            onChange={(value) => setActiveEnvironmentId(value === 'all' ? '' : value)}
            options={[
              { value: 'all', label: '全部环境' },
              ...environments.map((environment) => ({
                value: environment.applicationEnvironmentId,
                label:
                  environment.environmentName ||
                  environment.environmentKey ||
                  environment.environmentId,
              })),
            ]}
          />
          {canCreateService ? (
            <Button icon={<PlusOutlined />} onClick={() => openServiceModal()}>
              新建服务
            </Button>
          ) : null}
          <Button type="primary" icon={<RocketOutlined />} onClick={() => setActiveTab('delivery')}>
            发布变更
          </Button>
        </div>
      }
      columns={[
        {
          title: '服务',
          dataIndex: 'name',
          width: 220,
          render: (_: string, service: ApplicationServiceComponent) => (
            <div className="soha-application-service-environment-matrix__service">
              <Space size={6}>
                <strong>{service.name}</strong>
                <StatusTag value={service.enabled ? 'enabled' : 'disabled'} />
              </Space>
              <Text type="secondary">{service.key}</Text>
            </div>
          ),
        },
        {
          title: '交付方式',
          dataIndex: 'serviceKind',
          width: 180,
          render: (value?: string) => <MetadataTag label={serviceKindLabel(value)} />,
        },
        ...visibleEnvironments.map((environment) => ({
          title:
            environment.environmentName || environment.environmentKey || environment.environmentId,
          key: environment.applicationEnvironmentId,
          width: 240,
          render: (_: unknown, service: ApplicationServiceComponent) => {
            const workload = runtimeWorkloadForService(
              runtime,
              service,
              environment.applicationEnvironmentId,
            )
            if (!workload) return <Text type="secondary">未部署</Text>
            const binding = bindings.find(
              (item) => item.applicationEnvironmentId === environment.applicationEnvironmentId,
            )
            const version = workload.latestBundle?.version || binding?.latestBundle?.version || '-'
            return (
              <div className="soha-application-service-environment-matrix__runtime">
                <div className="soha-application-service-environment-matrix__runtime-head">
                  <StatusTag value={workload.healthStatus || summarizeStatus(workload)} />
                  <strong>{version}</strong>
                  <ManagementIconButton
                    aria-label={`查看 ${service.name} 在 ${environment.environmentName || environment.environmentKey || environment.environmentId} 的运行态`}
                    icon={<ArrowRightOutlined />}
                    size="small"
                    tooltip="运行态"
                    onClick={() =>
                      navigate(
                        `/applications/${runtime.application.id}/application-environments/${workload.applicationEnvironmentId}/workloads/${encodeURIComponent(workload.workloadName)}`,
                      )
                    }
                  />
                </div>
                <Text type="secondary">{`${workload.workloadKind} · ${workload.namespace}`}</Text>
                <Text>{`Ready ${workload.readyReplicas}/${workload.desiredReplicas}`}</Text>
              </div>
            )
          },
        })),
        ...(canUpdateService || canDeleteService
          ? [
              {
                title: '操作',
                key: 'actions',
                width: 88,
                render: (_: unknown, service: ApplicationServiceComponent) => (
                  <Space className="soha-row-action-icons" size={2}>
                    {canUpdateService ? (
                      <ManagementIconButton
                        aria-label="编辑服务"
                        icon={<EditOutlined />}
                        size="small"
                        tooltip="编辑"
                        onClick={() => openServiceModal(service)}
                      />
                    ) : null}
                    {canDeleteService ? (
                      <Popconfirm
                        title="确认删除该服务？"
                        onConfirm={() =>
                          deleteServiceMutation.mutate({
                            applicationId: applicationId ?? '',
                            serviceId: service.id,
                          })
                        }
                      >
                        <ManagementIconButton
                          aria-label="删除服务"
                          danger
                          icon={<DeleteOutlined />}
                          size="small"
                          tooltip="删除"
                        />
                      </Popconfirm>
                    ) : null}
                  </Space>
                ),
              },
            ]
          : []),
      ]}
    />
  )

  return (
    <div className="soha-page">
      {focusedRuntimeEvidenceId ? (
        <Alert
          showIcon
          title={focusedRuntimeRow ? `已定位交付证据 ${focusedRuntimeRow.id}` : '交付证据定位'}
          description={[
            focusedBuildId ? `buildId=${focusedBuildId}` : '',
            focusedReleaseId ? `releaseId=${focusedReleaseId}` : '',
            focusedWorkflowRunId ? `workflowRunId=${focusedWorkflowRunId}` : '',
          ]
            .filter(Boolean)
            .join(' / ')}
          type={
            focusedRuntimeRow ||
            latestBuildsQuery.isLoading ||
            latestReleasesQuery.isLoading ||
            latestWorkflowsQuery.isLoading
              ? 'info'
              : 'warning'
          }
        />
      ) : null}
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
                  <Card
                    className="soha-management-panel-card soha-application-settings-summary"
                    title="应用配置"
                    extra={
                      managementState.canUpdateApplication ? (
                        <Button icon={<EditOutlined />} onClick={openApplicationEdit}>
                          编辑应用
                        </Button>
                      ) : null
                    }
                  >
                    <Descriptions
                      column={{ xs: 1, sm: 2, lg: 4 }}
                      items={[
                        { key: 'key', label: '应用 Key', children: runtime.application.key || '-' },
                        { key: 'group', label: '分组', children: runtime.application.group || '-' },
                        {
                          key: 'language',
                          label: '语言',
                          children: runtime.application.language || '-',
                        },
                        {
                          key: 'status',
                          label: '状态',
                          children: (
                            <StatusTag
                              value={runtime.application.enabled ? 'enabled' : 'disabled'}
                            />
                          ),
                        },
                      ]}
                    />
                  </Card>
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
                          添加构建源
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
                <DeliveryTable
                  title="环境绑定"
                  actions={
                    managementState.canCreateBinding ? (
                      <Button type="primary" icon={<PlusOutlined />} onClick={openBindingCreate}>
                        新建绑定
                      </Button>
                    ) : null
                  }
                  rowKey="id"
                  dataSource={managementState.filteredBindings}
                  loading={managementState.bindingsQuery.isLoading}
                  refreshing={managementState.bindingsQuery.isFetching}
                  onRefresh={() => void managementState.bindingsQuery.refetch()}
                  columns={[
                    {
                      title: '环境',
                      dataIndex: 'environmentId',
                      render: (value: string, record: ApplicationEnvironment) =>
                        record.environmentKey || value,
                    },
                    {
                      title: '构建来源',
                      dataIndex: 'buildPolicy',
                      render: (value: ApplicationEnvironment['buildPolicy']) =>
                        value?.sourceId || '-',
                    },
                    {
                      title: '发布流程模板',
                      dataIndex: 'workflowTemplateId',
                      render: (value?: string) =>
                        managementState.workflowTemplateMap[value || '']?.name || value || '-',
                    },
                    {
                      title: '模板健康',
                      dataIndex: 'id',
                      render: (value: string, record: ApplicationEnvironment) =>
                        renderEnvironmentBindingWorkflowHealth(
                          record,
                          bindingSummaryById[value],
                          managementState.workflowTemplateMap,
                        ),
                    },
                    {
                      title: '发布目标',
                      dataIndex: 'targets',
                      render: (targets: ApplicationEnvironment['targets']) =>
                        renderBindingTargets(targets),
                    },
                    {
                      title: '资源选择器',
                      dataIndex: 'resourceSelector',
                      render: (value: ApplicationEnvironment['resourceSelector']) =>
                        renderSelectorLabels(value),
                    },
                    {
                      title: '最近状态',
                      dataIndex: 'id',
                      render: (value: string) => (
                        <StatusTag value={summarizeBindingStatus(bindingSummaryById[value])} />
                      ),
                    },
                    {
                      title: '操作',
                      dataIndex: 'id',
                      fixed: 'right',
                      align: 'center',
                      width: 112,
                      render: (_: unknown, record: ApplicationEnvironment) => (
                        <Space className="soha-row-action-icons" size={2}>
                          <ManagementIconButton
                            aria-label="查看运行态"
                            icon={<ArrowRightOutlined />}
                            size="small"
                            tooltip="运行态"
                            onClick={() => {
                              setActiveEnvironmentId(record.id)
                              setActiveTab('environments')
                            }}
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
                      ),
                    },
                  ]}
                />
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
              label: '服务组件',
              children: (
                <Card
                  className="soha-management-panel-card"
                  title="服务组件"
                  extra={
                    canCreateService ? (
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => openServiceModal()}
                      >
                        新建服务
                      </Button>
                    ) : null
                  }
                >
                  {services.length > 0 ? (
                    <div className="soha-application-service-grid">
                      {services.map((service) => (
                        <Card
                          key={service.id}
                          size="small"
                          className="soha-application-service-card"
                          title={service.name}
                          extra={<StatusTag value={service.enabled ? 'enabled' : 'disabled'} />}
                          actions={[
                            <ManagementIconButton
                              key="detail"
                              aria-label="查看服务详情"
                              icon={<ArrowRightOutlined />}
                              size="small"
                              tooltip="详情"
                              onClick={() => setFocusedService(service.id)}
                            />,
                            ...(canUpdateService
                              ? [
                                  <ManagementIconButton
                                    key="edit"
                                    aria-label="编辑服务组件"
                                    icon={<EditOutlined />}
                                    size="small"
                                    tooltip="编辑"
                                    onClick={() => openServiceModal(service)}
                                  />,
                                ]
                              : []),
                            ...(canDeleteService
                              ? [
                                  <Popconfirm
                                    key="delete"
                                    title="确认删除该服务组件？"
                                    onConfirm={() =>
                                      deleteServiceMutation.mutate({
                                        applicationId: applicationId ?? '',
                                        serviceId: service.id,
                                      })
                                    }
                                  >
                                    <ManagementIconButton
                                      aria-label="删除服务组件"
                                      danger
                                      icon={<DeleteOutlined />}
                                      size="small"
                                      tooltip="删除"
                                    />
                                  </Popconfirm>,
                                ]
                              : []),
                          ]}
                        >
                          <div className="soha-application-service-card__body">
                            <div className="soha-application-service-card__meta">
                              <MetadataTag label={serviceKindLabel(service.serviceKind)} />
                              {service.ownerTeam ? <MetadataTag label={service.ownerTeam} /> : null}
                              {service.buildSourceId ? (
                                <MetadataTag label={service.buildSourceId} />
                              ) : null}
                            </div>
                            <Text type="secondary">
                              {service.repositoryPath || '未配置服务仓库'}
                            </Text>
                            <div className="soha-application-container-list">
                              {(service.containers ?? []).map((container) => (
                                <div
                                  className="soha-application-container-row"
                                  key={container.id || container.name}
                                >
                                  <span>{container.name}</span>
                                  <Text type="secondary">
                                    {container.imageRepository || '未配置镜像仓库'}
                                  </Text>
                                  {container.runtimePorts?.length ? (
                                    <MetadataTag label={container.runtimePorts.join(', ')} />
                                  ) : null}
                                </div>
                              ))}
                              {!service.containers?.length ? (
                                <Text type="secondary">尚未配置容器</Text>
                              ) : null}
                            </div>
                            {runtimeWorkloadForService(runtime, service) ? (
                              <Button
                                size="small"
                                icon={<LinkOutlined />}
                                onClick={() => {
                                  const workload = runtimeWorkloadForService(runtime, service)
                                  if (!workload) return
                                  navigate(
                                    `/applications/${runtime.application.id}/application-environments/${workload.applicationEnvironmentId}/workloads/${encodeURIComponent(workload.workloadName)}`,
                                  )
                                }}
                              >
                                运行态
                              </Button>
                            ) : null}
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <ManagementState
                      bordered={false}
                      compact
                      description="尚未配置服务组件。先把应用拆成服务和容器，后续 CI/CD DAG 才能按服务选择构建、测试和部署目标。"
                      kind="not-configured"
                    />
                  )}
                </Card>
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
                        description="当前环境下没有可显示的服务/Deployment"
                      />
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'delivery',
              label: '构建发布',
              children: (
                <div className="soha-application-runtime-delivery-grid">
                  <Card
                    className="soha-application-delivery-actions soha-management-panel-card"
                    title="交付操作"
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
                          label="环境绑定"
                          rules={[{ required: true, message: '请选择环境绑定' }]}
                        >
                          <Select
                            options={bindings.map((binding) => ({
                              value: binding.applicationEnvironmentId,
                              label:
                                binding.environmentName ||
                                binding.environmentKey ||
                                binding.environmentId,
                            }))}
                            onChange={(value) => {
                              const nextBinding = bindings.find(
                                (item) => item.applicationEnvironmentId === value,
                              )
                              const nextTarget =
                                nextBinding?.targets?.find((item) => item.enabled) ??
                                nextBinding?.targets?.[0]
                              const nextSource =
                                nextBinding?.buildSource ??
                                runtime.application.buildSources?.find((item) => item.isDefault) ??
                                runtime.application.buildSources?.[0]
                              deliveryForm.setFieldsValue({
                                targetId: nextTarget?.id,
                                buildSourceId: nextBinding?.buildSourceId || nextSource?.id,
                                imageTag: nextSource?.defaultTag || runtime.application.defaultTag,
                                containerName: nextTarget?.containerName,
                              })
                            }}
                          />
                        </Form.Item>
                        <Form.Item name="targetId" label="发布目标">
                          <Select
                            allowClear
                            placeholder="选择 target"
                            options={(selectedDeliveryBinding?.targets ?? []).map((target) => ({
                              value: target.id,
                              disabled: !target.enabled,
                              label: deliveryTargetSummary(target),
                            }))}
                          />
                        </Form.Item>
                        <Form.Item name="buildSourceId" label="构建来源">
                          <Select allowClear options={serviceBuildSourceOptions} />
                        </Form.Item>
                        <Form.Item name="refType" label="Ref 类型">
                          <Select options={REF_TYPE_OPTIONS} />
                        </Form.Item>
                        <Form.Item name="refName" label="分支 / Tag / Commit">
                          {selectedGitProjectId && selectedRefType === 'branch' ? (
                            <Select
                              showSearch
                              allowClear
                              loading={deliveryBranchesQuery.isFetching}
                              options={(deliveryBranchesQuery.data ?? []).map((item) => ({
                                value: item.name,
                                label: item.name,
                              }))}
                            />
                          ) : selectedGitProjectId && selectedRefType === 'tag' ? (
                            <Select
                              showSearch
                              allowClear
                              loading={deliveryTagsQuery.isFetching}
                              options={(deliveryTagsQuery.data ?? []).map((item) => ({
                                value: item.name,
                                label: item.name,
                              }))}
                            />
                          ) : selectedGitProjectId && selectedRefType === 'commit' ? (
                            <Select
                              showSearch
                              allowClear
                              loading={deliveryCommitsQuery.isFetching}
                              options={(deliveryCommitsQuery.data?.items ?? []).map((item) => ({
                                value: item.id,
                                label: `${item.shortId} ${item.title}`,
                              }))}
                            />
                          ) : (
                            <Input placeholder="main" />
                          )}
                        </Form.Item>
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
                          <Input
                            placeholder={selectedDeliveryTarget?.containerName || '默认容器'}
                          />
                        </Form.Item>
                      </div>
                      <div className="soha-application-delivery-actions__footer">
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
                              '未绑定发布流程'
                            }
                          />
                          <MetadataTag
                            label={`${selectedDeliveryBinding?.targetCount ?? 0} 个发布目标`}
                          />
                          <MetadataTag label={`${validationNodeCount} 个验证节点`} />
                          {effectiveImageTag ? (
                            <MetadataTag label={`镜像 Tag ${effectiveImageTag}`} />
                          ) : (
                            <StatusTag value="warning" label="缺少镜像 Tag" />
                          )}
                        </Space>
                        <Space wrap>
                          <Tooltip title={buildDisabledReason || '触发构建'}>
                            <Button
                              icon={<CloudUploadOutlined />}
                              disabled={!!buildDisabledReason}
                              loading={deliveryActionPending}
                              onClick={() => void triggerDeliveryAction('build')}
                            >
                              构建
                            </Button>
                          </Tooltip>
                          <Tooltip title={deployDisabledReason || '触发部署'}>
                            <Button
                              icon={<RocketOutlined />}
                              disabled={!!deployDisabledReason}
                              loading={deliveryActionPending}
                              onClick={() => void triggerDeliveryAction('deploy')}
                            >
                              部署
                            </Button>
                          </Tooltip>
                          <Tooltip title={buildDeployDisabledReason || '通过发布流程模板编排'}>
                            <Button
                              type="primary"
                              icon={<PlayCircleOutlined />}
                              disabled={!!buildDeployDisabledReason}
                              loading={deliveryActionPending}
                              onClick={() => void triggerDeliveryAction('build_deploy')}
                            >
                              构建并部署
                            </Button>
                          </Tooltip>
                          <Tooltip title={verifyDisabledReason || '只运行验证节点'}>
                            <Button
                              icon={<SafetyCertificateOutlined />}
                              disabled={!!verifyDisabledReason}
                              loading={deliveryActionPending}
                              onClick={() => void triggerDeliveryAction('verify')}
                            >
                              运行验证
                            </Button>
                          </Tooltip>
                        </Space>
                      </div>
                    </Form>
                  </Card>
                  <Card className="soha-management-panel-card" title="版本包">
                    <Descriptions
                      column={1}
                      items={[
                        {
                          key: 'bundle',
                          label: '当前版本包',
                          children: summarizeReleaseBundle(detail?.latestBundle),
                        },
                        {
                          key: 'bundleArtifacts',
                          label: '版本包交付物',
                          children: summarizeArtifacts(releaseBundleArtifactsQuery.data),
                        },
                        {
                          key: 'task',
                          label: '执行任务',
                          children: summarizeExecutionTask(detail?.latestExecutionTask),
                        },
                        {
                          key: 'taskArtifacts',
                          label: 'Task 交付物',
                          children: summarizeArtifacts(latestExecutionArtifactsQuery.data),
                        },
                      ]}
                    />
                  </Card>
                  <DeliveryTable
                    title="构建 / 发布 / 工作流"
                    rowKey="id"
                    pagination={false}
                    dataSource={focusedRuntimeEvidence}
                    columns={[
                      { title: '类型', dataIndex: 'kind' },
                      {
                        title: 'ID',
                        dataIndex: 'id',
                        render: (value: string) => (
                          <Space size={6} wrap>
                            <Text>{value}</Text>
                            {value === focusedRuntimeEvidenceId ? (
                              <StatusTag value="info" label="已定位" />
                            ) : null}
                          </Space>
                        ),
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        render: (value: string) => <StatusTag value={value} />,
                      },
                      { title: '主体', dataIndex: 'label' },
                      { title: '说明', dataIndex: 'summary' },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'pipeline',
              label: '工作流',
              children: (
                <div className="soha-application-runtime-pipeline-grid">
                  <Card className="soha-management-panel-card" title="DAG 模板">
                    <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                      {bindings.length > 0 ? (
                        bindings.map((binding) => (
                          <div
                            className="soha-application-runtime-binding-row soha-application-runtime-binding-row--stacked"
                            key={binding.applicationEnvironmentId}
                          >
                            <div className="soha-application-runtime-binding-row__head">
                              <div className="soha-application-runtime-binding-row__main">
                                <strong>
                                  {binding.environmentName ||
                                    binding.environmentKey ||
                                    binding.environmentId}
                                </strong>
                                <Text type="secondary">
                                  {binding.workflowTemplate?.name ||
                                    binding.workflowTemplateName ||
                                    '未绑定工作流模板'}
                                </Text>
                              </div>
                              <Space wrap>
                                {renderWorkflowTemplateHealth(binding)}
                                <Button
                                  icon={<LinkOutlined />}
                                  size="small"
                                  disabled={!binding.workflowTemplateId}
                                  onClick={() =>
                                    navigate(workflowTemplateDesignPath(binding.workflowTemplateId))
                                  }
                                >
                                  编辑模板
                                </Button>
                              </Space>
                            </div>
                            {renderWorkflowTemplatePreview(binding.workflowTemplate)}
                          </div>
                        ))
                      ) : (
                        <ManagementState
                          bordered={false}
                          compact
                          description="尚未绑定 CI/CD DAG 模板"
                          kind="not-configured"
                        />
                      )}
                    </Space>
                  </Card>
                  <DeliveryTable
                    title="最近工作流运行"
                    rowKey="id"
                    pagination={false}
                    dataSource={latestWorkflows}
                    columns={[
                      { title: 'ID', dataIndex: 'id' },
                      { title: '工作流', dataIndex: 'workflowName' },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        render: (value: string) => <StatusTag value={value} />,
                      },
                      {
                        title: '步骤',
                        dataIndex: 'steps',
                        render: (_: unknown, record: WorkflowRun) =>
                          `${record.steps?.length ?? 0} steps`,
                      },
                      {
                        title: '验证节点',
                        dataIndex: 'nodeRuns',
                        render: (_: unknown, record: WorkflowRun) =>
                          countWorkflowValidationNodes(record),
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'verification',
              label: '测试验证',
              children: (
                <div className="soha-application-runtime-verification-grid">
                  <Card className="soha-management-panel-card" title="验证门禁">
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
                          label: '验证节点数',
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
                  <Card className="soha-management-panel-card" title="DAG 验证节点">
                    <Space orientation="vertical" style={{ width: '100%' }} size={10}>
                      <Alert
                        showIcon
                        type={selectedWorkflowValidationNodes.length > 0 ? 'success' : 'warning'}
                        title={
                          selectedWorkflowValidationNodes.length > 0
                            ? 'verify 动作会执行下列验证节点'
                            : '当前模板没有可执行的验证节点'
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
                        onClick={() => setActiveTab('environments')}
                        disabled={!bindings[0]?.applicationEnvironmentId}
                      >
                        查看绑定配置
                      </Button>
                      <Button
                        onClick={() =>
                          navigate(
                            workflowTemplateDesignPath(selectedDeliveryBinding?.workflowTemplateId),
                          )
                        }
                      >
                        查看 DAG 模板
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
              label: '概览',
              children: (
                <Tabs
                  className="soha-resource-tabs soha-application-section-tabs"
                  activeKey={activeSection}
                  onChange={setActiveSection}
                  items={[
                    { key: 'runtime', label: '运行概览', children: serviceEnvironmentWorkspace },
                    { ...tab('settings'), key: 'application', label: '应用配置' },
                    tab('permissions'),
                    { ...tab('capabilities'), label: '交付能力' },
                  ]}
                />
              ),
            },
            {
              key: 'services',
              label: '服务',
              children: (
                <Tabs
                  className="soha-resource-tabs soha-application-section-tabs"
                  activeKey={activeSection}
                  onChange={setActiveSection}
                  items={[
                    { ...tab('services'), key: 'components', label: '服务组件' },
                    {
                      key: 'resources',
                      label: '扩展资源',
                      children: (
                        <ManifestLibraryWorkspace
                          applicationId={applicationId ?? ''}
                          services={services}
                        />
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'environments',
              label: '环境',
              children: (
                <>
                  {tab('environment-bindings').children}
                  {tab('environments').children}
                </>
              ),
            },
            {
              key: 'delivery',
              label: '交付',
              children: (
                <Tabs
                  className="soha-resource-tabs soha-application-section-tabs"
                  activeKey={activeSection}
                  onChange={setActiveSection}
                  items={[
                    { ...tab('delivery'), key: 'release', label: '发布变更' },
                    tab('pipeline'),
                    { ...tab('verification'), label: '验证' },
                  ]}
                />
              ),
            },
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
          focusedService && canUpdateService ? (
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setFocusedService()
                openServiceModal(focusedService)
              }}
            >
              编辑服务
            </Button>
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
                        label: '服务类型',
                        children: serviceKindLabel(focusedService.serviceKind),
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
      <Modal
        title={editingService ? '编辑服务组件' : '新建服务组件'}
        open={serviceModalVisible}
        onCancel={() => {
          setServiceModalVisible(false)
          setEditingService(null)
          serviceForm.resetFields()
        }}
        footer={null}
        destroyOnHidden
        width={900}
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
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="ownerTeam" label="负责人团队">
              <Input />
            </Form.Item>
            <Form.Item name="buildSourceId" label="构建来源">
              <Select allowClear options={serviceBuildSourceOptions} />
            </Form.Item>
            <Form.Item name="repositoryId" label="代码仓库">
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                options={repositories.map((item) => ({ value: item.id, label: item.name }))}
              />
            </Form.Item>
            <Form.Item name="repositoryPath" label="服务仓库">
              <Input placeholder="group/project" />
            </Form.Item>
            <Form.Item name="defaultBranch" label="默认分支">
              <Input placeholder="main" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.List name="containers">
            {(fields, { add, remove }) => (
              <div className="soha-application-service-containers-editor">
                <div className="soha-application-service-containers-editor__head">
                  <Text strong>容器</Text>
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
                      <Form.Item name={[field.name, 'imageRepository']} label="镜像仓库">
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

          <div className="soha-form-actions">
            <Button onClick={() => setServiceModalVisible(false)}>取消</Button>
            <Button
              htmlType="submit"
              type="primary"
              loading={createServiceMutation.isPending || updateServiceMutation.isPending}
            >
              保存
            </Button>
          </div>
        </Form>
      </Modal>
      <Modal
        title={editingRepositoryId ? '编辑代码仓库' : '添加代码仓库'}
        open={repositoryModalVisible}
        footer={null}
        destroyOnHidden
        width={720}
        onCancel={() => {
          setRepositoryModalVisible(false)
          setEditingRepositoryId('')
          repositoryForm.resetFields()
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
                label="GitLab Project"
                rules={[{ required: true, message: '请选择 GitLab Project' }]}
              >
                <Select
                  showSearch={{ optionFilterProp: 'label' }}
                  loading={gitProjectsQuery.isFetching}
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
            <Button onClick={() => setRepositoryModalVisible(false)}>取消</Button>
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
        title={editingBuildSourceId ? '编辑构建源' : '添加构建源'}
        open={buildSourceModalVisible}
        footer={null}
        destroyOnHidden
        width={720}
        onCancel={() => {
          setBuildSourceModalVisible(false)
          setEditingBuildSourceId('')
          buildSourceForm.resetFields()
        }}
      >
        <Form
          form={buildSourceForm}
          layout="vertical"
          onFinish={(values) => {
            const sources = [...(runtime?.application.buildSources ?? [])]
            const source = { ...values, id: editingBuildSourceId || `source-${Date.now()}` }
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
                  setBuildSourceModalVisible(false)
                  setEditingBuildSourceId('')
                  buildSourceForm.resetFields()
                },
              },
            )
          }}
        >
          <div className="soha-application-service-form-grid">
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'repo_dockerfile', label: 'Repository Dockerfile' },
                  { value: 'platform_build_template', label: 'Platform Build Template' },
                  { value: 'external_pipeline', label: 'External Pipeline' },
                ]}
              />
            </Form.Item>
            <Form.Item name={['config', 'repositoryId']} label="代码仓库">
              <Select
                allowClear
                options={repositories.map((item) => ({ value: item.id, label: item.name }))}
              />
            </Form.Item>
            <Form.Item name="buildImage" label="构建镜像">
              <Input />
            </Form.Item>
            <Form.Item name="defaultTag" label="默认 Tag">
              <Input />
            </Form.Item>
            <Form.Item name={['config', 'dockerfilePath']} label="Dockerfile">
              <Input placeholder="Dockerfile" />
            </Form.Item>
            <Form.Item name={['config', 'contextDir']} label="构建上下文">
              <Input placeholder="." />
            </Form.Item>
            <Form.Item name={['config', 'buildTemplateId']} label="构建模板 ID">
              <Input />
            </Form.Item>
            <Form.Item name={['config', 'pipelineUrl']} label="外部流水线 URL">
              <Input />
            </Form.Item>
            <Form.Item name="isDefault" label="默认构建源" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
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
