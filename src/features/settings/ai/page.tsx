import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementIconButton, ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import type { WorkbenchAgentRun } from '@/features/copilot'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  PLAYBOOK_OPTIONS,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
  TRACES_BACKEND_OPTIONS,
  AGENT_RUNTIME_STATE_LABELS,
  agentCapabilityLabels,
  buildDataSourceFormValues,
  buildDataSourcePayload,
  buildPolicyFormValues,
  buildPolicyPayload,
  buildProfileFormValues,
  buildProfilePayload,
  resolveAgentRuntimeState,
  summarizeAgentProviderRuntime,
} from '../ai-settings-model'
import type {
  AgentProviderRuntimeRow,
  AgentRuntimeSummary,
  AIWorkbenchModelSettings,
  AISkillSetting,
  AnalysisProfile,
  AutomationPolicy,
  DataSource,
} from '../ai-settings-model'
import { settingsKeys } from '../keys'
import { settingsMutations } from '../mutations'
import { normalizeWorkbenchModelSettings, settingsQueries } from '../queries'
import {
  DEFAULT_FORM_LAYOUT,
  fullWidthStyle,
  SectionCallout,
  SettingsAdminTable,
  SettingsCard,
  TagSelect,
  WIDE_FORM_LAYOUT,
} from '../shared/components'
import type { SettingsPageProps } from '../types'
import '../shared/styles.css'
import './styles.css'

/* ─── AI Settings ─── */

type AIGradientTagTone = 'amber' | 'blue' | 'green' | 'slate' | 'violet'

function AIGradientTag({
  children,
  tone = 'slate',
}: {
  children: ReactNode
  tone?: AIGradientTagTone
}) {
  return <Tag className={`soha-ai-gradient-tag is-${tone}`}>{children}</Tag>
}

function agentRuntimeStateTone(state?: string): AIGradientTagTone {
  switch ((state || '').toLowerCase()) {
    case 'connected':
    case 'healthy':
    case 'idle':
    case 'in-process':
    case 'observed':
    case 'ready':
    case 'running':
      return 'green'
    case 'queued':
    case 'waiting':
    case 'unknown':
      return 'amber'
    case 'error':
    case 'failed':
    case 'unavailable':
      return 'violet'
    default:
      return 'slate'
  }
}

function agentRuntimeStateTag(state?: string) {
  const normalized = (state || 'unknown').toLowerCase()
  return (
    <AIGradientTag tone={agentRuntimeStateTone(normalized)}>
      {AGENT_RUNTIME_STATE_LABELS[normalized] || normalized}
    </AIGradientTag>
  )
}

function renderAgentTagList(values?: string[], max = 4, tone: AIGradientTagTone = 'slate') {
  const items = (values ?? []).filter(Boolean)
  if (items.length === 0) return '-'
  return (
    <div className="flex flex-wrap gap-1">
      {items.slice(0, max).map((item) => (
        <AIGradientTag key={item} tone={tone}>
          {item}
        </AIGradientTag>
      ))}
      {items.length > max ? (
        <AIGradientTag tone={tone}>{`+${items.length - max}`}</AIGradientTag>
      ) : null}
    </div>
  )
}

