import type { ReactNode } from 'react'
import { Alert, Button, Card, Space, Steps, Tag, Typography } from 'antd'
import { ArrowRightOutlined, BugOutlined, CheckCircleOutlined, CodeOutlined, ExperimentOutlined, FileTextOutlined, RobotOutlined, RocketOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { DeliveryTable } from '@/features/delivery/delivery-table'
import { api } from '@/services/api-client'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { ApiResponse, DeliveryApplication, DeliveryBlueprint, ExecutionTask, ReleaseBoardEntry, ReleaseBundle } from '@/types'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]

const BLOCKED_STATUSES = new Set(['failed', 'error', 'canceled', 'cancelled', 'timeout', 'rejected'])
const ACTIVE_STATUSES = new Set(['running', 'queued', 'pending', 'building', 'dispatching', 'waiting_approval', 'pending_approval'])
const READY_STATUSES = new Set(['completed', 'success', 'succeeded', 'ready', 'verified', 'published'])
const VERIFY_TASK_KINDS = new Set(['verify', 'validation', 'smoke_test', 'check', 'check_http', 'check_k8s_event'])

interface StatCardItem {
  label: string
  value: string | number
  hint: string
}

interface ActionCardItem {
  description: string
  icon: ReactNode
  label: string
  path: string
  type?: 'primary' | 'default'
}

interface OnboardingRow {
  app: DeliveryApplication
  bindings: ReleaseBoardEntry[]
  buildSourceCount: number
  nextStep: {
    color: string
    label: string
  }
  serviceClues: number
  targetCount: number
}

function normalizeStatus(value?: string) {
  return String(value || '').trim().toLowerCase()
}

function isBlockedStatus(value?: string) {
  return BLOCKED_STATUSES.has(normalizeStatus(value))
}

function isActiveStatus(value?: string) {
  return ACTIVE_STATUSES.has(normalizeStatus(value))
}

function isReadyStatus(value?: string) {
  return READY_STATUSES.has(normalizeStatus(value))
}

function workflowValidationCount(entry: ReleaseBoardEntry) {
  return entry.latestWorkflow?.nodeRuns?.filter((node) => {
    const type = String(node.type || '').toLowerCase()
    return VERIFY_TASK_KINDS.has(type) || type.includes('verify') || type.includes('check') || type.includes('smoke')
  }).length ?? 0
}

function executionTaskUpdatedAt(task: ExecutionTask) {
  return task.updatedAt || task.lastHeartbeatAt || task.finishedAt || task.startedAt || task.createdAt
}

function releaseBundleUpdatedAt(bundle: ReleaseBundle) {
  return bundle.updatedAt || bundle.createdAt
}

function sortByLatest<T>(items: T[], timeSelector: (item: T) => string | undefined) {
  return [...items].sort((left, right) => new Date(timeSelector(right) || 0).getTime() - new Date(timeSelector(left) || 0).getTime())
}

function WorkbenchHeader({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <div className="soha-delivery-workbench-header">
      <div className="soha-delivery-workbench-header__main">
        <h2 className="soha-delivery-workbench-header__title">{title}</h2>
        <Text type="secondary">{description}</Text>
      </div>
    </div>
  )
}

function StatCards({ items }: { items: StatCardItem[] }) {
  return (
    <div className="soha-delivery-workbench-stats">
      {items.map((item) => (
        <Card key={item.label} className="soha-application-signal-card" size="small">
          <span className="soha-application-signal-card__label">{item.label}</span>
          <strong>{item.value}</strong>
          <Text type="secondary">{item.hint}</Text>
        </Card>
      ))}
    </div>
  )
}

function ActionCards({ items }: { items: ActionCardItem[] }) {
  const navigate = useNavigate()
  return (
    <div className="soha-delivery-workbench-actions">
      {items.map((item) => (
        <Card key={item.label} className="soha-delivery-workbench-action-card" size="small">
          <div className="soha-delivery-workbench-action-card__icon">{item.icon}</div>
          <div className="soha-delivery-workbench-action-card__body">
            <Text strong>{item.label}</Text>
            <Text type="secondary">{item.description}</Text>
          </div>
          <Button
            icon={<ArrowRightOutlined />}
            type={item.type ?? 'default'}
            onClick={() => navigate(item.path)}
          >
            打开
          </Button>
        </Card>
      ))}
    </div>
  )
}

