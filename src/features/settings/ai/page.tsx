import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  Alert,
  App,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementIconButton, ManagementState } from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import {
  companionApi,
  companionKeys,
  BUILTIN_COMPANION_PLUGIN_ID,
  createLocalLive2DPack,
  getLive2DCubismRuntime,
  LOCAL_LIVE2D_PLUGIN_ID,
  useLocalCompanionPackStore,
} from '@/features/companion'
import { pluginQueries } from '@/features/plugins'
import { usePreferencesStore } from '@/stores/preferences-store'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import {
  PLAYBOOK_OPTIONS,
  TRACES_BACKEND_OPTIONS,
  buildDataSourceFormValues,
  buildDataSourcePayload,
  buildProfileFormValues,
  buildProfilePayload,
} from '../ai-settings-model'
import type {
  AIWorkbenchModelSettings,
  AISkillSetting,
  AnalysisProfile,
  DataSource,
} from '../ai-settings-model'
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
import type { AISettingsPageProps } from '../types'
import '../shared/styles.css'
import './styles.css'

export function AISettingsPage({ embedded = false, section = 'model' }: AISettingsPageProps = {}) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [dataSourceModalVisible, setDataSourceModalVisible] = useState(false)
  const [profileModalVisible, setProfileModalVisible] = useState(false)
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null)
  const [editingProfile, setEditingProfile] = useState<AnalysisProfile | null>(null)
  const [skillsModalVisible, setSkillsModalVisible] = useState(false)
  const [editingSkill, setEditingSkill] = useState<AISkillSetting | null>(null)
  const [skillsRegistryDraft, setSkillsRegistryDraft] = useState<AISkillSetting[]>([])
  const [dataSourceSourceKind, setDataSourceSourceKind] = useState('logs')
  const [dataSourceBackendType, setDataSourceBackendType] = useState('es')
  const canViewAISettings = hasPermission(permissionSnapshotQuery.data?.data, 'settings.ai.view')
  const canManageAISettings = hasPermission(
    permissionSnapshotQuery.data?.data,
    'settings.ai.update',
  )
  const canUseCompanion = hasPermission(permissionSnapshotQuery.data?.data, 'observe.ai.chat')
  const canViewPlugins = hasPermission(permissionSnapshotQuery.data?.data, 'plugin.view')
  const showModel = section === 'model'
  const showCompanion = section === 'companion'
  const showSkills = section === 'skills'
  const showDataSources = section === 'data-sources'
  const showProfiles = section === 'profiles'
  const canViewSection = showCompanion ? canUseCompanion : canViewAISettings
  const companionMode = usePreferencesStore((state) => state.companionMode)
  const companionBubbleEnabled = usePreferencesStore((state) => state.companionBubbleEnabled)
  const selectedCompanionPluginId = usePreferencesStore((state) => state.selectedCompanionPluginId)
  const localCompanionPack = useLocalCompanionPackStore((state) => state.pack)
  const clearLocalCompanionPack = useLocalCompanionPackStore((state) => state.clear)
  const setLocalCompanionPack = useLocalCompanionPackStore((state) => state.setPack)
  const localLive2DInputRef = useRef<HTMLInputElement>(null)
  const [localLive2DImporting, setLocalLive2DImporting] = useState(false)
  const setCompanionMode = usePreferencesStore((state) => state.setCompanionMode)
  const setCompanionBubbleEnabled = usePreferencesStore((state) => state.setCompanionBubbleEnabled)
  const setSelectedCompanionPluginId = usePreferencesStore(
    (state) => state.setSelectedCompanionPluginId,
  )

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

  const settingsQuery = useQuery(
    settingsQueries.ai.detail(canViewAISettings && (showModel || showSkills)),
  )
  const { data } = settingsQuery
  const modelRoutesQuery = useQuery(settingsQueries.ai.modelRoutes(canViewAISettings && showModel))
  const dataSourcesQuery = useQuery(
    settingsQueries.ai.dataSources(canViewAISettings && (showDataSources || showProfiles)),
  )
  const profilesQuery = useQuery(
    settingsQueries.ai.analysisProfiles(canViewAISettings && showProfiles),
  )
  const capabilitiesQuery = useQuery(
    settingsQueries.ai.dataSourceCapabilities(canViewAISettings && showDataSources),
  )
  const companionPacksQuery = useQuery(
    pluginQueries.installed(showCompanion && canUseCompanion && canViewPlugins),
  )
  const hasQueryError =
    permissionSnapshotQuery.isError ||
    ((showModel || showSkills) && settingsQuery.isError) ||
    (showModel && modelRoutesQuery.isError) ||
    ((showDataSources || showProfiles) && dataSourcesQuery.isError) ||
    (showProfiles && profilesQuery.isError) ||
    (showDataSources && capabilitiesQuery.isError) ||
    (showCompanion && canViewPlugins && companionPacksQuery.isError)
  const isPageLoading =
    permissionSnapshotQuery.isLoading ||
    ((showModel || showSkills) && settingsQuery.isLoading) ||
    (showModel && modelRoutesQuery.isLoading) ||
    ((showDataSources || showProfiles) && dataSourcesQuery.isLoading) ||
    (showProfiles && profilesQuery.isLoading) ||
    (showDataSources && capabilitiesQuery.isLoading) ||
    (showCompanion && canViewPlugins && companionPacksQuery.isLoading)
  const resetCompanionMutation = useMutation({
    mutationFn: () => companionApi.reset({ pluginId: selectedCompanionPluginId }),
    onSuccess: (profile) => {
      queryClient.setQueryData(companionKeys.profile(), profile)
      void message.success('宠物成长数据已重置')
    },
    onError: (error: Error) => void message.error(error.message),
  })

  const importLocalLive2D = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    event.target.value = ''
    if (!files?.length) return
    setLocalLive2DImporting(true)
    try {
      const pack = await createLocalLive2DPack(files)
      setLocalCompanionPack(pack)
      setCompanionMode('companion')
      void message.success(`本地模型已校验：${pack.manifest.entryAsset}`)
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '本地 Live2D 模型导入失败')
    } finally {
      setLocalLive2DImporting(false)
    }
  }

  const saveWorkbenchModelMutation = useMutation(
    settingsMutations.ai.saveWorkbenchModel(queryClient),
  )
  const saveSkillsMutation = useMutation(settingsMutations.ai.saveSkills(queryClient))
  const dataSourceMutation = useMutation(settingsMutations.ai.upsertDataSource(queryClient))
  const validateDataSourceMutation = useMutation(
    settingsMutations.ai.validateDataSource(queryClient),
  )
  const profileMutation = useMutation(settingsMutations.ai.upsertAnalysisProfile(queryClient))

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

  useEffect(() => {
    if (!settings || !showSkills) return
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
  }, [settings, showSkills])

  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  if (hasQueryError) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="error"
          actions={
            <Button
              onClick={() => {
                void permissionSnapshotQuery.refetch()
                if (canViewSection) {
                  void Promise.all([
                    showModel || showSkills ? settingsQuery.refetch() : Promise.resolve(),
                    showModel ? modelRoutesQuery.refetch() : Promise.resolve(),
                    showDataSources || showProfiles
                      ? dataSourcesQuery.refetch()
                      : Promise.resolve(),
                    showProfiles ? profilesQuery.refetch() : Promise.resolve(),
                    showDataSources ? capabilitiesQuery.refetch() : Promise.resolve(),
                    showCompanion && canViewPlugins
                      ? companionPacksQuery.refetch()
                      : Promise.resolve(),
                  ])
                }
              }}
            >
              重试
            </Button>
          }
        />
      </div>
    )
  }

  if (!canViewSection) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="no-permission"
          description={
            showCompanion
              ? '当前账号没有使用 Companion 的权限。'
              : '当前账号没有查看 AI 设置的权限。'
          }
        />
      </div>
    )
  }

  const dataSources = dataSourcesQuery.data ?? []
  const profiles = profilesQuery.data ?? []
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
        if (isPending) return <StatusTag value="checking" label="校验中" />
        if (!value) return <StatusTag value="unknown" label="未校验" />
        const normalized = value.toLowerCase()
        const label = normalized === 'success' ? '已通过' : normalized === 'error' ? '失败' : value
        return (
          <div className="flex max-w-[240px] flex-col gap-1">
            <StatusTag value={normalized} label={label} />
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
            <MetadataTag key={item} label={item} />
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
            <MetadataTag key={item} label={item} />
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
          title="模型 Provider 在 AI Gateway 管理。这里仅选择 AI Workbench 使用的默认模型与路由。"
        />
        <Form
          data-testid="ai-workbench-model-form"
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
            <MetadataTag
              label={selectedRoute ? `route: ${selectedRoute.id}` : '未选择 route'}
              tone={selectedRoute ? 'cyan' : 'default'}
            />
            <MetadataTag
              label={settings?.workbenchModel?.defaultPublicModel || '未选择 public model'}
              tone={settings?.workbenchModel?.defaultPublicModel ? 'blue' : 'default'}
            />
            <MetadataTag label={`${enabledModelRoutes.length} active routes`} tone="purple" />
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

  const companionPackOptions = [
    { value: BUILTIN_COMPANION_PLUGIN_ID, label: 'Soha Orbit' },
    ...(localCompanionPack
      ? [
          {
            value: LOCAL_LIVE2D_PLUGIN_ID,
            label: `本地 · ${localCompanionPack.manifest.entryAsset.split('/').slice(-1)[0]}`,
          },
        ]
      : []),
    ...(Array.isArray(companionPacksQuery.data) ? companionPacksQuery.data : [])
      .filter(
        (item) =>
          item.type === 'companion-pack' &&
          item.status === 'enabled' &&
          Boolean(item.manifest.companionPack),
      )
      .map((item) => ({
        value: item.id,
        label: `${item.name} (${item.activeVersion || item.version})`,
      })),
  ]

  const companionCard = (
    <section data-testid="ai-companion-section" className="soha-settings-table-section">
      <SettingsCard title="桌面宠物">
        <div className="soha-companion-settings-grid">
          <label>
            <span>悬浮模式</span>
            <Segmented
              options={[
                { value: 'companion', label: '宠物' },
                { value: 'icon', label: '图标' },
              ]}
              value={companionMode}
              onChange={(value) => setCompanionMode(value as 'companion' | 'icon')}
            />
          </label>
          <label>
            <span>当前模型</span>
            <Select
              loading={companionPacksQuery.isLoading}
              options={companionPackOptions}
              value={localCompanionPack ? LOCAL_LIVE2D_PLUGIN_ID : selectedCompanionPluginId}
              onChange={(pluginId) => {
                clearLocalCompanionPack()
                setSelectedCompanionPluginId(pluginId)
              }}
            />
          </label>
          <div className="soha-companion-local-import">
            <span>本地 Live2D</span>
            <div className="soha-companion-local-import__actions">
              <Button
                icon={<FolderOpenOutlined />}
                loading={localLive2DImporting}
                onClick={() => localLive2DInputRef.current?.click()}
              >
                导入模型目录
              </Button>
              {localCompanionPack ? <Button onClick={clearLocalCompanionPack}>清除</Button> : null}
            </div>
            <input
              ref={localLive2DInputRef}
              hidden
              multiple
              type="file"
              onChange={(event) => void importLocalLive2D(event)}
              {...({ webkitdirectory: '' } as { webkitdirectory: string })}
            />
          </div>
          <label>
            <span>对话气泡</span>
            <Switch checked={companionBubbleEnabled} onChange={setCompanionBubbleEnabled} />
          </label>
          <Popconfirm
            title="重置宠物成长数据？"
            okText="重置"
            cancelText="取消"
            onConfirm={() => resetCompanionMutation.mutate()}
          >
            <Button
              danger
              disabled={Boolean(localCompanionPack)}
              loading={resetCompanionMutation.isPending}
            >
              重置成长数据
            </Button>
          </Popconfirm>
          {localCompanionPack ? (
            <Alert
              className="soha-companion-local-import__status"
              description={
                getLive2DCubismRuntime()
                  ? '模型只保存在当前页面会话，不会上传到服务器。'
                  : '模型资源校验已通过，但当前宿主没有 Cubism runtime，悬浮窗会暂时显示 Soha Orbit。'
              }
              showIcon
              title="本地模型仅用于测试；模型与 Cubism Core 授权由使用者负责。"
              type={getLive2DCubismRuntime() ? 'info' : 'warning'}
            />
          ) : null}
        </div>
      </SettingsCard>
    </section>
  )

  const content = (
    <>
      {showModel ? workbenchModelCard : null}
      {showCompanion ? companionCard : null}
      {showSkills ? (
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
                      <MetadataTag key={item} label={item} />
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
                      <MetadataTag key={item} label={item} />
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
      ) : null}
      {showDataSources ? (
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
      ) : null}
      {showProfiles ? (
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
      ) : null}
      {showSkills ? (
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
                inputSchema = values.inputSchemaText
                  ? JSON.parse(String(values.inputSchemaText))
                  : {}
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
      ) : null}

      {showDataSources ? (
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
      ) : null}

      {showProfiles ? (
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
            <Form.Item
              name="outputIncludeTimeline"
              label="Include Timeline"
              valuePropName="checked"
            >
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
      ) : null}
    </>
  )

  if (embedded) {
    return content
  }

  return <div className="soha-page">{content}</div>
}