export function AISettingsPage({ embedded = false }: SettingsPageProps = {}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [workbenchModelForm] = Form.useForm<AIWorkbenchModelSettings>()
  const [dataSourceModalVisible, setDataSourceModalVisible] = useState(false)
  const [profileModalVisible, setProfileModalVisible] = useState(false)
  const [policyModalVisible, setPolicyModalVisible] = useState(false)
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null)
  const [editingProfile, setEditingProfile] = useState<AnalysisProfile | null>(null)
  const [editingPolicy, setEditingPolicy] = useState<AutomationPolicy | null>(null)
  const [skillsModalVisible, setSkillsModalVisible] = useState(false)
  const [editingSkill, setEditingSkill] = useState<AISkillSetting | null>(null)
  const [skillsRegistryDraft, setSkillsRegistryDraft] = useState<AISkillSetting[]>([])
  const [dataSourceSourceKind, setDataSourceSourceKind] = useState('logs')
  const [dataSourceBackendType, setDataSourceBackendType] = useState('es')
  const canViewAISettings = hasPermission(permissionSnapshotQuery.data?.data, 'settings.ai.view')
  const canManageAISettings = hasPermission(
    permissionSnapshotQuery.data?.data,
    'settings.ai.manage',
  )
  const canViewAgentRuns = hasPermission(permissionSnapshotQuery.data?.data, 'observe.ai.view')

  useEffect(() => {
    if (dataSourceModalVisible && editingDataSource) {
      setDataSourceSourceKind(editingDataSource.sourceKind)
      setDataSourceBackendType(editingDataSource.backendType)
      return
    }
    if (dataSourceModalVisible && !editingDataSource) {
      setDataSourceSourceKind('logs')
      setDataSourceBackendType('es')
    }
  }, [dataSourceModalVisible, editingDataSource])

  const { data, isLoading } = useQuery(settingsQueries.ai.detail())
  const modelRoutesQuery = useQuery(settingsQueries.ai.modelRoutes(canViewAISettings))
  const dataSourcesQuery = useQuery(settingsQueries.ai.dataSources())
  const profilesQuery = useQuery(settingsQueries.ai.analysisProfiles())
  const policiesQuery = useQuery(settingsQueries.ai.automationPolicies())
  const capabilitiesQuery = useQuery(settingsQueries.ai.dataSourceCapabilities())
  const workbenchCatalogQuery = useQuery(settingsQueries.ai.workbenchCatalog(canViewAISettings))
  const agentRunsQuery = useQuery(
    settingsQueries.ai.agentRuns(canViewAISettings && canViewAgentRuns),
  )

  const saveWorkbenchModelMutation = useMutation(
    settingsMutations.ai.saveWorkbenchModel(queryClient),
  )
  const saveSkillsMutation = useMutation(settingsMutations.ai.saveSkills(queryClient))
  const dataSourceMutation = useMutation(settingsMutations.ai.upsertDataSource(queryClient))
  const validateDataSourceMutation = useMutation(
    settingsMutations.ai.validateDataSource(queryClient),
  )
  const profileMutation = useMutation(settingsMutations.ai.upsertAnalysisProfile(queryClient))
  const policyMutation = useMutation(settingsMutations.ai.upsertAutomationPolicy(queryClient))

  const saveWorkbenchModel = (values: AIWorkbenchModelSettings) =>
    saveWorkbenchModelMutation.mutate(values, {
      onSuccess: () => void message.success('Workbench 默认模型已保存'),
      onError: (err) => void message.error(err.message),
    })
  const saveSkills = () =>
    saveSkillsMutation.mutate(skillsRegistryDraft, {
      onSuccess: () => void message.success('Skills registry 已保存'),
      onError: (err) => void message.error(err.message),
    })
  const saveDataSource = (input: { id?: string; values: Record<string, unknown> }) =>
    dataSourceMutation.mutate(
      { ...input, values: buildDataSourcePayload(input.values) },
      {
        onSuccess: () => {
          void message.success('数据源已保存')
          setDataSourceModalVisible(false)
          setEditingDataSource(null)
          setDataSourceBackendType('es')
        },
        onError: (err) => void message.error(err.message),
      },
    )
  const validateDataSource = (dataSourceID: string) =>
    validateDataSourceMutation.mutate(dataSourceID, {
      onSuccess: () => void message.success('数据源校验通过'),
      onError: (err) => void message.error(err.message),
    })
  const saveProfile = (input: { id?: string; values: Record<string, unknown> }) =>
    profileMutation.mutate(
      { ...input, values: buildProfilePayload(input.values) },
      {
        onSuccess: () => {
          void message.success('分析模板已保存')
          setProfileModalVisible(false)
          setEditingProfile(null)
        },
        onError: (err) => void message.error(err.message),
      },
    )
  const savePolicy = (input: { id?: string; values: Record<string, unknown> }) =>
    policyMutation.mutate(
      { ...input, values: buildPolicyPayload(input.values) },
      {
        onSuccess: () => {
          void message.success('自动化策略已保存')
          setPolicyModalVisible(false)
          setEditingPolicy(null)
        },
        onError: (err) => void message.error(err.message),
      },
    )

  const settings = data
  const modelRoutes = modelRoutesQuery.data ?? []
  const enabledModelRoutes = modelRoutes.filter((route) => route.enabled)
  const routeOptions = enabledModelRoutes.map((route) => ({
    value: route.id,
    label: `${route.publicModel} / ${route.id}`,
  }))
  const publicModelOptions = [
    ...new Map(
      enabledModelRoutes
        .filter((route) => route.publicModel)
        .map((route) => [
          route.publicModel,
          { value: route.publicModel, label: route.publicModel },
        ]),
    ).values(),
  ]
  const selectedRoute = enabledModelRoutes.find(
    (route) => route.id === settings?.workbenchModel?.defaultRouteId,
  )
  const agentProviders = workbenchCatalogQuery.data?.agentProviders ?? []
  const agentCapabilities = workbenchCatalogQuery.data?.capabilities ?? []
  const agentRuns = agentRunsQuery.data ?? []
  const agentProviderRows = useMemo<AgentProviderRuntimeRow[]>(
    () =>
      agentProviders.map((provider) => {
        const runtimeSummary = summarizeAgentProviderRuntime(provider, agentRuns)
        return {
          ...provider,
          runtimeSummary,
          runtimeState: resolveAgentRuntimeState(provider, runtimeSummary),
        }
      }),
    [agentProviders, agentRuns],
  )

  useEffect(() => {
    workbenchModelForm.setFieldsValue(normalizeWorkbenchModelSettings(settings?.workbenchModel))
    setSkillsRegistryDraft(
      (settings?.skillsRegistry ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        ownerModule: item.ownerModule,
        description: item.description,
        enabled: item.enabled,
        scopes: item.scopes ?? [],
        capabilityRefs: item.capabilityRefs ?? [],
        blueprintRefs: item.blueprintRefs ?? [],
        scopeRules: item.scopeRules ?? [],
        inputSchema: item.inputSchema ?? {},
        outputSchema: item.outputSchema ?? {},
      })),
    )
  }, [settings?.skillsRegistry, settings?.workbenchModel, workbenchModelForm])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  if (!canViewAISettings) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有查看 AI 设置的权限。" />
      </div>
    )
  }

  const dataSources = dataSourcesQuery.data ?? []
  const profiles = profilesQuery.data ?? []
  const policies = policiesQuery.data ?? []
  const capabilityOptions = capabilitiesQuery.data ?? []
  const filteredCapabilityOptions = capabilityOptions.filter(
    (item) => item.sourceKind === dataSourceSourceKind,
  )
  const backendOptions =
    dataSourceSourceKind === 'logs'
      ? [
          { value: 'es', label: 'es' },
          { value: 'loki', label: 'loki' },
          { value: 'clickhouse', label: 'clickhouse' },
        ]
      : dataSourceSourceKind === 'metrics'
        ? [{ value: 'prometheus', label: 'prometheus' }]
        : dataSourceSourceKind === 'traces'
          ? TRACES_BACKEND_OPTIONS
          : [{ value: 'platform', label: 'platform' }]

  const dataSourceColumns: TableColumnsType<DataSource> = [
    { title: '名称', dataIndex: 'name' },
    { title: '能力层', dataIndex: 'mcpAdapter' },
    {
      title: '源类型',
      dataIndex: 'sourceKind',
      render: (value: string, record: DataSource) => `${value} / ${record.backendType}`,
    },
    {
      title: '校验状态',
      dataIndex: 'validationStatus',
      render: (value: string | undefined, record: DataSource) => {
        const isPending =
          validateDataSourceMutation.isPending && validateDataSourceMutation.variables === record.id
        if (isPending) return <Tag color="orange">校验中</Tag>
        if (!value) return <Tag color="default">未校验</Tag>
        const normalized = value.toLowerCase()
        const color =
          normalized === 'success' ? 'green' : normalized === 'error' ? 'red' : 'default'
        const label = normalized === 'success' ? '已通过' : normalized === 'error' ? '失败' : value
        return (
          <div className="flex max-w-[240px] flex-col gap-1">
            <Tag color={color}>{label}</Tag>
            {record.validationMessage && normalized === 'error' ? (
              <div className="text-xs text-[var(--ant-colorTextSecondary)]">
                {record.validationMessage}
              </div>
            ) : null}
          </div>
        )
      },
    },
    {
      title: '最近校验',
      dataIndex: 'lastValidatedAt',
      render: (value: string | undefined) => (value ? formatDateTime(value) : '-'),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (value: boolean) => <StatusTag value={value ? 'success' : 'default'} />,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: DataSource) =>
        canManageAISettings ? (
          <Space className="soha-row-action-icons">
            <ManagementIconButton
              aria-label="校验数据源连接"
              tooltip="校验连接"
              icon={<CheckCircleOutlined />}
              loading={
                validateDataSourceMutation.isPending &&
                validateDataSourceMutation.variables === record.id
              }
              size="small"
              onClick={() => validateDataSource(record.id)}
            />
            <ManagementIconButton
              aria-label="编辑数据源"
              tooltip="编辑"
              icon={<EditOutlined />}
              size="small"
              onClick={() => {
                setEditingDataSource(record)
                setDataSourceSourceKind(record.sourceKind)
                setDataSourceBackendType(record.backendType)
                setDataSourceModalVisible(true)
              }}
            />
          </Space>
        ) : (
          '-'
        ),
    },
  ]

  const profileColumns: TableColumnsType<AnalysisProfile> = [
    { title: '名称', dataIndex: 'name' },
    { title: '模式', dataIndex: 'mode' },
    {
      title: '数据源',
      dataIndex: 'enabledSources',
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {(value ?? []).map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: 'Playbooks',
      dataIndex: 'enabledPlaybooks',
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {(value ?? []).map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
        </div>
      ),
    },
    { title: '策略', dataIndex: 'remediationPolicy' },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: AnalysisProfile) =>
        canManageAISettings ? (
          <ManagementIconButton
            aria-label="编辑分析模板"
            tooltip="编辑"
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              setEditingProfile(record)
              setProfileModalVisible(true)
            }}
          />
        ) : (
          '-'
        ),
    },
  ]

  const policyColumns: TableColumnsType<AutomationPolicy> = [
    { title: '名称', dataIndex: 'name' },
    { title: '触发类型', dataIndex: 'triggerType' },
    { title: '分析模板', dataIndex: 'analysisProfileId' },
    { title: 'Dedup(s)', dataIndex: 'dedupWindowSeconds' },
    { title: '策略', dataIndex: 'remediationPolicy' },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (value: boolean) => <StatusTag value={value ? 'success' : 'default'} />,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: AutomationPolicy) =>
        canManageAISettings ? (
          <ManagementIconButton
            aria-label="编辑自动化策略"
            tooltip="编辑"
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              setEditingPolicy(record)
              setPolicyModalVisible(true)
            }}
          />
        ) : (
          '-'
        ),
    },
  ]

  const agentProviderColumns: TableColumnsType<AgentProviderRuntimeRow> = [
    {
      title: 'Provider',
      dataIndex: 'name',
      width: 220,
      render: (_: unknown, record) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{record.name}</span>
          <span className="text-xs text-[var(--ant-colorTextSecondary)]">
            {record.id} / {record.kind}
          </span>
        </div>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 92,
      render: (value: boolean) => <StatusTag value={value ? 'enabled' : 'disabled'} />,
    },
    {
      title: 'Runtime',
      dataIndex: 'runtimeState',
      width: 120,
      render: (value: string, record) => (
        <div className="flex flex-col gap-1">
          <span>{agentRuntimeStateTag(value)}</span>
          {record.runtimeStatus?.reason ? (
            <span className="text-xs text-[var(--ant-colorTextSecondary)]">
              {record.runtimeStatus.reason}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      title: '队列 / 运行 / 失败',
      dataIndex: 'runtimeSummary',
      width: 150,
      render: (summary: AgentRuntimeSummary) =>
        `${summary.queuedRuns} / ${summary.runningRuns} / ${summary.recentFailures}`,
    },
    {
      title: 'Runner',
      dataIndex: 'runtimeSummary',
      width: 160,
      render: (summary: AgentRuntimeSummary) =>
        summary.lastAgentId ? (
          <AIGradientTag tone="green">{summary.lastAgentId}</AIGradientTag>
        ) : (
          '-'
        ),
    },
    {
      title: '能力',
      dataIndex: 'capabilities',
      render: (value: string[]) =>
        renderAgentTagList(agentCapabilityLabels(value, agentCapabilities), 5, 'blue'),
    },
    {
      title: '边界',
      dataIndex: 'id',
      width: 190,
      render: (_: unknown, record) => (
        <div className="flex flex-wrap gap-1">
          <AIGradientTag tone={record.supportsAsync ? 'violet' : 'slate'}>
            {record.supportsAsync ? 'async' : 'sync'}
          </AIGradientTag>
          {record.supportsSkills ? <AIGradientTag tone="blue">skills</AIGradientTag> : null}
          {record.supportsToolsets ? <AIGradientTag tone="green">toolsets</AIGradientTag> : null}
        </div>
      ),
    },
    {
      title: '最近活动',
      dataIndex: 'runtimeSummary',
      width: 210,
      render: (summary: AgentRuntimeSummary) => {
        const activity =
          summary.lastHeartbeatAt ||
          summary.lastCompletedAt ||
          summary.lastRun?.updatedAt ||
          summary.lastRun?.createdAt
        return activity ? formatDateTime(activity) : '-'
      },
    },
  ]

  const agentRunColumns: TableColumnsType<WorkbenchAgentRun> = [
    {
      title: 'Run',
      dataIndex: 'id',
      width: 190,
      render: (value: string, record) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{value}</span>
          {record.sessionId ? (
            <span className="text-xs text-[var(--ant-colorTextSecondary)]">
              session: {record.sessionId}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Provider',
      dataIndex: 'providerId',
      width: 130,
      render: (value: string, record) => value || record.providerKind || '-',
    },
    { title: '能力', dataIndex: 'capabilityId', width: 150 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: 'Runner',
      dataIndex: 'claimedByAgentId',
      width: 170,
      render: (value?: string) =>
        value ? <AIGradientTag tone="green">{value}</AIGradientTag> : '-',
    },
    {
      title: '心跳',
      dataIndex: 'lastHeartbeatAt',
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: '完成',
      dataIndex: 'completedAt',
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: '错误',
      dataIndex: 'errorMessage',
      render: (value?: string) => value || '-',
    },
  ]

  const workbenchModelCard = (
    <section data-testid="ai-workbench-model-section" className="soha-settings-table-section">
      <SettingsCard
        title="Workbench 默认模型"
        extra={
          <Space>
            <Button
              icon={<LinkOutlined />}
              onClick={() => navigate('/ai-gateway/relay?tab=upstreams')}
            >
              上游管理
            </Button>
            <Button
              icon={<LinkOutlined />}
              onClick={() => navigate('/ai-gateway/relay?tab=model-routes')}
            >
              模型路由
            </Button>
          </Space>
        }
      >
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 16 }}
          title="模型 Provider 在 AI Gateway 管理。这里仅选择 AI Workbench 的默认模型和 Agent Runtime 使用策略。"
        />
        <Form
          data-testid="ai-workbench-model-form"
          form={workbenchModelForm}
          {...WIDE_FORM_LAYOUT}
          initialValues={normalizeWorkbenchModelSettings(settings?.workbenchModel)}
          onFinish={(values) => {
            if (!canManageAISettings) return
            saveWorkbenchModel(normalizeWorkbenchModelSettings(values))
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="defaultPublicModel" label="默认 public model">
                <Select
                  allowClear
                  showSearch={{ optionFilterProp: 'label' }}
                  loading={modelRoutesQuery.isLoading}
                  options={publicModelOptions}
                  placeholder="从 Gateway model routes 选择"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="defaultRouteId" label="默认 route">
                <Select
                  allowClear
                  showSearch={{ optionFilterProp: 'label' }}
                  loading={modelRoutesQuery.isLoading}
                  options={routeOptions}
                  placeholder="优先使用稳定 route id"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="defaultEndpoint" label="默认 endpoint">
                <Select
                  options={[
                    { value: 'chat/completions', label: 'chat/completions' },
                    { value: 'responses', label: 'responses' },
                    { value: 'messages', label: 'messages' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="enabled" label="启用 Workbench 模型" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <div className="mb-4 flex flex-wrap gap-2">
            <AIGradientTag tone={selectedRoute ? 'green' : 'slate'}>
              {selectedRoute ? `route: ${selectedRoute.id}` : '未选择 route'}
            </AIGradientTag>
            <AIGradientTag tone={settings?.workbenchModel?.defaultPublicModel ? 'blue' : 'slate'}>
              {settings?.workbenchModel?.defaultPublicModel || '未选择 public model'}
            </AIGradientTag>
            <AIGradientTag tone="violet">{enabledModelRoutes.length} active routes</AIGradientTag>
          </div>
          {canManageAISettings ? (
            <div className="soha-form-actions">
              <Button
                htmlType="submit"
                type="primary"
                loading={saveWorkbenchModelMutation.isPending}
              >
                保存默认模型
              </Button>
            </div>
          ) : null}
        </Form>
      </SettingsCard>
    </section>
  )

  const agentRuntimeCard = (
    <section data-testid="ai-agent-runtime-section" className="soha-settings-table-section">
      <SettingsAdminTable
        data-testid="ai-agent-provider-table"
        headerExtra={
          <Button
            icon={<ReloadOutlined />}
            loading={workbenchCatalogQuery.isFetching || agentRunsQuery.isFetching}
            size="small"
            onClick={() => {
              void queryClient.invalidateQueries({
                queryKey: settingsKeys.ai.workbenchCatalog(),
              })
              void queryClient.invalidateQueries({
                queryKey: settingsKeys.ai.agentRuns(),
              })
            }}
          >
            刷新
          </Button>
        }
        rowKey="id"
        tableSize="small"
        pagination={false}
        loading={workbenchCatalogQuery.isLoading}
        dataSource={agentProviderRows}
        columns={agentProviderColumns}
        empty={
          <ManagementState
            bordered={false}
            compact
            title="暂无 Agent Runtime Provider"
            description="后端 catalog 暂未返回可用于 AI Workbench 的 Agent Provider。"
          />
        }
      />
      <div className="soha-ai-settings-subhead">
        <span>Recent AgentRuns</span>
        <AIGradientTag tone="green">claim / callback</AIGradientTag>
      </div>
      {canViewAgentRuns ? (
        <SettingsAdminTable
          data-testid="ai-agent-run-table"
          rowKey="id"
          tableSize="small"
          pageSize={5}
          loading={agentRunsQuery.isLoading}
          dataSource={agentRuns}
          columns={agentRunColumns}
          empty={
            <ManagementState
              bordered={false}
              compact
              title="暂无 AgentRun"
              description="选择 Hermes 等 Agent Provider 发起显式分析后，Runner claim/callback 记录会出现在这里。"
            />
          }
        />
      ) : (
        <ManagementState
          bordered={false}
          compact
          kind="no-permission"
          title="无法查看 AgentRun 历史"
          description="当前账号缺少 observe.ai.view 权限，只能查看 Agent Provider catalog。"
        />
      )}
    </section>
  )

  const content = (
    <>
      {workbenchModelCard}
      {agentRuntimeCard}
      <div className="soha-settings-table-section">
        <SettingsAdminTable
          headerExtra={
            canManageAISettings ? (
              <Space>
                <Button
                  onClick={() => {
                    setEditingSkill(null)
                    setSkillsModalVisible(true)
                  }}
                >
                  新增
                </Button>
                <Button
                  type="primary"
                  loading={saveSkillsMutation.isPending}
                  onClick={() => saveSkills()}
                >
                  保存 Skills
                </Button>
              </Space>
            ) : null
          }
          rowKey="id"
          dataSource={skillsRegistryDraft}
          empty={
            <ManagementState
              bordered={false}
              compact
              title="暂无全局 Skills"
              description="可先新增 MCP、logs、metrics、traces 这类技能条目。"
            />
          }
          columns={[
            { title: 'ID', dataIndex: 'id' },
            { title: '名称', dataIndex: 'name' },
            {
              title: '分类',
              dataIndex: 'category',
              render: (value?: string) => value || '-',
            },
            {
              title: '归属模块',
              dataIndex: 'ownerModule',
              render: (value?: string) => value || '-',
            },
            {
              title: '说明',
              dataIndex: 'description',
              render: (value?: string) => value || '-',
            },
            {
              title: '作用域',
              dataIndex: 'scopes',
              render: (value?: string[]) => (
                <div className="flex flex-wrap gap-1">
                  {(value ?? []).map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </div>
              ),
            },
            {
              title: '能力引用',
              dataIndex: 'capabilityRefs',
              render: (value?: string[]) => (
                <div className="flex flex-wrap gap-1">
                  {(value ?? []).slice(0, 3).map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </div>
              ),
            },
            {
              title: '启用',
              dataIndex: 'enabled',
              render: (value: boolean) => <StatusTag value={value ? 'enabled' : 'disabled'} />,
            },
            {
              title: '排序',
              dataIndex: 'id',
              render: (_: unknown, record: AISkillSetting) =>
                canManageAISettings ? (
                  <Space className="soha-row-action-icons">
                    <ManagementIconButton
                      aria-label="上移 Skill"
                      tooltip="上移"
                      icon={<ArrowUpOutlined />}
                      size="small"
                      disabled={skillsRegistryDraft[0]?.id === record.id}
                      onClick={() => {
                        setSkillsRegistryDraft((current) => {
                          const index = current.findIndex((item) => item.id === record.id)
                          if (index <= 0) return current
                          const next = [...current]
                          ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                          return next
                        })
                      }}
                    />
                    <ManagementIconButton
                      aria-label="下移 Skill"
                      tooltip="下移"
                      icon={<ArrowDownOutlined />}
                      size="small"
                      disabled={
                        skillsRegistryDraft[skillsRegistryDraft.length - 1]?.id === record.id
                      }
                      onClick={() => {
                        setSkillsRegistryDraft((current) => {
                          const index = current.findIndex((item) => item.id === record.id)
                          if (index < 0 || index >= current.length - 1) return current
                          const next = [...current]
                          ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                          return next
                        })
                      }}
                    />
                  </Space>
                ) : (
                  '-'
                ),
            },
            {
              ...tableColumnPresets.action,
              title: '操作',
              dataIndex: 'id',
              render: (_: unknown, record: AISkillSetting) =>
                canManageAISettings ? (
                  <Space className="soha-row-action-icons">
                    <ManagementIconButton
                      aria-label="编辑 Skill"
                      tooltip="编辑"
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => {
                        setEditingSkill(record)
                        setSkillsModalVisible(true)
                      }}
                    />
                    <Popconfirm
                      title="确认删除 Skill？"
                      description="删除后会从当前草稿列表移除，保存设置后生效。"
                      okButtonProps={{ danger: true }}
                      onConfirm={() =>
                        setSkillsRegistryDraft((current) =>
                          current.filter((item) => item.id !== record.id),
                        )
                      }
                    >
                      <ManagementIconButton
                        aria-label="删除 Skill"
                        tooltip="删除"
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                      />
                    </Popconfirm>
                  </Space>
                ) : (
                  '-'
                ),
            },
          ]}
        />
      </div>
      <div className="soha-settings-table-section">
        <SettingsAdminTable
          headerExtra={
            canManageAISettings ? (
              <Button
                type="primary"
                onClick={() => {
                  setEditingDataSource(null)
                  setDataSourceSourceKind('logs')
                  setDataSourceBackendType('es')
                  setDataSourceModalVisible(true)
                }}
              >
                新增
              </Button>
            ) : null
          }
          columns={dataSourceColumns}
          dataSource={dataSources}
          rowKey="id"
          loading={dataSourcesQuery.isLoading}
        />
      </div>
      <div className="soha-settings-table-section">
        <SettingsAdminTable
          headerExtra={
            canManageAISettings ? (
              <Button
                type="primary"
                onClick={() => {
                  setEditingProfile(null)
                  setProfileModalVisible(true)
                }}
              >
                新增
              </Button>
            ) : null
          }
          columns={profileColumns}
          dataSource={profiles}
          rowKey="id"
          loading={profilesQuery.isLoading}
        />
      </div>
      <div className="soha-settings-table-section">
        <SettingsAdminTable
          headerExtra={
            canManageAISettings ? (
              <Button
                type="primary"
                onClick={() => {
                  setEditingPolicy(null)
                  setPolicyModalVisible(true)
                }}
              >
                新增
              </Button>
            ) : null
          }
          columns={policyColumns}
          dataSource={policies}
          rowKey="id"
          loading={policiesQuery.isLoading}
        />
      </div>

      <Modal
        title={editingSkill ? '编辑 Skill' : '新增 Skill'}
        open={skillsModalVisible}
        footer={null}
        onCancel={() => {
          setSkillsModalVisible(false)
          setEditingSkill(null)
        }}
        destroyOnHidden
      >
        <Form
          {...DEFAULT_FORM_LAYOUT}
          initialValues={{
            id: editingSkill?.id ?? '',
            name: editingSkill?.name ?? '',
            category: editingSkill?.category ?? '',
            ownerModule: editingSkill?.ownerModule ?? '',
            description: editingSkill?.description ?? '',
            enabled: editingSkill?.enabled ?? true,
            scopes: editingSkill?.scopes ?? [],
            capabilityRefs: editingSkill?.capabilityRefs ?? [],
            blueprintRefs: editingSkill?.blueprintRefs ?? [],
            scopeRules: editingSkill?.scopeRules ?? [],
            inputSchemaText: JSON.stringify(editingSkill?.inputSchema ?? {}, null, 2),
            outputSchemaText: JSON.stringify(editingSkill?.outputSchema ?? {}, null, 2),
          }}
          onFinish={(values) => {
            let inputSchema: Record<string, unknown>
            let outputSchema: Record<string, unknown>
            try {
              inputSchema = values.inputSchemaText ? JSON.parse(String(values.inputSchemaText)) : {}
              outputSchema = values.outputSchemaText
                ? JSON.parse(String(values.outputSchemaText))
                : {}
            } catch {
              void message.error('Input/Output Schema 需要是合法 JSON')
              return
            }
            const next: AISkillSetting = {
              id: String(values.id ?? '').trim(),
              name: String(values.name ?? '').trim(),
              category: String(values.category ?? '').trim(),
              ownerModule: String(values.ownerModule ?? '').trim(),
              description: String(values.description ?? '').trim(),
              enabled: Boolean(values.enabled),
              scopes: Array.isArray(values.scopes) ? (values.scopes as string[]) : [],
              capabilityRefs: Array.isArray(values.capabilityRefs)
                ? (values.capabilityRefs as string[])
                : [],
              blueprintRefs: Array.isArray(values.blueprintRefs)
                ? (values.blueprintRefs as string[])
                : [],
              scopeRules: Array.isArray(values.scopeRules) ? (values.scopeRules as string[]) : [],
              inputSchema,
              outputSchema,
            }
            if (!next.id || !next.name) {
              void message.error('Skill ID 和名称不能为空')
              return
            }
            const duplicate = skillsRegistryDraft.find(
              (item) => item.id === next.id && item.id !== editingSkill?.id,
            )
            if (duplicate) {
              void message.error(`Skill ID 已存在: ${next.id}`)
              return
            }
            setSkillsRegistryDraft((current) => {
              const rest = current.filter((item) => item.id !== next.id)
              return [...rest, next]
            })
            setSkillsModalVisible(false)
            setEditingSkill(null)
          }}
        >
          <Form.Item name="id" label="ID" rules={[{ required: true, message: '请输入 ID' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="delivery / observability / platform" />
          </Form.Item>
          <Form.Item name="ownerModule" label="归属模块">
            <Input placeholder="delivery / ai / monitoring" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="scopes" label="作用域">
            <TagSelect mode="tags" />
          </Form.Item>
          <Form.Item name="capabilityRefs" label="能力引用">
            <TagSelect mode="tags" />
          </Form.Item>
          <Form.Item name="blueprintRefs" label="蓝图引用">
            <TagSelect mode="tags" />
          </Form.Item>
          <Form.Item name="scopeRules" label="范围规则">
            <TagSelect mode="tags" />
          </Form.Item>
          <Form.Item name="inputSchemaText" label="Input Schema(JSON)">
            <Input.TextArea rows={4} spellCheck={false} />
          </Form.Item>
          <Form.Item name="outputSchemaText" label="Output Schema(JSON)">
            <Input.TextArea rows={4} spellCheck={false} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div className="text-sm text-[var(--ant-colorTextSecondary)]">
            ID 需要在全局 registry 中唯一；作用域用于提示这个 skill
            主要服务于哪些工作区或资源，不直接替代权限判断。
          </div>
          <div className="soha-form-actions">
            <Button
              onClick={() => {
                setSkillsModalVisible(false)
                setEditingSkill(null)
              }}
            >
              取消
            </Button>
            <Button htmlType="submit" type="primary">
              保存
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={editingDataSource ? '编辑数据源' : '新增数据源'}
        open={dataSourceModalVisible}
        footer={null}
        onCancel={() => {
          setDataSourceModalVisible(false)
          setEditingDataSource(null)
          setDataSourceSourceKind('logs')
          setDataSourceBackendType('es')
        }}
        destroyOnHidden
      >
        <Form
          {...DEFAULT_FORM_LAYOUT}
          initialValues={buildDataSourceFormValues(editingDataSource)}
          onFinish={(values) => {
            if (!canManageAISettings) return
            saveDataSource({
              id: editingDataSource?.id,
              values: values as Record<string, unknown>,
            })
          }}
        >
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <SectionCallout
            title="1. 基础信息"
            description="先选择数据源的能力类别和后端类型，再填写连接与查询约束。"
          />
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sourceKind" label="源类型">
            <Select
              options={[
                { value: 'logs', label: 'logs' },
                { value: 'metrics', label: 'metrics' },
                { value: 'traces', label: 'traces' },
                { value: 'platform-native', label: 'platform-native' },
              ]}
              onChange={(value) => {
                const next = String(value)
                setDataSourceSourceKind(next)
                setDataSourceBackendType(
                  next === 'logs'
                    ? 'es'
                    : next === 'metrics'
                      ? 'prometheus'
                      : next === 'traces'
                        ? 'jaeger'
                        : 'platform',
                )
              }}
            />
          </Form.Item>
          <Form.Item name="backendType" label="后端类型">
            <Select
              options={backendOptions}
              onChange={(value) => setDataSourceBackendType(String(value))}
            />
          </Form.Item>
          <Form.Item name="mcpAdapter" label="能力层">
            <Select
              options={filteredCapabilityOptions.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="credentialRef" label="凭据引用">
            <Input />
          </Form.Item>
          <SectionCallout
            title="2. 作用范围与预算"
            description="限制这个数据源在 AI 分析中的默认作用范围、查询次数和输出规模。"
          />
          <Form.Item name="scopeClusterId" label="Scope Cluster">
            <Input />
          </Form.Item>
          <Form.Item name="scopeNamespace" label="Scope Namespace">
            <Input />
          </Form.Item>
          <Form.Item name="scopeService" label="Scope Service">
            <Input />
          </Form.Item>
          <Form.Item name="scopeWorkload" label="Scope Workload">
            <Input />
          </Form.Item>
          <Form.Item name="budgetMaxQueries" label="Max Queries">
            <InputNumber min={1} style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="budgetMaxLogBytes" label="Max Log Bytes">
            <InputNumber min={1024} style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="budgetTimeoutSeconds" label="Timeout(s)">
            <InputNumber min={1} style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="redactionMaskFields" label="Mask Fields">
            <TagSelect mode="tags" />
          </Form.Item>
          <Form.Item name="redactionMaskPatterns" label="Mask Patterns">
            <TagSelect mode="tags" />
          </Form.Item>
          <Form.Item
            name="redactionTruncateLongLines"
            label="Truncate Long Lines"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <SectionCallout
            title="3. 后端连接"
            description="这里只展示当前后端类型需要的关键字段，避免无关配置干扰。"
          />
          {dataSourceBackendType === 'skywalking' ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title="SkyWalking 作为 trace 查询后端"
              description="OpenTelemetry 是采集/导出标准，不是直接查询 backend。这里的 traces backend 请选择 Jaeger 或 SkyWalking，并填它们各自的查询入口。"
            />
          ) : null}
          <Form.Item
            name="configEndpoint"
            label="Endpoint"
            rules={[{ required: true, message: '请输入 Endpoint' }]}
          >
            <Input />
          </Form.Item>
          {dataSourceBackendType === 'es' ? (
            <Form.Item
              name="configIndex"
              label="ES Index"
              rules={[{ required: true, message: '请输入 ES Index' }]}
            >
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceBackendType === 'clickhouse' ? (
            <Form.Item
              name="configTable"
              label="CK Table"
              rules={[{ required: true, message: '请输入 CK Table' }]}
            >
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceBackendType === 'clickhouse' ? (
            <Form.Item name="configUsername" label="Username">
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceBackendType === 'clickhouse' ? (
            <Form.Item name="configPassword" label="Password">
              <Input.Password />
            </Form.Item>
          ) : null}
          {dataSourceBackendType !== 'clickhouse' && dataSourceBackendType !== 'platform' ? (
            <Form.Item name="configBearerToken" label="Bearer Token">
              <Input.Password />
            </Form.Item>
          ) : null}
          {dataSourceSourceKind === 'logs' ? (
            <Form.Item name="configTimestampField" label="Timestamp Field">
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceSourceKind === 'logs' ? (
            <Form.Item name="configMessageField" label="Message Field">
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceSourceKind === 'logs' ? (
            <Form.Item name="configSeverityField" label="Severity Field">
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceSourceKind === 'logs' ? (
            <Form.Item name="configServiceField" label="Service Field">
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceSourceKind === 'logs' ? (
            <Form.Item name="configWorkloadField" label="Workload Field">
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceSourceKind === 'logs' ? (
            <Form.Item name="configNamespaceField" label="Namespace Field">
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceSourceKind === 'logs' ? (
            <Form.Item name="configClusterField" label="Cluster Field">
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceBackendType === 'loki' ? (
            <Form.Item
              name="lokiLabelCluster"
              label="Loki Cluster Label"
              rules={[{ required: true, message: '请输入 Loki Cluster Label' }]}
            >
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceBackendType === 'loki' ? (
            <Form.Item
              name="lokiLabelNamespace"
              label="Loki Namespace Label"
              rules={[{ required: true, message: '请输入 Loki Namespace Label' }]}
            >
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceBackendType === 'loki' ? (
            <Form.Item
              name="lokiLabelService"
              label="Loki Service Label"
              rules={[{ required: true, message: '请输入 Loki Service Label' }]}
            >
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceBackendType === 'loki' ? (
            <Form.Item
              name="lokiLabelWorkload"
              label="Loki Workload Label"
              rules={[{ required: true, message: '请输入 Loki Workload Label' }]}
            >
              <Input />
            </Form.Item>
          ) : null}
          {dataSourceBackendType === 'loki' ? (
            <Form.Item
              name="lokiLabelSeverity"
              label="Loki Severity Label"
              rules={[{ required: true, message: '请输入 Loki Severity Label' }]}
            >
              <Input />
            </Form.Item>
          ) : null}
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div className="soha-form-actions">
            <Button
              onClick={() => {
                setDataSourceModalVisible(false)
                setEditingDataSource(null)
                setDataSourceSourceKind('logs')
                setDataSourceBackendType('es')
              }}
            >
              取消
            </Button>
            {canManageAISettings ? (
              <Button htmlType="submit" type="primary" loading={dataSourceMutation.isPending}>
                保存
              </Button>
            ) : null}
          </div>
        </Form>
      </Modal>

      <Modal
        title={editingProfile ? '编辑分析模板' : '新增分析模板'}
        open={profileModalVisible}
        footer={null}
        onCancel={() => {
          setProfileModalVisible(false)
          setEditingProfile(null)
        }}
        destroyOnHidden
      >
        <Form
          {...DEFAULT_FORM_LAYOUT}
          initialValues={buildProfileFormValues(editingProfile)}
          onFinish={(values) => {
            if (!canManageAISettings) return
            saveProfile({
              id: editingProfile?.id,
              values: values as Record<string, unknown>,
            })
          }}
        >
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="mode" label="模式">
            <Select
              options={[
                { value: 'root_cause', label: 'root_cause' },
                { value: 'inspection', label: 'inspection' },
                { value: 'performance', label: 'performance' },
                { value: 'trace', label: 'trace' },
              ]}
            />
          </Form.Item>
          <Form.Item name="enabledSources" label="数据源">
            <Select
              mode="multiple"
              options={dataSources.map((item) => ({
                value: item.id,
                label: `${item.name} (${item.sourceKind}/${item.backendType})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="enabledPlaybooks" label="Playbooks">
            <Select mode="multiple" options={PLAYBOOK_OPTIONS} />
          </Form.Item>
          <Form.Item name="remediationPolicy" label="修复策略">
            <Input />
          </Form.Item>
          <Form.Item name="defaultTimeRangeMinutes" label="默认时间范围(分钟)">
            <InputNumber min={5} style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="timeoutSeconds" label="超时(秒)">
            <InputNumber min={10} style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="budgetMaxQueries" label="Max Queries">
            <InputNumber min={1} style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="budgetMaxLogBytes" label="Max Log Bytes">
            <InputNumber min={1024} style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="budgetMaxEvidenceItems" label="Max Evidence Items">
            <InputNumber min={1} style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="outputSummaryLevel" label="Summary Level">
            <Select
              options={[
                { value: 'compact', label: 'compact' },
                { value: 'standard', label: 'standard' },
                { value: 'detailed', label: 'detailed' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="outputIncludeEvidenceDetail"
            label="Include Evidence Detail"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="outputIncludeRecommendations"
            label="Include Recommendations"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item name="outputIncludeTimeline" label="Include Timeline" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div className="soha-form-actions">
            <Button
              onClick={() => {
                setProfileModalVisible(false)
                setEditingProfile(null)
              }}
            >
              取消
            </Button>
            {canManageAISettings ? (
              <Button htmlType="submit" type="primary" loading={profileMutation.isPending}>
                保存
              </Button>
            ) : null}
          </div>
        </Form>
      </Modal>

      <Modal
        title={editingPolicy ? '编辑自动化策略' : '新增自动化策略'}
        open={policyModalVisible}
        footer={null}
        onCancel={() => {
          setPolicyModalVisible(false)
          setEditingPolicy(null)
        }}
        destroyOnHidden
      >
        <Form
          {...DEFAULT_FORM_LAYOUT}
          initialValues={buildPolicyFormValues(editingPolicy)}
          onFinish={(values) => {
            if (!canManageAISettings) return
            savePolicy({
              id: editingPolicy?.id,
              values: values as Record<string, unknown>,
            })
          }}
        >
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="triggerType" label="触发类型">
            <Select options={[{ value: 'alert_webhook', label: 'alert_webhook' }]} />
          </Form.Item>
          <Form.Item name="analysisKinds" label="分析类型">
            <Select
              mode="multiple"
              options={[
                { value: 'root_cause', label: 'root_cause' },
                { value: 'performance', label: 'performance' },
                { value: 'trace', label: 'trace' },
              ]}
            />
          </Form.Item>
          <Form.Item name="analysisProfileId" label="分析模板">
            <Select
              options={profiles.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="remediationPolicy" label="修复策略">
            <Input />
          </Form.Item>
          <Form.Item name="dedupWindowSeconds" label="Dedup 窗口(s)">
            <InputNumber min={0} style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="cooldownSeconds" label="Cooldown(s)">
            <InputNumber min={0} style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="triggerSeverity" label="告警级别">
            <Select mode="multiple" options={SEVERITY_OPTIONS} />
          </Form.Item>
          <Form.Item name="triggerStatus" label="告警状态">
            <Select mode="multiple" options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="triggerMinDurationSeconds" label="最小持续(s)">
            <InputNumber min={0} style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="triggerLabelKey" label="标签 Key">
            <Input />
          </Form.Item>
          <Form.Item name="triggerLabelValue" label="标签 Value">
            <Input />
          </Form.Item>
          <Form.Item name="triggerTimeRangeMinutes" label="分析时间范围(分钟)">
            <InputNumber min={5} style={fullWidthStyle} />
          </Form.Item>
          <Form.Item name="approvalRequired" label="需要审批" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="approvalRoles" label="审批角色">
            <TagSelect mode="tags" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div className="soha-form-actions">
            <Button
              onClick={() => {
                setPolicyModalVisible(false)
                setEditingPolicy(null)
              }}
            >
              取消
            </Button>
            {canManageAISettings ? (
              <Button htmlType="submit" type="primary" loading={policyMutation.isPending}>
                保存
              </Button>
            ) : null}
          </div>
        </Form>
      </Modal>
    </>
  )

  if (embedded) {
    return content
  }

  return <div className="soha-page">{content}</div>
}