function OnboardingBoundaryCards() {
  const items = [
    { label: '应用档案', value: '项目 / 产品边界', description: '承载权限、业务线、仓库默认信息和一组服务组件。' },
    { label: '服务组件', value: '构建 / 部署 / 验证单元', description: '每个组件可以有独立构建源、容器、目标工作负载和验证规则。' },
    { label: '环境绑定', value: '交付目标', description: '把服务组件绑定到环境、发布目标和发布流程模板。审批由流程模板节点配置。' },
    { label: 'DeliveryDraft', value: '统一接入草稿', description: '手工配置与 AI 生成都先进入草稿预览，确认后再创建平台对象。' },
  ]

  return (
    <div className="soha-delivery-onboarding-boundary">
      <div className="soha-delivery-onboarding-boundary__title">
        <Text strong>接入对象边界</Text>
        <Text type="secondary">应用中心不是流程向导，应用接入负责把项目下的服务组件补齐为交付对象。</Text>
      </div>
      {items.map((item) => (
        <Card key={item.label} className="soha-delivery-onboarding-boundary__item" size="small">
          <Text type="secondary">{item.label}</Text>
          <Text strong>{item.value}</Text>
          <Text type="secondary">{item.description}</Text>
        </Card>
      ))}
    </div>
  )
}

