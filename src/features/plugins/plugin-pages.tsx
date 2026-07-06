import { useEffect, useMemo, useState } from 'react'
import {
  CloudDownloadOutlined,
  CodeOutlined,
  DeleteOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth/permission-snapshot'
import type { PermissionSnapshot } from '@/types'
import {
  configurePlugin,
  disablePlugin,
  enablePlugin,
  getInstalledPlugin,
  getInstalledPluginManifest,
  getMarketplacePlugin,
  installPlugin,
  latestMarketplaceVersion,
  listPluginExtensions,
  listInstalledPlugins,
  listMarketplacePlugins,
  manifestAssetCount,
  manifestCapabilityCount,
  manifestExtensionCount,
  pluginQueryKeys,
  pluginRiskLabels,
  pluginTypeLabel,
  pluginTypeOptions,
  removePlugin,
  requestedPermissionValues,
  requiredSecretValues,
  upgradePlugin,
} from './plugin-model'
import type {
  InstalledPlugin,
  MarketplacePlugin,
  PluginConfigRequest,
  PluginExtensionPoints,
  PluginExtensionRecord,
  PluginManifest,
  PluginPermissionRequest,
} from './plugin-model'
import './plugin-pages.css'

const { Paragraph, Text } = Typography

const PLUGIN_TABS = [
  { key: 'marketplace', label: '市场', path: '/plugins/marketplace' },
  { key: 'installed', label: '已安装', path: '/plugins/installed' },
]

function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function compactTags(values?: string[], max = 4) {
  const items = values?.filter(Boolean) ?? []
  if (!items.length) return <Text type="secondary">-</Text>
  return (
    <Space size={[4, 4]} wrap>
      {items.slice(0, max).map((item) => <Tag key={item}>{item}</Tag>)}
      {items.length > max ? <Tag>+{items.length - max}</Tag> : null}
    </Space>
  )
}

function pluginStatusBadge(status?: string) {
  switch (status) {
    case 'enabled':
      return <Badge status="success" text="Enabled" />
    case 'pending_config':
      return <Badge status="warning" text="Pending config" />
    case 'failed':
      return <Badge status="error" text="Failed" />
    case 'deprecated':
      return <Badge status="default" text="Deprecated" />
    case 'installed':
      return <Badge status="processing" text="Installed" />
    default:
      return <Badge status="default" text="Disabled" />
  }
}

function riskTag(riskLevel?: string) {
  const value = String(riskLevel ?? '').trim()
  if (!value) return <Text type="secondary">-</Text>
  const color = value === 'read' ? 'green' : value === 'write' || value === 'mutate' ? 'gold' : 'red'
  return <Tag color={color}>{pluginRiskLabels[value] ?? value}</Tag>
}

function jsonBlock(value: unknown) {
  return (
    <pre className="soha-plugin-json">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  )
}

type SchemaObject = Record<string, unknown>

function isRecord(value: unknown): value is SchemaObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function schemaProperties(schema?: unknown) {
  if (!isRecord(schema) || !isRecord(schema.properties)) return []
  return Object.entries(schema.properties).map(([name, raw]) => ({
    name,
    schema: isRecord(raw) ? raw : {},
  }))
}

function schemaRequired(schema?: unknown) {
  if (!isRecord(schema) || !Array.isArray(schema.required)) return new Set<string>()
  return new Set(schema.required.filter((item): item is string => typeof item === 'string'))
}

function schemaFieldLabel(name: string, schema: SchemaObject) {
  return String(schema.title || schema.label || name)
}

function schemaFieldControl(schema: SchemaObject) {
  return String(schema['x-control'] || schema.format || schema.type || 'text')
}

function schemaSelectOptions(schema: SchemaObject) {
  const values = Array.isArray(schema.enum) ? schema.enum : []
  return values.map((value) => ({ value: String(value), label: String(value) }))
}

function renderSchemaInput(schema: SchemaObject) {
  const control = schemaFieldControl(schema)
  if (Array.isArray(schema.enum)) {
    return <Select allowClear options={schemaSelectOptions(schema)} />
  }
  if (schema.type === 'boolean') {
    return <Switch />
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    return <InputNumber style={{ width: '100%' }} />
  }
  if (control === 'secret-ref') {
    return <Input.Password placeholder="secret://..." />
  }
  if (control === 'endpoint' || schema.format === 'uri') {
    return <Input placeholder="https://..." />
  }
  if (control === 'resource-selector') {
    return <Input.TextArea rows={3} placeholder='{"clusterId":"prod","namespace":"default"}' />
  }
  return <Input />
}

function extensionPointEntries(points?: PluginExtensionPoints | null) {
  if (!points) return []
  const entries: Array<{
    key: string
    scope: string
    point: string
    id: string
    label?: string
    actionRef?: string
    permissionKeys?: string[]
  }> = []
  Object.entries(points).forEach(([scope, group]) => {
    if (!isRecord(group)) return
    Object.entries(group).forEach(([name, contributions]) => {
      if (!Array.isArray(contributions)) return
      contributions.forEach((item, index) => {
        if (!isRecord(item)) return
        const id = String(item.id || `${scope}.${name}.${index}`)
        entries.push({
          key: `${scope}.${name}.${id}`,
          scope,
          point: `${scope}.${name}`,
          id,
          label: typeof item.label === 'string' ? item.label : undefined,
          actionRef: typeof item.actionRef === 'string' ? item.actionRef : undefined,
          permissionKeys: Array.isArray(item.permissionKeys) ? item.permissionKeys.filter((value): value is string => typeof value === 'string') : undefined,
        })
      })
    })
  })
  return entries
}

function ExtensionPointList({ points }: { points?: PluginExtensionPoints | null }) {
  const entries = extensionPointEntries(points)
  if (!entries.length) return <Text type="secondary">未声明扩展点</Text>
  return (
    <Space direction="vertical" size={8} className="soha-plugin-extension-list">
      {entries.map((entry) => (
        <div className="soha-plugin-extension-row" key={entry.key}>
          <Space size={6} wrap>
            <Tag color="blue">{entry.point}</Tag>
            <Text strong>{entry.label || entry.id}</Text>
            {entry.actionRef ? <Tag>{entry.actionRef}</Tag> : null}
          </Space>
          {entry.permissionKeys?.length ? (
            <div>{compactTags(entry.permissionKeys, 4)}</div>
          ) : null}
        </div>
      ))}
    </Space>
  )
}

function RegisteredExtensionList({ records }: { records: PluginExtensionRecord[] }) {
  if (!records.length) return <Text type="secondary">当前没有已注册扩展</Text>
  return (
    <Space direction="vertical" size={8} className="soha-plugin-extension-list">
      {records.map((record) => (
        <div className="soha-plugin-extension-row" key={`${record.pluginId}:${record.point}:${record.id}`}>
          <Space size={6} wrap>
            <Tag color="blue">{record.point}</Tag>
            <Text strong>{record.label || record.id}</Text>
            <Tag>{record.runtimeMode || 'manifest-only'}</Tag>
            {record.configured ? <Tag color="green">configured</Tag> : <Tag color="gold">pending config</Tag>}
          </Space>
          {record.actionRef ? <Text type="secondary">{record.actionRef}</Text> : null}
          {record.permissionKeys?.length ? <div>{compactTags(record.permissionKeys, 4)}</div> : null}
        </div>
      ))}
    </Space>
  )
}

function canInstall(snapshot?: PermissionSnapshot) {
  return hasPermission(snapshot, 'plugin.install')
}

function canManage(snapshot?: PermissionSnapshot) {
  return hasPermission(snapshot, 'plugin.manage')
}

function canConfigureSecrets(snapshot?: PermissionSnapshot) {
  return hasPermission(snapshot, 'plugin.configure_secrets')
}

function PluginPageShell({
  activeKey,
  children,
  extra,
}: {
  activeKey: 'marketplace' | 'installed'
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="soha-page soha-plugin-page">
      <ManagementDetailHeader
        actions={extra}
        description="安装扩展资产和集成声明；真实访问能力仍由 RBAC、Gateway grants、policy、approval、audit 与 secrets 控制。"
        title="Soha 插件"
      />
      <Tabs
        activeKey={activeKey}
        className="soha-plugin-tabs"
        items={PLUGIN_TABS.map((item) => ({ key: item.key, label: item.label }))}
        onChange={(key) => {
          const tab = PLUGIN_TABS.find((item) => item.key === key)
          if (tab) navigate(tab.path)
        }}
      />
      {children}
    </div>
  )
}

function PluginNameCell({
  description,
  id,
  name,
  publisher,
  type,
  version,
}: {
  description?: string
  id: string
  name: string
  publisher: string
  type: string
  version: string
}) {
  return (
    <Space direction="vertical" size={2} className="soha-plugin-name-cell">
      <Space size={6} wrap>
        <Text strong>{name}</Text>
        <Tag>{pluginTypeLabel(type)}</Tag>
        <Tag color="blue">{version}</Tag>
      </Space>
      <Text type="secondary">{publisher} / {id}</Text>
      {description ? (
        <Paragraph ellipsis={{ rows: 2, tooltip: description }} className="soha-plugin-summary">
          {description}
        </Paragraph>
      ) : null}
    </Space>
  )
}

function PermissionReview({ permissions }: { permissions?: PluginPermissionRequest | null }) {
  const required = permissions?.required ?? []
  const domain = permissions?.domain ?? []
  if (!required.length && !domain.length) {
    return <Text type="secondary">未声明权限需求</Text>
  }
  return (
    <Space direction="vertical" size={4}>
      {required.length ? (
        <div>
          <Text type="secondary">Gateway</Text>
          <div>{compactTags(required, 6)}</div>
        </div>
      ) : null}
      {domain.length ? (
        <div>
          <Text type="secondary">Domain</Text>
          <div>{compactTags(domain, 6)}</div>
        </div>
      ) : null}
    </Space>
  )
}

function InstallReview({ plugin }: { plugin: MarketplacePlugin }) {
  const manifest = plugin.manifest
  const secrets = requiredSecretValues(manifest.secrets)
  const latestVersion = latestMarketplaceVersion(plugin)
  return (
    <Space direction="vertical" size={12} className="soha-plugin-install-review">
      <Alert
        showIcon
        type={plugin.riskLevel === 'read' ? 'info' : 'warning'}
        title="插件安装只保存 manifest 快照和 requested permissions，不会直接授予能力。"
      />
      <Descriptions
        bordered
        column={2}
        size="small"
        items={[
          { key: 'id', label: 'ID', children: plugin.id },
          { key: 'publisher', label: 'Publisher', children: plugin.publisher },
          { key: 'version', label: 'Version', children: plugin.version },
          { key: 'source', label: 'Source', children: plugin.sourceId || plugin.source },
          { key: 'latest', label: 'Latest', children: latestVersion?.version || plugin.latestVersion || '-' },
          { key: 'verified', label: 'Verified', children: plugin.verified ? <Tag color="green">已验证</Tag> : <Tag>未验证</Tag> },
          { key: 'risk', label: 'Risk', children: riskTag(plugin.riskLevel) },
          { key: 'assets', label: 'Assets', children: manifestAssetCount(manifest) },
          { key: 'capabilities', label: 'Capabilities', children: manifestCapabilityCount(manifest) },
          { key: 'runtime', label: 'Runtime', children: manifest.runtime?.mode || 'manifest-only' },
          { key: 'extensions', label: 'Extensions', children: manifestExtensionCount(manifest) },
        ]}
      />
      <Card size="small" title="Requested permissions">
        <PermissionReview permissions={manifest.permissions} />
      </Card>
      <Card size="small" title="Required secrets">
        {secrets.length ? compactTags(secrets.map((item) => item.name), 6) : <Text type="secondary">无</Text>}
      </Card>
      <Card size="small" title="Extension points">
        <ExtensionPointList points={manifest.extensionPoints} />
      </Card>
    </Space>
  )
}

function PluginManifestSections({ manifest }: { manifest?: PluginManifest | null }) {
  if (!manifest) return null
  const secrets = requiredSecretValues(manifest.secrets)
  return (
    <div className="soha-plugin-detail-grid">
      <Card title="Manifest" size="small">
        <Descriptions
          column={2}
          size="small"
          items={[
            { key: 'id', label: 'ID', children: manifest.id },
            { key: 'type', label: 'Type', children: pluginTypeLabel(manifest.type) },
            { key: 'publisher', label: 'Publisher', children: manifest.publisher },
            { key: 'version', label: 'Version', children: manifest.version },
            { key: 'homepage', label: 'Homepage', children: manifest.homepage || '-' },
            { key: 'compatibility', label: 'Compatibility', children: jsonBlock(manifest.compatibility) },
            { key: 'runtime', label: 'Runtime', children: manifest.runtime?.mode || 'manifest-only' },
            { key: 'extensions', label: 'Extensions', children: manifestExtensionCount(manifest) },
          ]}
        />
      </Card>
      <Card title="Assets 与 Capabilities" size="small">
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: 'assets', label: 'Assets', children: jsonBlock(manifest.assets) },
            { key: 'capabilities', label: 'Capabilities', children: jsonBlock(manifest.capabilities) },
          ]}
        />
      </Card>
      <Card title="Requested permissions" size="small">
        <PermissionReview permissions={manifest.permissions} />
      </Card>
      <Card title="Required secrets" size="small">
        {secrets.length ? (
          <Space size={[4, 4]} wrap>
            {secrets.map((item) => (
              <Tag key={item.name} color={item.required === false ? 'default' : 'gold'}>
                {item.name}
              </Tag>
            ))}
          </Space>
        ) : <Text type="secondary">无</Text>}
      </Card>
      <Card title="Extension points" size="small">
        <ExtensionPointList points={manifest.extensionPoints} />
      </Card>
      <Card title="Config schema" size="small">
        {schemaProperties(manifest.configSchema).length ? jsonBlock(manifest.configSchema) : <Text type="secondary">未声明配置 schema</Text>}
      </Card>
    </div>
  )
}