function AiAssistCard({
  capabilities,
  description,
  title,
}: {
  capabilities: string[]
  description: string
  title: string
}) {
  return (
    <Card className="soha-delivery-workbench-ai-card" size="small">
      <Space align="start" size={12}>
        <RobotOutlined className="soha-delivery-workbench-ai-card__icon" />
        <Space orientation="vertical" size={8}>
          <Space size={8} wrap>
            <Text strong>{title}</Text>
            <Tag color="processing">可选增强</Tag>
          </Space>
          <Text type="secondary">{description}</Text>
          <Space size={6} wrap>
            {capabilities.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </Space>
        </Space>
      </Space>
    </Card>
  )
}

function ManualModeAlert({ description }: { description: string }) {
  return (
    <Alert
      showIcon
      type="info"
      title="常规模式保持完整可用"
      description={description}
    />
  )
}

function summarizeApplicationRepository(app: DeliveryApplication) {
  return app.repositoryPath || app.repositoryProjectId || app.repositoryProvider || '-'
}

function summarizeBuildSources(app: DeliveryApplication, bindings: ReleaseBoardEntry[]) {
  const sourceNames = [
    ...(app.buildSources ?? []).map((item) => item.name || item.type),
    ...bindings.map((item) => item.buildSource?.name || item.buildSourceId).filter(Boolean),
  ]
  const uniqueSources = Array.from(new Set(sourceNames.filter(Boolean)))
  return uniqueSources.length > 0 ? uniqueSources.join(' / ') : '-'
}

function summarizeEnvironmentBindings(bindings: ReleaseBoardEntry[]) {
  const environments = Array.from(new Set(bindings.map((item) => item.environmentName || item.environmentKey).filter(Boolean)))
  return environments.length > 0 ? environments.join(' / ') : '待绑定'
}

function countReleaseTargets(bindings: ReleaseBoardEntry[]) {
  return bindings.reduce((sum, item) => sum + (item.targets?.length ?? 0), 0)
}

function summarizeOnboardingNextStep(app: DeliveryApplication, bindings: ReleaseBoardEntry[]) {
  if ((app.buildSources?.length ?? 0) === 0) return { color: 'warning', label: '补构建源' }
  if (bindings.length === 0) return { color: 'warning', label: '绑定环境' }
  if (countReleaseTargets(bindings) === 0) return { color: 'processing', label: '补发布目标' }
  return { color: 'success', label: '可进入交付' }
}

export function DeliveryOnboardingPage() {
  const navigate = useNavigate()
  const applicationsQuery = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.get<ApiResponse<DeliveryApplication[]>>('/applications'),
  })
  const blueprintsQuery = useQuery({
    queryKey: ['delivery-blueprints'],
    queryFn: () => api.get<ApiResponse<DeliveryBlueprint[]>>('/delivery/blueprints'),
  })
  const releaseBoardQuery = useQuery({
    queryKey: ['delivery-release-board'],
    queryFn: () => api.get<ApiResponse<ReleaseBoardEntry[]>>('/delivery/release-board'),
  })

  const applications = applicationsQuery.data?.data ?? []
  const blueprints = blueprintsQuery.data?.data ?? []
  const board = releaseBoardQuery.data?.data ?? []
  const enabledBlueprints = blueprints.filter((item) => item.enabled)
  const boardByApplication = board.reduce<Record<string, ReleaseBoardEntry[]>>((acc, entry) => {
    acc[entry.applicationId] = [...(acc[entry.applicationId] ?? []), entry]
    return acc
  }, {})
  const onboardingRows: OnboardingRow[] = sortByLatest(applications, (item) => item.updatedAt).map((app) => {
    const bindings = boardByApplication[app.id] ?? []
    const buildSourceCount = app.buildSources?.length ?? 0
    const targetCount = countReleaseTargets(bindings)
    return {
      app,
      bindings,
      buildSourceCount,
      serviceClues: Math.max(buildSourceCount, bindings.length, targetCount, app.environmentCount ?? 0),
      targetCount,
      nextStep: summarizeOnboardingNextStep(app, bindings),
    }
  }).slice(0, 8)
  const needsCompletion = onboardingRows.filter((item) => item.nextStep.color !== 'success').length
  const onboardingStats = [
    { label: '应用档案', value: applications.length, hint: '作为项目 / 产品边界' },
    { label: '服务线索', value: onboardingRows.reduce((sum, item) => sum + item.serviceClues, 0), hint: '来自构建源、环境和目标' },
    { label: '接入模板', value: enabledBlueprints.length, hint: `${blueprints.length - enabledBlueprints.length} 个未启用模板` },
    { label: '待补齐', value: needsCompletion, hint: '缺构建源、环境或发布目标' },
  ]

  const loading = applicationsQuery.isLoading || blueprintsQuery.isLoading || releaseBoardQuery.isLoading

  const onboardingColumns: ColumnProps<OnboardingRow>[] = [
    {
      title: '项目 / 应用',
      dataIndex: ['app', 'name'],
      render: (_value, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.app.name}</Text>
          <Text type="secondary">{record.app.key}</Text>
        </Space>
      ),
    },
    { title: '仓库', dataIndex: ['app', 'repositoryPath'], render: (_value, record) => summarizeApplicationRepository(record.app) },
    {
      title: '服务线索',
      dataIndex: 'serviceClues',
      render: (value, record) => (
        <Space size={6} wrap>
          <Tag>{value} 个</Tag>
          <Tag>{record.buildSourceCount} 构建源</Tag>
          <Tag>{record.targetCount} 目标</Tag>
        </Space>
      ),
    },
    { title: '构建源', dataIndex: 'buildSourceCount', render: (_value, record) => summarizeBuildSources(record.app, record.bindings) },
    { title: '环境绑定', dataIndex: 'bindings', render: (_value, record) => summarizeEnvironmentBindings(record.bindings) },
    {
      title: '下一步',
      dataIndex: 'nextStep',
      render: (_value, record) => <Tag color={record.nextStep.color}>{record.nextStep.label}</Tag>,
    },
    { ...tableColumnPresets.datetime, title: '更新', dataIndex: ['app', 'updatedAt'], render: (_value, record) => formatDateTime(record.app.updatedAt) },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: ['app', 'id'],
      render: (_value, record) => (
        <Button size="small" type="link" icon={<ArrowRightOutlined />} onClick={() => navigate(`/applications/${record.app.id}`)}>
          配置服务
        </Button>
      ),
    },
  ]

  return (
    <div className="soha-page soha-delivery-workbench-page">
      <WorkbenchHeader
        title="应用 / 服务接入"
        description="把项目档案下的仓库和服务组件接入为可构建、可发布、可验证的交付对象；不是重复创建应用。"
      />
      <ManualModeAlert description="手工选择应用档案、服务组件、构建源、环境绑定和模板即可完成接入；AI Gateway 只负责辅助识别和生成草稿。" />
      <StatCards items={onboardingStats} />
      <OnboardingBoundaryCards />
      <div className="soha-delivery-workbench-grid">
        <Card className="soha-management-panel-card" title="接入路径" size="small">
          <Steps
            current={1}
            orientation="vertical"
            items={[
              { title: '选择应用档案', content: '新项目先建应用档案，已有项目直接选择应用后补服务组件。' },
              { title: '形成 DeliveryDraft', content: '手工填写或 AI 分析仓库后生成同一份服务、构建源和环境绑定草稿。' },
              { title: '预览并确认', content: '确认 Dockerfile、Helm / Deployment、审批和发布流程后再落库。' },
            ]}
          />
        </Card>
        <AiAssistCard
          title="AI Gateway 接入辅助"
          description="适合分析仓库语言、入口、服务拆分和构建方式，并生成 Dockerfile 与 Helm / Deployment 草稿；平台对象创建仍走确认后的常规 API。"
          capabilities={[
            'delivery.onboarding.analyze_repo',
            'delivery.standards.dockerfile.generate',
            'delivery.standards.helm.generate',
            'delivery.application.bootstrap',
          ]}
        />
      </div>
      <ActionCards
        items={[
          { label: '接入新服务', description: '进入应用中心选择项目档案，再维护服务组件、容器和构建源。', icon: <CodeOutlined />, path: '/applications', type: 'primary' },
          { label: '维护接入模板', description: '维护平台应用接入模板和规范文件草稿。', icon: <FileTextOutlined />, path: '/delivery/blueprints' },
          { label: '配置环境绑定', description: '绑定服务交付环境、发布目标、构建源和流程模板。', icon: <RocketOutlined />, path: '/application-environments' },
        ]}
      />
      {loading ? (
        <ManagementState kind="loading" />
      ) : onboardingRows.length > 0 ? (
        <DeliveryTable
          title="待接入服务线索"
          rowKey={(record: OnboardingRow) => record.app.id}
          dataSource={onboardingRows}
          pagination={false}
          loading={loading}
          showRefresh={false}
          columns={onboardingColumns}
        />
      ) : (
        <Card className="soha-management-panel-card">
          <ManagementState bordered={false} compact title="暂无服务线索" description="可以先创建应用档案，或从接入模板生成 DeliveryDraft。" />
        </Card>
      )}
    </div>
  )
}