function useInstallAction() {
  const { modal, message } = App.useApp()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: { plugin: MarketplacePlugin; enable: boolean }) =>
      installPlugin({
        pluginId: input.plugin.id,
        enable: input.enable,
        sourceId: input.plugin.sourceId,
        marketplaceUrl: input.plugin.sourceUrl,
        version: input.plugin.latestVersion || input.plugin.version,
      }),
    onSuccess: (item) => {
      message.success(`已安装 ${item.name}`)
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
    },
  })

  return {
    loading: mutation.isPending,
    confirmInstall(plugin: MarketplacePlugin, enable = false) {
      modal.confirm({
        title: `安装 ${plugin.name}`,
        width: 720,
        icon: <CloudDownloadOutlined />,
        content: <InstallReview plugin={plugin} />,
        okText: enable ? '安装并启用' : '安装',
        cancelText: '取消',
        onOk: () => mutation.mutateAsync({ plugin, enable }),
      })
    },
  }
}

function marketplaceDetailPath(plugin: MarketplacePlugin) {
  const params = new URLSearchParams()
  if (plugin.sourceId) params.set('sourceId', plugin.sourceId)
  if (plugin.sourceUrl) params.set('marketplaceUrl', plugin.sourceUrl)
  if (plugin.latestVersion || plugin.version) params.set('version', plugin.latestVersion || plugin.version)
  const suffix = params.toString()
  return `/plugins/marketplace/${encodeURIComponent(plugin.id)}${suffix ? `?${suffix}` : ''}`
}