export function DeliveryTestingPage() {
  const navigate = useNavigate()
  const bundlesQuery = useQuery({
    queryKey: ['release-bundles'],
    queryFn: () => api.get<ApiResponse<ReleaseBundle[]>>('/delivery/release-bundles'),
  })
  const tasksQuery = useQuery({
    queryKey: ['execution-tasks'],
    queryFn: () => api.get<ApiResponse<ExecutionTask[]>>('/delivery/execution-tasks'),
  })
  const releaseBoardQuery = useQuery({
    queryKey: ['delivery-release-board'],
    queryFn: () => api.get<ApiResponse<ReleaseBoardEntry[]>>('/delivery/release-board'),
  })

  const bundles = bundlesQuery.data?.data ?? []
  const tasks = tasksQuery.data?.data ?? []
  const board = releaseBoardQuery.data?.data ?? []
  const verifyTasks = tasks.filter((task) => {
    const taskKind = String(task.taskKind || '').toLowerCase()
    return VERIFY_TASK_KINDS.has(taskKind) || taskKind.includes('verify') || taskKind.includes('test') || taskKind.includes('check')
  })
  const candidateBundles = bundles.filter((bundle) => !isBlockedStatus(bundle.status))
  const latestBundles = sortByLatest(bundles, releaseBundleUpdatedAt).slice(0, 8)
  const testingStats = [
    { label: '候选版本', value: candidateBundles.length, hint: `${bundles.filter((item) => isReadyStatus(item.status)).length} 个已就绪` },
    { label: '验证任务', value: verifyTasks.length, hint: `${verifyTasks.filter((item) => isActiveStatus(item.status)).length} 个执行中` },
    { label: '阻塞证据', value: bundles.filter((item) => isBlockedStatus(item.status)).length + verifyTasks.filter((item) => isBlockedStatus(item.status)).length, hint: '来自版本包和验证任务' },
    { label: 'DAG 验证节点', value: board.reduce((sum, item) => sum + workflowValidationCount(item), 0), hint: '来自工作流节点执行记录' },
  ]
  const loading = bundlesQuery.isLoading || tasksQuery.isLoading || releaseBoardQuery.isLoading

  const columns: ColumnProps<ReleaseBundle>[] = [
    {
      title: '候选版本',
      dataIndex: 'version',
      render: (value: string, record: ReleaseBundle) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    { title: '应用', dataIndex: 'applicationId' },
    { title: '环境绑定', dataIndex: 'applicationEnvironmentId', render: (value: string) => value || '-' },
    { title: '来源', dataIndex: 'sourceType' },
    { title: '交付物', dataIndex: 'artifactRef', render: (value: string, record: ReleaseBundle) => value || record.artifactDigest || '-' },
    { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
    {
      title: '验证判断',
      dataIndex: 'status',
      render: (value: string) => isBlockedStatus(value)
        ? <Tag color="error">阻塞</Tag>
        : isReadyStatus(value)
          ? <Tag color="success">可晋级</Tag>
          : <Tag color="warning">待验证</Tag>,
    },
    { ...tableColumnPresets.datetime, title: '更新', dataIndex: 'updatedAt', render: (value: string) => formatDateTime(value) },
  ]

  return (
    <div className="soha-page soha-delivery-workbench-page">
      <WorkbenchHeader
        title="测试验证"
        description="面向测试人员聚合候选版本、验证任务、测试证据和晋级判断，AI 只在证据之上生成摘要和建议。"
      />
      <ManualModeAlert description="常规模式可以直接查看版本包、执行任务和发布看板；AI 摘要必须回链到版本包、任务日志或分析 run ID。" />
      <StatCards items={testingStats} />
      <ActionCards
        items={[
          { label: '查看版本包', description: '检查不可变候选版本和交付物元数据。', icon: <RocketOutlined />, path: '/delivery/release-bundles', type: 'primary' },
          { label: '查看执行任务', description: '查看验证任务、日志、回调和重试状态。', icon: <ExperimentOutlined />, path: '/delivery/execution-tasks' },
          { label: '查看构建发布', description: '按应用环境查看候选版本和门禁态势。', icon: <CheckCircleOutlined />, path: '/release-board' },
        ]}
      />
      <div className="soha-delivery-workbench-grid">
        <AiAssistCard
          title="AI Gateway 验证辅助"
          description="可以汇总版本、任务日志、diff 和验证证据，输出是否可晋级的建议；最终晋级仍由常规流程和审批决定。"
          capabilities={[
            'delivery-tester',
            'delivery.release.plan',
            'delivery.diff.summarize',
            'delivery.validation.evidence_summarize',
          ]}
        />
        <Card className="soha-management-panel-card" title="验证证据来源" size="small">
          <Steps
            current={2}
            orientation="vertical"
            items={[
              { title: '版本包', content: '固定版本号、镜像、digest 和来源。' },
              { title: '执行任务', content: '构建、发布、验证和回滚任务状态与日志。' },
              { title: '发布看板', content: '应用环境维度的候选版本、审批和目标状态。' },
            ]}
          />
        </Card>
      </div>
      <DeliveryTable
        title="候选版本与验证判断"
        rowKey="id"
        dataSource={latestBundles}
        loading={loading}
        refreshing={bundlesQuery.isFetching || tasksQuery.isFetching || releaseBoardQuery.isFetching}
        onRefresh={() => {
          void bundlesQuery.refetch()
          void tasksQuery.refetch()
          void releaseBoardQuery.refetch()
        }}
        columns={columns}
        actions={(
          <Button icon={<ExperimentOutlined />} onClick={() => navigate('/delivery/execution-tasks')}>
            查看验证任务
          </Button>
        )}
      />
    </div>
  )
}

export function DeliveryAnalysisPage() {
  const navigate = useNavigate()
  const tasksQuery = useQuery({
    queryKey: ['execution-tasks'],
    queryFn: () => api.get<ApiResponse<ExecutionTask[]>>('/delivery/execution-tasks'),
    refetchInterval: 5000,
  })
  const releaseBoardQuery = useQuery({
    queryKey: ['delivery-release-board'],
    queryFn: () => api.get<ApiResponse<ReleaseBoardEntry[]>>('/delivery/release-board'),
    refetchInterval: 5000,
  })
  const bundlesQuery = useQuery({
    queryKey: ['release-bundles'],
    queryFn: () => api.get<ApiResponse<ReleaseBundle[]>>('/delivery/release-bundles'),
  })

  const tasks = tasksQuery.data?.data ?? []
  const board = releaseBoardQuery.data?.data ?? []
  const bundles = bundlesQuery.data?.data ?? []
  const blockedBoard = board.filter((entry) =>
    isBlockedStatus(entry.latestBuild?.status)
    || isBlockedStatus(entry.latestWorkflow?.status)
    || isBlockedStatus(entry.latestExecutionTask?.status)
    || isBlockedStatus(entry.latestRelease?.status)
    || isBlockedStatus(entry.latestBundle?.status),
  )
  const failedTasks = tasks.filter((task) => isBlockedStatus(task.status))
  const recentTasks = sortByLatest(tasks, executionTaskUpdatedAt).slice(0, 10)
  const analysisStats = [
    { label: '失败任务', value: failedTasks.length, hint: `${tasks.filter((item) => isActiveStatus(item.status)).length} 个仍在执行` },
    { label: '阻塞环境', value: blockedBoard.length, hint: '来自发布看板状态聚合' },
    { label: '阻塞版本', value: bundles.filter((item) => isBlockedStatus(item.status)).length, hint: '来自版本包状态' },
    { label: '可重试任务', value: failedTasks.filter((item) => item.attemptCount < item.maxRetries).length, hint: '常规任务操作入口保留' },
  ]
  const loading = tasksQuery.isLoading || releaseBoardQuery.isLoading || bundlesQuery.isLoading

  const columns: ColumnProps<ExecutionTask>[] = [
    {
      title: '任务',
      dataIndex: 'taskKind',
      render: (value: string, record: ExecutionTask) => (
        <Space orientation="vertical" size={0}>
          <Space size={6} wrap>
            <Text strong>{value}</Text>
            {isBlockedStatus(record.status) ? <Tag color="error">需处理</Tag> : null}
          </Space>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    { title: '应用', dataIndex: 'applicationId' },
    { title: '环境绑定', dataIndex: 'applicationEnvironmentId', render: (value: string) => value || '-' },
    { title: '类型', dataIndex: 'providerKind', render: (value: string, record: ExecutionTask) => `${value} / ${record.targetKind}` },
    { title: '版本包', dataIndex: 'releaseBundleId', render: (value: string) => value || '-' },
    { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
    { title: '重试', dataIndex: 'attemptCount', render: (value: number, record: ExecutionTask) => `${value}/${record.maxRetries}` },
    { ...tableColumnPresets.datetime, title: '最近更新', dataIndex: 'updatedAt', render: (value: string) => formatDateTime(value) },
  ]

  return (
    <div className="soha-page soha-delivery-workbench-page">
      <WorkbenchHeader
        title="问题分析"
        description="聚合失败任务、阻塞环境、日志入口和影响面，面向开发与测试先给出可操作的常规排查入口。"
      />
      <ManualModeAlert description="常规模式保留任务日志、发布看板、版本包和重试入口；AI 分析只是对这些证据做摘要、归因和修复建议。" />
      <StatCards items={analysisStats} />
      <ActionCards
        items={[
          { label: '任务日志', description: '进入执行任务查看日志、结果、制品和重试操作。', icon: <BugOutlined />, path: '/delivery/execution-tasks', type: 'primary' },
          { label: '发布态势', description: '按应用环境查看构建、工作流、发布和审批状态。', icon: <RocketOutlined />, path: '/release-board' },
          { label: '版本证据', description: '核对版本包、artifact、digest 与生成来源。', icon: <FileTextOutlined />, path: '/delivery/release-bundles' },
        ]}
      />
      <div className="soha-delivery-workbench-grid">
        <AiAssistCard
          title="AI Gateway 故障分析"
          description="可在常规证据基础上汇总失败原因、影响范围和修复建议，适合发布失败、验证失败和 K8s 运行态问题。"
          capabilities={[
            'diagnosis.release_failure.analyze',
            'delivery-tester',
            'k8s-sre',
            'delivery.analysis.strategy',
          ]}
        />
        <Card className="soha-management-panel-card" title="分析闭环" size="small">
          <Steps
            current={1}
            orientation="vertical"
            items={[
              { title: '定位失败对象', content: '从失败任务或阻塞环境进入具体应用、环境和版本。' },
              { title: '收集证据', content: '查看任务日志、发布记录、K8s 事件、diff 和制品信息。' },
              { title: '修复并验证', content: '常规重试或重新触发验证，AI 建议必须回链证据。' },
            ]}
          />
        </Card>
      </div>
      <DeliveryTable
        title="最近任务与故障线索"
        rowKey="id"
        dataSource={recentTasks}
        loading={loading}
        refreshing={tasksQuery.isFetching || releaseBoardQuery.isFetching || bundlesQuery.isFetching}
        onRefresh={() => {
          void tasksQuery.refetch()
          void releaseBoardQuery.refetch()
          void bundlesQuery.refetch()
        }}
        columns={columns}
        actions={(
          <Button icon={<SafetyCertificateOutlined />} onClick={() => navigate('/release-board')}>
            查看影响面
          </Button>
        )}
      />
    </div>
  )
}