export function PluginMarketplacePage() {
  const [filters, setFilters] = useState({ query: '', type: '', publisher: '', sourceId: '', marketplaceUrl: '', version: '' })
  const navigate = useNavigate()
  const snapshot = usePermissionSnapshot().data?.data
  const installAction = useInstallAction()
  const marketplaceQuery = useQuery({
    queryKey: pluginQueryKeys.marketplace(filters),
    queryFn: () => listMarketplacePlugins(filters),
  })

  const columns = useMemo<TableColumnsType<MarketplacePlugin>>(() => [
    {
      title: '插件',
      dataIndex: 'name',
      width: 360,
      render: (_, record) => (
        <PluginNameCell
          id={record.id}
          name={record.name}
          publisher={record.publisher}
          type={record.type}
          version={record.version}
          description={record.summary || record.manifest.description}
        />
      ),
    },
    {
      title: '来源',
      width: 170,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Space size={4} wrap>
            <Tag>{record.sourceId || 'static'}</Tag>
            {record.verified ? <Tag color="green">verified</Tag> : null}
          </Space>
          <Text type="secondary">{record.latestVersion || record.version}</Text>
        </Space>
      ),
    },
    {
      title: '能力',
      width: 190,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text>{manifestAssetCount(record.manifest)} assets</Text>
          <Text type="secondary">{manifestCapabilityCount(record.manifest)} capabilities</Text>
          <Text type="secondary">{manifestExtensionCount(record.manifest)} extensions</Text>
        </Space>
      ),
    },
    {
      title: '权限声明',
      width: 260,
      render: (_, record) => compactTags(requestedPermissionValues(record.manifest.permissions), 3),
    },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      width: 100,
      render: riskTag,
    },
    {
      title: '状态',
      dataIndex: 'installed',
      width: 100,
      render: (installed) => installed ? <Tag color="green">已安装</Tag> : <Tag>未安装</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space size={4}>
          <ManagementIconButton
            icon={<EyeOutlined />}
            tooltip="查看详情"
            onClick={() => navigate(marketplaceDetailPath(record))}
          />
          <Button
            disabled={record.installed || !canInstall(snapshot)}
            icon={<CloudDownloadOutlined />}
            loading={installAction.loading}
            size="small"
            onClick={() => installAction.confirmInstall(record)}
          >
            安装
          </Button>
        </Space>
      ),
    },
  ], [installAction, navigate, snapshot])

  return (
    <PluginPageShell
      activeKey="marketplace"
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => marketplaceQuery.refetch()}>
          刷新
        </Button>
      }
    >
      <AdminTable
        rowKey={(record) => `${record.sourceId || 'static'}:${record.id}:${record.version}`}
        columns={columns}
        dataSource={marketplaceQuery.data ?? []}
        loading={marketplaceQuery.isLoading || marketplaceQuery.isFetching}
        title="插件市场"
        toolbar={
          <ManagementTableToolbar>
            <ManagementToolbarSearch
              placeholder="搜索 ID、名称、发布者"
              value={filters.query}
              onChange={(value) => setFilters((current) => ({ ...current, query: value }))}
            />
            <Select
              allowClear
              placeholder="类型"
              style={{ width: 180 }}
              options={pluginTypeOptions}
              value={filters.type || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, type: value ?? '' }))}
            />
            <Input
              allowClear
              placeholder="Publisher"
              style={{ width: 180 }}
              value={filters.publisher}
              onChange={(event) => setFilters((current) => ({ ...current, publisher: event.target.value }))}
            />
            <Input
              allowClear
              placeholder="Source ID"
              style={{ width: 160 }}
              value={filters.sourceId}
              onChange={(event) => setFilters((current) => ({ ...current, sourceId: event.target.value }))}
            />
            <Input
              allowClear
              placeholder="Marketplace URL"
              style={{ width: 260 }}
              value={filters.marketplaceUrl}
              onChange={(event) => setFilters((current) => ({ ...current, marketplaceUrl: event.target.value }))}
            />
            <Input
              allowClear
              placeholder="Version"
              style={{ width: 140 }}
              value={filters.version}
              onChange={(event) => setFilters((current) => ({ ...current, version: event.target.value }))}
            />
          </ManagementTableToolbar>
        }
        empty={<ManagementState kind="empty" title="没有匹配插件" description="调整筛选条件后重试。" />}
      />
    </PluginPageShell>
  )
}

export function PluginMarketplaceDetailPage() {
  const { pluginId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const snapshot = usePermissionSnapshot().data?.data
  const installAction = useInstallAction()
  const filters = useMemo(() => ({
    sourceId: searchParams.get('sourceId') ?? '',
    marketplaceUrl: searchParams.get('marketplaceUrl') ?? '',
    version: searchParams.get('version') ?? '',
  }), [searchParams])
  const detailQuery = useQuery({
    queryKey: pluginQueryKeys.marketplaceDetail(pluginId, filters),
    queryFn: () => getMarketplacePlugin(pluginId, filters),
    enabled: Boolean(pluginId),
  })
  const plugin = detailQuery.data

  if (detailQuery.isLoading) {
    return <PluginPageShell activeKey="marketplace"><ManagementState kind="loading" /></PluginPageShell>
  }
  if (!plugin) {
    return <PluginPageShell activeKey="marketplace"><ManagementState kind="not-found" /></PluginPageShell>
  }

  return (
    <PluginPageShell
      activeKey="marketplace"
      extra={
        <Space>
          <Button onClick={() => navigate('/plugins/marketplace')}>返回市场</Button>
          <Button
            disabled={plugin.installed || !canInstall(snapshot)}
            icon={<CloudDownloadOutlined />}
            loading={installAction.loading}
            type="primary"
            onClick={() => installAction.confirmInstall(plugin)}
          >
            安装
          </Button>
        </Space>
      }
    >
      <Card size="small">
        <PluginNameCell
          id={plugin.id}
          name={plugin.name}
          publisher={plugin.publisher}
          type={plugin.type}
          version={plugin.version}
          description={plugin.summary || plugin.manifest.description}
        />
      </Card>
      <div className="soha-plugin-kpi-grid">
        <Card size="small"><Text type="secondary">Risk</Text><div>{riskTag(plugin.riskLevel)}</div></Card>
        <Card size="small"><Text type="secondary">Assets</Text><div className="soha-plugin-kpi-value">{manifestAssetCount(plugin.manifest)}</div></Card>
        <Card size="small"><Text type="secondary">Extensions</Text><div className="soha-plugin-kpi-value">{manifestExtensionCount(plugin.manifest)}</div></Card>
        <Card size="small"><Text type="secondary">Installed</Text><div>{plugin.installed ? <Tag color="green">是</Tag> : <Tag>否</Tag>}</div></Card>
      </div>
      <Card title="市场来源" size="small">
        <Descriptions
          column={3}
          size="small"
          items={[
            { key: 'source', label: 'Source', children: plugin.source },
            { key: 'sourceId', label: 'Source ID', children: plugin.sourceId || '-' },
            { key: 'sourceUrl', label: 'Catalog URL', children: plugin.sourceUrl || '-' },
            { key: 'latest', label: 'Latest', children: plugin.latestVersion || '-' },
            { key: 'verified', label: 'Verified', children: plugin.verified ? <Tag color="green">是</Tag> : <Tag>否</Tag> },
            { key: 'categories', label: 'Categories', children: compactTags(plugin.categories, 4) },
          ]}
        />
      </Card>
      <PluginManifestSections manifest={plugin.manifest} />
    </PluginPageShell>
  )
}

function useInstalledActions() {
  const { modal, message } = App.useApp()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['plugins'] })
  const enableMutation = useMutation({
    mutationFn: (pluginId: string) => enablePlugin(pluginId),
    onSuccess: (item) => {
      message.success(`已启用 ${item.name}`)
      invalidate()
    },
  })
  const disableMutation = useMutation({
    mutationFn: (pluginId: string) => disablePlugin(pluginId),
    onSuccess: (item) => {
      message.success(`已停用 ${item.name}`)
      invalidate()
    },
  })
  const removeMutation = useMutation({
    mutationFn: (pluginId: string) => removePlugin(pluginId),
    onSuccess: () => {
      message.success('插件已移除')
      invalidate()
    },
  })
  const upgradeMutation = useMutation({
    mutationFn: (pluginId: string) => upgradePlugin(pluginId, { pluginId }),
    onSuccess: (item) => {
      message.success(`已升级 ${item.name}`)
      invalidate()
    },
  })

  return {
    loading: enableMutation.isPending || disableMutation.isPending || removeMutation.isPending || upgradeMutation.isPending,
    enable: enableMutation.mutateAsync,
    disable: disableMutation.mutateAsync,
    upgrade: upgradeMutation.mutateAsync,
    confirmRemove(plugin: InstalledPlugin) {
      modal.confirm({
        title: `移除 ${plugin.name}`,
        content: '移除后会删除安装记录、manifest 快照和配置的 secret refs，不会删除外部 secret 实体。',
        okText: '移除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: () => removeMutation.mutateAsync(plugin.id),
      })
    },
  }
}

export function InstalledPluginsPage() {
  const navigate = useNavigate()
  const snapshot = usePermissionSnapshot().data?.data
  const actions = useInstalledActions()
  const installedQuery = useQuery({
    queryKey: pluginQueryKeys.installed,
    queryFn: listInstalledPlugins,
  })

  const columns = useMemo<TableColumnsType<InstalledPlugin>>(() => [
    {
      title: '插件',
      dataIndex: 'name',
      width: 360,
      render: (_, record) => (
        <PluginNameCell
          id={record.id}
          name={record.name}
          publisher={record.publisher}
          type={record.type}
          version={record.version}
          description={record.manifest.description}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: pluginStatusBadge,
    },
    {
      title: '完整性',
      width: 170,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Tag color={record.checksumStatus === 'verified' ? 'green' : 'default'}>{record.checksumStatus}</Tag>
          <Text type="secondary">{record.signatureStatus || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '权限声明',
      width: 260,
      render: (_, record) => compactTags(requestedPermissionValues(record.requestedPermissions), 3),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 140,
      render: formatDateTime,
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 190,
      render: (_, record) => (
        <Space size={4}>
          <ManagementIconButton
            icon={<EyeOutlined />}
            tooltip="查看详情"
            onClick={() => navigate(`/plugins/installed/${encodeURIComponent(record.id)}`)}
          />
          {record.status === 'enabled' ? (
            <ManagementIconButton
              disabled={!canManage(snapshot)}
              icon={<PauseCircleOutlined />}
              loading={actions.loading}
              tooltip="停用"
              onClick={() => actions.disable(record.id)}
            />
          ) : (
            <ManagementIconButton
              disabled={!canManage(snapshot)}
              icon={<PlayCircleOutlined />}
              loading={actions.loading}
              tooltip="启用"
              onClick={() => actions.enable(record.id)}
            />
          )}
          <ManagementIconButton
            disabled={!canManage(snapshot)}
            icon={<ReloadOutlined />}
            loading={actions.loading}
            tooltip="从市场升级"
            onClick={() => actions.upgrade(record.id)}
          />
          <ManagementIconButton
            disabled={!canManage(snapshot)}
            icon={<DeleteOutlined />}
            loading={actions.loading}
            tooltip="移除"
            onClick={() => actions.confirmRemove(record)}
          />
        </Space>
      ),
    },
  ], [actions, navigate, snapshot])

  return (
    <PluginPageShell
      activeKey="installed"
      extra={<Button icon={<ReloadOutlined />} onClick={() => installedQuery.refetch()}>刷新</Button>}
    >
      <AdminTable
        rowKey="id"
        columns={columns}
        dataSource={installedQuery.data ?? []}
        loading={installedQuery.isLoading || installedQuery.isFetching}
        title="已安装插件"
        empty={<ManagementState kind="empty" title="尚未安装插件" description="从插件市场安装后会在这里显示 manifest 快照和运行状态。" />}
      />
    </PluginPageShell>
  )
}

function parseJSONObject(input: string, label: string) {
  const trimmed = input.trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON object`)
  }
  return parsed as Record<string, unknown>
}

function PluginConfigModal({
  canEditSecrets,
  onCancel,
  onSubmit,
  open,
  plugin,
}: {
  canEditSecrets: boolean
  onCancel: () => void
  onSubmit: (input: PluginConfigRequest) => Promise<unknown>
  open: boolean
  plugin?: InstalledPlugin
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<Record<string, unknown>>()
  const [secretRefsText, setSecretRefsText] = useState('')
  const [metadataText, setMetadataText] = useState('')
  const schemaFields = useMemo(() => schemaProperties(plugin?.manifest.configSchema), [plugin?.manifest.configSchema])
  const requiredFields = useMemo(() => schemaRequired(plugin?.manifest.configSchema), [plugin?.manifest.configSchema])
  const requiredSecrets = useMemo(() => requiredSecretValues(plugin?.manifest.secrets), [plugin?.manifest.secrets])
  const schemaFieldNames = useMemo(() => new Set(schemaFields.map((field) => field.name)), [schemaFields])

  useEffect(() => {
    if (!open || !plugin) return
    const metadata = plugin.metadata && typeof plugin.metadata === 'object' ? plugin.metadata : {}
    const config = isRecord(metadata.config) ? metadata.config : {}
    const secretRefs = plugin.configuredSecretRefs ?? {}
    const values: Record<string, unknown> = {}
    schemaFields.forEach(({ name, schema }) => {
      values[name] = schemaFieldControl(schema) === 'secret-ref' ? secretRefs[name] : config[name]
    })
    requiredSecrets.forEach((secret) => {
      if (!schemaFieldNames.has(secret.name)) {
        values[`secret:${secret.name}`] = secretRefs[secret.name] ?? secret.secretRef
      }
    })
    form.setFieldsValue(values)
    setSecretRefsText(JSON.stringify(secretRefs, null, 2))
    setMetadataText(JSON.stringify(metadata, null, 2))
  }, [form, open, plugin, requiredSecrets, schemaFieldNames, schemaFields])

  return (
    <Modal
      open={open}
      title="配置插件"
      width={860}
      okText="保存"
      cancelText="取消"
      onCancel={onCancel}
      onOk={async () => {
        try {
          const formValues = await form.validateFields()
          const secretRefs = parseJSONObject(secretRefsText, 'Secret refs')
          const metadata = parseJSONObject(metadataText, 'Metadata')
          const config = isRecord(metadata.config) ? { ...metadata.config } : {}
          schemaFields.forEach(({ name, schema }) => {
            const value = formValues[name]
            if (value === undefined || value === '') return
            if (schemaFieldControl(schema) === 'secret-ref') {
              secretRefs[name] = String(value)
              return
            }
            config[name] = value
          })
          requiredSecrets.forEach((secret) => {
            if (schemaFieldNames.has(secret.name)) return
            const value = formValues[`secret:${secret.name}`]
            if (value !== undefined && value !== '') {
              secretRefs[secret.name] = String(value)
            }
          })
          if (Object.keys(config).length) {
            metadata.config = config
          }
          await onSubmit({
            secretRefs: canEditSecrets ? Object.fromEntries(Object.entries(secretRefs).map(([key, value]) => [key, String(value)])) : undefined,
            metadata,
          })
          onCancel()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '配置解析失败')
        }
      }}
    >
      <Space direction="vertical" size={12} className="soha-plugin-config-modal">
        <Alert
          showIcon
          type="info"
          title="这里只保存 secret 引用和插件配置元数据；secret 内容仍由外部 secret 管理。"
        />
        {schemaFields.length || requiredSecrets.length ? (
          <Card size="small" title="Schema 配置">
            <Form form={form} layout="vertical">
              {schemaFields.map(({ name, schema }) => {
                const isBoolean = schema.type === 'boolean'
                const isSecretRef = schemaFieldControl(schema) === 'secret-ref'
                return (
                  <Form.Item
                    key={name}
                    name={name}
                    label={schemaFieldLabel(name, schema)}
                    extra={typeof schema.description === 'string' ? schema.description : undefined}
                    valuePropName={isBoolean ? 'checked' : 'value'}
                    rules={requiredFields.has(name) ? [{ required: true, message: `请填写 ${schemaFieldLabel(name, schema)}` }] : undefined}
                  >
                    {isSecretRef ? <Input.Password disabled={!canEditSecrets} placeholder="secret://..." /> : renderSchemaInput(schema)}
                  </Form.Item>
                )
              })}
              {requiredSecrets
                .filter((secret) => !schemaFieldNames.has(secret.name))
                .map((secret) => (
                  <Form.Item
                    key={secret.name}
                    name={`secret:${secret.name}`}
                    label={secret.name}
                    extra={secret.description}
                    rules={secret.required === false ? undefined : [{ required: true, message: `请填写 ${secret.name} secret ref` }]}
                  >
                    <Input.Password disabled={!canEditSecrets} placeholder="secret://..." />
                  </Form.Item>
                ))}
            </Form>
          </Card>
        ) : null}
        <div>
          <Text strong>Secret refs</Text>
          <Input.TextArea
            disabled={!canEditSecrets}
            rows={6}
            value={secretRefsText}
            onChange={(event) => setSecretRefsText(event.target.value)}
          />
          {!canEditSecrets ? <Text type="secondary">当前账号没有 plugin.configure_secrets 权限。</Text> : null}
        </div>
        <div>
          <Text strong>Metadata</Text>
          <Input.TextArea
            rows={6}
            value={metadataText}
            onChange={(event) => setMetadataText(event.target.value)}
          />
        </div>
      </Space>
    </Modal>
  )
}

export function InstalledPluginDetailPage() {
  const { pluginId = '' } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const snapshot = usePermissionSnapshot().data?.data
  const [configOpen, setConfigOpen] = useState(false)
  const actions = useInstalledActions()
  const detailQuery = useQuery({
    queryKey: pluginQueryKeys.installedDetail(pluginId),
    queryFn: () => getInstalledPlugin(pluginId),
    enabled: Boolean(pluginId),
  })
  const manifestQuery = useQuery({
    queryKey: pluginQueryKeys.manifest(pluginId),
    queryFn: () => getInstalledPluginManifest(pluginId),
    enabled: Boolean(pluginId),
  })
  const extensionsQuery = useQuery({
    queryKey: pluginQueryKeys.extensions('runtime'),
    queryFn: () => listPluginExtensions('runtime'),
  })
  const configMutation = useMutation({
    mutationFn: (input: PluginConfigRequest) => configurePlugin(pluginId, input),
    onSuccess: (item) => {
      message.success(`已配置 ${item.name}`)
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
    },
  })
  const plugin = detailQuery.data
  const manifest = manifestQuery.data ?? plugin?.manifest
  const registeredExtensions = useMemo(
    () => (extensionsQuery.data ?? []).filter((record) => record.pluginId === plugin?.id),
    [extensionsQuery.data, plugin?.id],
  )

  if (detailQuery.isLoading) {
    return <PluginPageShell activeKey="installed"><ManagementState kind="loading" /></PluginPageShell>
  }
  if (!plugin) {
    return <PluginPageShell activeKey="installed"><ManagementState kind="not-found" /></PluginPageShell>
  }

  return (
    <PluginPageShell
      activeKey="installed"
      extra={
        <Space>
          <Button onClick={() => navigate('/plugins/installed')}>返回已安装</Button>
          {plugin.status === 'enabled' ? (
            <Button disabled={!canManage(snapshot)} icon={<PauseCircleOutlined />} onClick={() => actions.disable(plugin.id)}>停用</Button>
          ) : (
            <Button disabled={!canManage(snapshot)} icon={<PlayCircleOutlined />} onClick={() => actions.enable(plugin.id)}>启用</Button>
          )}
          <Button disabled={!canManage(snapshot)} icon={<SettingOutlined />} onClick={() => setConfigOpen(true)}>配置</Button>
          <Button disabled={!canManage(snapshot)} icon={<ReloadOutlined />} onClick={() => actions.upgrade(plugin.id)}>升级</Button>
          <Button danger disabled={!canManage(snapshot)} icon={<DeleteOutlined />} onClick={() => actions.confirmRemove(plugin)}>移除</Button>
        </Space>
      }
    >
      <Card size="small">
        <PluginNameCell
          id={plugin.id}
          name={plugin.name}
          publisher={plugin.publisher}
          type={plugin.type}
          version={plugin.version}
          description={plugin.manifest.description}
        />
      </Card>
      <div className="soha-plugin-kpi-grid">
        <Card size="small"><Text type="secondary">Status</Text><div>{pluginStatusBadge(plugin.status)}</div></Card>
        <Card size="small"><Text type="secondary">Checksum</Text><div><Tag>{plugin.checksumStatus}</Tag></div></Card>
        <Card size="small"><Text type="secondary">Installed</Text><div className="soha-plugin-kpi-value">{formatDateTime(plugin.installedAt)}</div></Card>
        <Card size="small"><Text type="secondary">Updated</Text><div className="soha-plugin-kpi-value">{formatDateTime(plugin.updatedAt)}</div></Card>
      </div>
      <Card title="安装记录" size="small">
        <Descriptions
          column={3}
          size="small"
          items={[
            { key: 'source', label: 'Source', children: plugin.source },
            { key: 'installedBy', label: 'Installed by', children: plugin.installedBy },
            { key: 'signature', label: 'Signature', children: plugin.signatureStatus || '-' },
            { key: 'enabledAt', label: 'Enabled at', children: formatDateTime(plugin.enabledAt) },
            { key: 'disabledAt', label: 'Disabled at', children: formatDateTime(plugin.disabledAt) },
            { key: 'secrets', label: 'Secret refs', children: compactTags(Object.keys(plugin.configuredSecretRefs ?? {}), 4) },
          ]}
        />
      </Card>
      <Card title="已注册扩展" size="small" loading={extensionsQuery.isLoading || extensionsQuery.isFetching}>
        <RegisteredExtensionList records={registeredExtensions} />
      </Card>
      <PluginManifestSections manifest={manifest} />
      <Card title="Raw manifest" size="small" extra={<CodeOutlined />}>
        {jsonBlock(manifest)}
      </Card>
      <PluginConfigModal
        canEditSecrets={canConfigureSecrets(snapshot)}
        open={configOpen}
        plugin={plugin}
        onCancel={() => setConfigOpen(false)}
        onSubmit={(input) => configMutation.mutateAsync(input)}
      />
    </PluginPageShell>
  )
}

export function PluginRedirectPage() {
  return <Navigate to="/plugins/marketplace" replace />
}
