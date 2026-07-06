import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  ApiOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth/permission-snapshot'
import type { IdentityApplication } from '@/features/provider-portal/provider-portal-api'
import { identityApplicationQueryKeys, listIdentityApplications } from './identity-applications-api'
import {
  createIdentityOIDCClient,
  createIdentityProvider,
  deleteIdentityOIDCClient,
  deleteIdentityProvider,
  identityProviderQueryKeys,
  listIdentityOIDCClients,
  listIdentityProviders,
  updateIdentityOIDCClient,
  updateIdentityProvider,
} from './identity-providers-api'
import { identityOutpostQueryKeys, listIdentityOutposts } from './identity-outposts-api'
import type {
  IdentityOIDCClient,
  IdentityOIDCClientInput,
  IdentityOIDCClientStatus,
  IdentityProvider,
  IdentityProviderInput,
  IdentityRuntimeProviderStatus,
  IdentityRuntimeProviderType,
} from './identity-providers-api'
import './identity-providers-page.css'

const { Paragraph, Text } = Typography

type ProxyMode = 'forward_auth' | 'reverse_proxy'

interface ProviderFormValues {
  applicationId: string
  configJson: string
  enabled: boolean
  name: string
  proxyCookieDomain: string
  proxyExternalHosts: string[]
  proxyHeaderEmail: string
  proxyHeaderGroups: string
  proxyHeaderRoles: string
  proxyHeaderTeams: string
  proxyHeaderUser: string
  proxyHeaderUserId: string
  proxyMode: ProxyMode
  proxyOutpostId: string
  proxyPathPrefix: string
  proxySkipAuthPaths: string[]
  proxyUpstreamUrl: string
  proxyWebsocketEnabled: boolean
  secretRefsJson: string
  status: IdentityRuntimeProviderStatus
  type: IdentityRuntimeProviderType
}

interface OIDCClientFormValues {
  accessTokenTtlSeconds: number
  allowedGrantTypes: string[]
  allowedScopes: string[]
  clientId: string
  clientSecret: string
  idTokenTtlSeconds: number
  redirectUris: string[]
  refreshTokenTtlSeconds: number
  requirePkce: boolean
  status: IdentityOIDCClientStatus
}

interface SecretRevealState {
  clientId: string
  clientSecret: string
}

const providerTypeOptions: Array<{ label: string; value: IdentityRuntimeProviderType }> = [
  { label: 'OIDC', value: 'oidc' },
  { label: 'Proxy', value: 'proxy' },
]

const providerStatusOptions: Array<{ label: string; value: IdentityRuntimeProviderStatus }> = [
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
]

const proxyModeOptions: Array<{ label: string; value: ProxyMode }> = [
  { label: 'Forward auth', value: 'forward_auth' },
  { label: 'Reverse proxy', value: 'reverse_proxy' },
]

const oidcClientStatusOptions: Array<{ label: string; value: IdentityOIDCClientStatus }> = [
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
]

const defaultScopes = ['openid', 'profile', 'email']
const defaultGrantTypes = ['authorization_code']
const oidcGrantTypeOptions = [{ label: 'authorization_code', value: 'authorization_code' }]
const defaultProxyHeaders = {
  email: 'X-Soha-Email',
  groups: 'X-Soha-Groups',
  roles: 'X-Soha-Roles',
  teams: 'X-Soha-Teams',
  user: 'X-Soha-User',
  userId: 'X-Soha-User-ID',
}

const knownProxyConfigKeys = [
  'cookieDomain',
  'cookie_domain',
  'externalHost',
  'externalHosts',
  'external_host',
  'external_hosts',
  'headerMappings',
  'header_mappings',
  'host',
  'hosts',
  'mode',
  'outpostId',
  'outpost_id',
  'pathPrefix',
  'path_prefix',
  'protectedPathPrefix',
  'protected_path_prefix',
  'skipAuthPaths',
  'skip_auth_paths',
  'upstreamURL',
  'upstreamUrl',
  'upstream_url',
  'websocketEnabled',
  'websocket_enabled',
]

const providerStatusMeta: Record<IdentityRuntimeProviderStatus, { color: string; label: string }> =
  {
    disabled: { color: 'default', label: 'Disabled' },
    enabled: { color: 'green', label: 'Enabled' },
  }

const oidcClientStatusMeta: Record<IdentityOIDCClientStatus, { color: string; label: string }> = {
  disabled: { color: 'default', label: 'Disabled' },
  enabled: { color: 'green', label: 'Enabled' },
}

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

function compactStrings(values: string[] = []) {
  const seen = new Set<string>()
  const out: string[] = []
  values.forEach((value) => {
    const normalized = String(value ?? '').trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    out.push(normalized)
  })
  return out
}

function jsonText(value?: Record<string, unknown>) {
  return JSON.stringify(value ?? {}, null, 2)
}

function parseRecordJSON(value: string, label: string): Record<string, unknown> {
  const text = String(value ?? '').trim()
  if (!text) return {}
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON object`)
  }
  return parsed as Record<string, unknown>
}

function configString(config: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = config?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function configStringArray(config: Record<string, unknown> | undefined, ...keys: string[]) {
  const values: string[] = []
  keys.forEach((key) => {
    const value = config?.[key]
    if (typeof value === 'string') {
      values.push(...value.split(','))
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string') values.push(item)
      })
    }
  })
  return compactStrings(values)
}

function configBoolean(config: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = config?.[key]
    if (typeof value === 'boolean') return value
  }
  return false
}

function configStringMap(config: Record<string, unknown> | undefined, ...keys: string[]) {
  const out: Record<string, string> = {}
  keys.forEach((key) => {
    const value = config?.[key]
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    Object.entries(value as Record<string, unknown>).forEach(([itemKey, itemValue]) => {
      if (typeof itemValue === 'string') out[itemKey] = itemValue.trim()
    })
  })
  return out
}

function stripKnownProxyConfig(config?: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...(config ?? {}) }
  knownProxyConfigKeys.forEach((key) => delete out[key])
  return out
}

function setStringConfig(config: Record<string, unknown>, key: string, value?: string) {
  const normalized = String(value ?? '').trim()
  if (normalized) config[key] = normalized
}

function proxyConfigFromValues(
  values: ProviderFormValues,
  advancedConfig: Record<string, unknown>,
) {
  const config = stripKnownProxyConfig(advancedConfig)
  const externalHosts = compactStrings(values.proxyExternalHosts)
  if (externalHosts.length) config.externalHosts = externalHosts
  setStringConfig(config, 'upstreamUrl', values.proxyUpstreamUrl)
  setStringConfig(config, 'mode', values.proxyMode || 'forward_auth')
  setStringConfig(config, 'cookieDomain', values.proxyCookieDomain)
  setStringConfig(config, 'pathPrefix', values.proxyPathPrefix)
  setStringConfig(config, 'outpostId', values.proxyOutpostId)
  const skipAuthPaths = compactStrings(values.proxySkipAuthPaths)
  if (skipAuthPaths.length) config.skipAuthPaths = skipAuthPaths
  config.websocketEnabled = Boolean(values.proxyWebsocketEnabled)

  const headerMappings: Record<string, string> = {}
  const headerValues = {
    email: values.proxyHeaderEmail,
    groups: values.proxyHeaderGroups,
    roles: values.proxyHeaderRoles,
    teams: values.proxyHeaderTeams,
    user: values.proxyHeaderUser,
    userId: values.proxyHeaderUserId,
  }
  Object.entries(headerValues).forEach(([claim, headerName]) => {
    const normalized = String(headerName ?? '').trim()
    if (normalized) headerMappings[claim] = normalized
  })
  if (Object.keys(headerMappings).length) {
    config.headerMappings = headerMappings
  }
  return config
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function defaultProviderValues(): ProviderFormValues {
  return {
    applicationId: '',
    configJson: '{}',
    enabled: true,
    name: '',
    proxyCookieDomain: '',
    proxyExternalHosts: [],
    proxyHeaderEmail: defaultProxyHeaders.email,
    proxyHeaderGroups: defaultProxyHeaders.groups,
    proxyHeaderRoles: defaultProxyHeaders.roles,
    proxyHeaderTeams: defaultProxyHeaders.teams,
    proxyHeaderUser: defaultProxyHeaders.user,
    proxyHeaderUserId: defaultProxyHeaders.userId,
    proxyMode: 'forward_auth',
    proxyOutpostId: '',
    proxyPathPrefix: '/',
    proxySkipAuthPaths: [],
    proxyUpstreamUrl: '',
    proxyWebsocketEnabled: true,
    secretRefsJson: '{}',
    status: 'enabled',
    type: 'oidc',
  }
}

function providerValuesFor(item: IdentityProvider): ProviderFormValues {
  const config = item.config ?? {}
  const headerMappings = configStringMap(config, 'headerMappings', 'header_mappings')
  return {
    applicationId: item.applicationId,
    configJson: item.type === 'proxy' ? jsonText(stripKnownProxyConfig(config)) : jsonText(config),
    enabled: item.enabled,
    name: item.name,
    proxyCookieDomain: configString(config, 'cookieDomain', 'cookie_domain'),
    proxyExternalHosts: configStringArray(
      config,
      'externalHosts',
      'external_hosts',
      'hosts',
      'externalHost',
      'external_host',
      'host',
    ),
    proxyHeaderEmail: headerMappings.email || defaultProxyHeaders.email,
    proxyHeaderGroups: headerMappings.groups || defaultProxyHeaders.groups,
    proxyHeaderRoles: headerMappings.roles || defaultProxyHeaders.roles,
    proxyHeaderTeams: headerMappings.teams || defaultProxyHeaders.teams,
    proxyHeaderUser: headerMappings.user || defaultProxyHeaders.user,
    proxyHeaderUserId: headerMappings.userId || defaultProxyHeaders.userId,
    proxyMode: configString(config, 'mode') === 'reverse_proxy' ? 'reverse_proxy' : 'forward_auth',
    proxyOutpostId: configString(config, 'outpostId', 'outpost_id'),
    proxyPathPrefix:
      configString(
        config,
        'pathPrefix',
        'path_prefix',
        'protectedPathPrefix',
        'protected_path_prefix',
      ) || '/',
    proxySkipAuthPaths: configStringArray(config, 'skipAuthPaths', 'skip_auth_paths'),
    proxyUpstreamUrl: configString(config, 'upstreamUrl', 'upstreamURL', 'upstream_url'),
    proxyWebsocketEnabled: configBoolean(config, 'websocketEnabled', 'websocket_enabled'),
    secretRefsJson: jsonText(item.secretRefs),
    status: item.status,
    type: item.type,
  }
}

function providerInputFromValues(values: ProviderFormValues): IdentityProviderInput {
  const advancedConfig = parseRecordJSON(values.configJson, 'Config')
  return {
    applicationId: values.applicationId.trim(),
    config:
      values.type === 'proxy' ? proxyConfigFromValues(values, advancedConfig) : advancedConfig,
    enabled: Boolean(values.enabled),
    name: values.name.trim(),
    secretRefs: parseRecordJSON(values.secretRefsJson, 'Secret refs'),
    status: values.status || 'disabled',
    type: values.type || 'oidc',
  }
}

function defaultOIDCClientValues(): OIDCClientFormValues {
  return {
    accessTokenTtlSeconds: 3600,
    allowedGrantTypes: defaultGrantTypes,
    allowedScopes: defaultScopes,
    clientId: '',
    clientSecret: '',
    idTokenTtlSeconds: 300,
    redirectUris: [],
    refreshTokenTtlSeconds: 0,
    requirePkce: true,
    status: 'enabled',
  }
}

function oidcClientValuesFor(client: IdentityOIDCClient): OIDCClientFormValues {
  return {
    accessTokenTtlSeconds: client.accessTokenTtlSeconds,
    allowedGrantTypes: defaultGrantTypes,
    allowedScopes: client.allowedScopes ?? defaultScopes,
    clientId: client.clientId,
    clientSecret: '',
    idTokenTtlSeconds: client.idTokenTtlSeconds,
    redirectUris: client.redirectUris ?? [],
    refreshTokenTtlSeconds: 0,
    requirePkce: client.requirePkce,
    status: client.status,
  }
}

function oidcClientInputFromValues(
  providerID: string,
  values: OIDCClientFormValues,
): IdentityOIDCClientInput {
  const clientSecret = values.clientSecret.trim()
  return {
    accessTokenTtlSeconds: Number(values.accessTokenTtlSeconds || 3600),
    allowedGrantTypes: defaultGrantTypes,
    allowedScopes: compactStrings(values.allowedScopes),
    clientId: values.clientId.trim(),
    clientSecret: clientSecret || undefined,
    idTokenTtlSeconds: Number(values.idTokenTtlSeconds || 300),
    providerId: providerID,
    redirectUris: compactStrings(values.redirectUris),
    refreshTokenTtlSeconds: 0,
    requirePkce: Boolean(values.requirePkce),
    status: values.status || 'enabled',
  }
}

function statusTag(status: IdentityRuntimeProviderStatus) {
  const meta = providerStatusMeta[status] ?? providerStatusMeta.disabled
  return <Tag color={meta.color}>{meta.label}</Tag>
}

function clientStatusTag(status: IdentityOIDCClientStatus) {
  const meta = oidcClientStatusMeta[status] ?? oidcClientStatusMeta.disabled
  return <Tag color={meta.color}>{meta.label}</Tag>
}

function tagsSummary(values: string[], empty = '-') {
  const items = values ?? []
  if (!items.length) return <Text type="secondary">{empty}</Text>
  return (
    <Space size={[4, 4]} wrap>
      {items.slice(0, 4).map((value) => (
        <Tag key={value}>{value}</Tag>
      ))}
      {items.length > 4 ? <Tag>+{items.length - 4}</Tag> : null}
    </Space>
  )
}

function ProviderNameCell({ provider }: { provider: IdentityProvider }) {
  return (
    <div className="soha-identity-provider-name-cell">
      <div className="soha-identity-provider-icon">
        <ApiOutlined />
      </div>
      <div className="soha-identity-provider-copy">
        <Text strong ellipsis title={provider.name}>
          {provider.name}
        </Text>
        <Text type="secondary" ellipsis title={provider.id}>
          {provider.id}
        </Text>
      </div>
    </div>
  )
}

function ProxyConfigFields({
  outpostLoading,
  outpostOptions,
}: {
  outpostLoading: boolean
  outpostOptions: Array<{ label: string; value: string }>
}) {
  return (
    <div className="soha-identity-provider-config-section">
      <div className="soha-identity-provider-section-title">Proxy runtime</div>
      <div className="soha-identity-provider-form-grid">
        <Form.Item
          label="External hosts"
          name="proxyExternalHosts"
          rules={[{ required: true, message: '至少配置一个 External host' }]}
        >
          <Select mode="tags" placeholder="grafana.example.com" tokenSeparators={[',']} />
        </Form.Item>
        <Form.Item label="Upstream URL" name="proxyUpstreamUrl">
          <Input placeholder="http://grafana.monitoring.svc:3000" />
        </Form.Item>
        <Form.Item label="Mode" name="proxyMode">
          <Select options={proxyModeOptions} />
        </Form.Item>
        <Form.Item label="Cookie domain" name="proxyCookieDomain">
          <Input placeholder=".example.com" />
        </Form.Item>
        <Form.Item label="Protected path prefix" name="proxyPathPrefix">
          <Input placeholder="/" />
        </Form.Item>
        <Form.Item label="Outpost" name="proxyOutpostId">
          <Select
            allowClear
            loading={outpostLoading}
            options={outpostOptions}
            placeholder="Embedded forward-auth"
            showSearch={{ optionFilterProp: 'label' }}
          />
        </Form.Item>
      </div>

      <Form.Item label="Skip auth paths" name="proxySkipAuthPaths">
        <Select mode="tags" placeholder="/healthz, /public" tokenSeparators={[',']} />
      </Form.Item>

      <Form.Item label="WebSocket enabled" name="proxyWebsocketEnabled" valuePropName="checked">
        <Switch />
      </Form.Item>

      <div className="soha-identity-provider-section-title">Identity headers</div>
      <div className="soha-identity-provider-form-grid is-three">
        <Form.Item label="User header" name="proxyHeaderUser">
          <Input placeholder={defaultProxyHeaders.user} />
        </Form.Item>
        <Form.Item label="User ID header" name="proxyHeaderUserId">
          <Input placeholder={defaultProxyHeaders.userId} />
        </Form.Item>
        <Form.Item label="Email header" name="proxyHeaderEmail">
          <Input placeholder={defaultProxyHeaders.email} />
        </Form.Item>
        <Form.Item label="Roles header" name="proxyHeaderRoles">
          <Input placeholder={defaultProxyHeaders.roles} />
        </Form.Item>
        <Form.Item label="Teams header" name="proxyHeaderTeams">
          <Input placeholder={defaultProxyHeaders.teams} />
        </Form.Item>
        <Form.Item label="Groups header" name="proxyHeaderGroups">
          <Input placeholder={defaultProxyHeaders.groups} />
        </Form.Item>
      </div>
    </div>
  )
}

function OIDCClientsPanel({
  canManage,
  onSecretCreated,
  provider,
}: {
  canManage: boolean
  onSecretCreated: (secret: SecretRevealState) => void
  provider: IdentityProvider
}) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<IdentityOIDCClient | null>(null)
  const [form] = Form.useForm<OIDCClientFormValues>()

  const clientsQuery = useQuery({
    enabled: provider.type === 'oidc',
    queryKey: identityProviderQueryKeys.oidcClients(provider.id),
    queryFn: () => listIdentityOIDCClients(provider.id),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: identityProviderQueryKeys.oidcClients(provider.id),
    })
  }

  const createMutation = useMutation({
    mutationFn: (input: IdentityOIDCClientInput) => createIdentityOIDCClient(provider.id, input),
    onSuccess: (result) => {
      message.success(`已创建 OIDC client ${result?.client?.clientId ?? ''}`)
      setModalOpen(false)
      setEditing(null)
      invalidate()
      if (result?.clientSecret) {
        onSecretCreated({
          clientId: result.client.clientId,
          clientSecret: result.clientSecret,
        })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: IdentityOIDCClientInput }) =>
      updateIdentityOIDCClient(id, input),
    onSuccess: (client) => {
      message.success(`已更新 OIDC client ${client?.clientId ?? ''}`)
      setModalOpen(false)
      setEditing(null)
      invalidate()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (clientID: string) => deleteIdentityOIDCClient(clientID),
    onSuccess: () => {
      message.success('OIDC client 已删除')
      invalidate()
    },
  })

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue(defaultOIDCClientValues())
    setModalOpen(true)
  }

  const openEdit = (client: IdentityOIDCClient) => {
    setEditing(client)
    form.setFieldsValue(oidcClientValuesFor(client))
    setModalOpen(true)
  }

  const submitForm = (values: OIDCClientFormValues) => {
    const input = oidcClientInputFromValues(provider.id, values)
    if (editing) {
      updateMutation.mutate({ id: editing.id, input })
      return
    }
    createMutation.mutate(input)
  }

  const columns = useMemo<TableColumnsType<IdentityOIDCClient>>(
    () => [
      {
        title: 'Client',
        dataIndex: 'clientId',
        width: 240,
        render: (value: string, record) => (
          <Space orientation="vertical" size={2}>
            <Text strong ellipsis title={value}>
              {value}
            </Text>
            <Text type="secondary" ellipsis title={record.id}>
              {record.id}
            </Text>
          </Space>
        ),
      },
      {
        title: 'Redirect URIs',
        dataIndex: 'redirectUris',
        width: 320,
        render: (values: string[]) => tagsSummary(values),
      },
      {
        title: 'Scopes',
        dataIndex: 'allowedScopes',
        width: 220,
        render: (values: string[]) => tagsSummary(values),
      },
      {
        title: 'Grant Types',
        dataIndex: 'allowedGrantTypes',
        width: 180,
        render: (values: string[]) => tagsSummary(values),
      },
      {
        title: 'TTL',
        key: 'ttl',
        width: 170,
        render: (_, record) => (
          <Space orientation="vertical" size={2}>
            <Text>access {record.accessTokenTtlSeconds}s</Text>
            <Text type="secondary">id {record.idTokenTtlSeconds}s</Text>
          </Space>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        width: 130,
        render: (value: IdentityOIDCClientStatus, record) => (
          <Space orientation="vertical" size={2}>
            {clientStatusTag(value)}
            <Tag color={record.requirePkce ? 'blue' : 'default'}>
              {record.requirePkce ? 'PKCE' : 'No PKCE'}
            </Tag>
          </Space>
        ),
      },
      {
        title: 'Updated',
        dataIndex: 'updatedAt',
        width: 140,
        render: formatDateTime,
      },
      {
        title: 'Actions',
        key: 'actions',
        fixed: 'right',
        width: 128,
        render: (_, record) => (
          <Space size={4}>
            <ManagementIconButton
              disabled={!canManage}
              icon={<EditOutlined />}
              tooltip="编辑"
              onClick={() => openEdit(record)}
            />
            <Popconfirm
              cancelText="取消"
              disabled={!canManage}
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              okText="删除"
              title={`删除 ${record.clientId}`}
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Button danger disabled={!canManage} icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [canManage, deleteMutation],
  )

  const saving = createMutation.isPending || updateMutation.isPending

  if (provider.type !== 'oidc') {
    return (
      <ManagementState
        compact
        kind="unsupported"
        title="Proxy Provider runtime 尚未启用"
        description="当前阶段只管理 OIDC client。"
      />
    )
  }

  return (
    <div className="soha-identity-oidc-panel">
      <AdminTable
        rowKey="id"
        columns={columns}
        dataSource={clientsQuery.data ?? []}
        empty={
          <ManagementState
            kind="empty"
            title="暂无 OIDC client"
            description="创建 client 后可接入下游 OIDC 应用。"
          />
        }
        loading={clientsQuery.isLoading || clientsQuery.isFetching}
        title="OIDC Clients"
        toolbar={
          <ManagementTableToolbar>
            <Button
              disabled={!canManage}
              icon={<PlusOutlined />}
              size="small"
              type="primary"
              onClick={openCreate}
            >
              新建 client
            </Button>
            <Button icon={<ReloadOutlined />} size="small" onClick={() => clientsQuery.refetch()}>
              刷新
            </Button>
          </ManagementTableToolbar>
        }
      />

      <Modal
        destroyOnHidden
        footer={null}
        open={modalOpen}
        title={editing ? '编辑 OIDC client' : '新建 OIDC client'}
        width={840}
        onCancel={() => {
          setModalOpen(false)
          setEditing(null)
        }}
      >
        <Form
          form={form}
          className="soha-identity-provider-form"
          initialValues={defaultOIDCClientValues()}
          layout="vertical"
          onFinish={submitForm}
        >
          <div className="soha-identity-provider-form-grid">
            <Form.Item
              label="Client ID"
              name="clientId"
              rules={[{ required: true, message: '请输入 Client ID' }]}
            >
              <Input placeholder="grafana" />
            </Form.Item>
            <Form.Item label="Client Secret" name="clientSecret">
              <Input.Password placeholder={editing ? '留空表示不轮换' : '留空自动生成'} />
            </Form.Item>
            <Form.Item label="Status" name="status">
              <Select options={oidcClientStatusOptions} />
            </Form.Item>
            <Form.Item label="Require PKCE" name="requirePkce" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>

          <Form.Item
            label="Redirect URIs"
            name="redirectUris"
            rules={[{ required: true, message: '至少配置一个 Redirect URI' }]}
          >
            <Select
              mode="tags"
              placeholder="https://grafana.example.com/login/generic_oauth"
              tokenSeparators={[',']}
            />
          </Form.Item>

          <div className="soha-identity-provider-form-grid">
            <Form.Item label="Allowed scopes" name="allowedScopes">
              <Select mode="tags" tokenSeparators={[',']} />
            </Form.Item>
            <Form.Item
              extra="当前 Provider baseline 仅启用 Authorization Code，Refresh Token flow 预留。"
              label="Allowed grant types"
              name="allowedGrantTypes"
            >
              <Select disabled mode="multiple" options={oidcGrantTypeOptions} />
            </Form.Item>
          </div>

          <div className="soha-identity-provider-form-grid is-three">
            <Form.Item label="Access token TTL" name="accessTokenTtlSeconds">
              <InputNumber min={60} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="ID token TTL" name="idTokenTtlSeconds">
              <InputNumber min={60} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              extra="Refresh Token 尚未签发，当前固定为 0。"
              label="Refresh token TTL"
              name="refreshTokenTtlSeconds"
            >
              <InputNumber disabled min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div className="soha-identity-provider-form-actions">
            <Button
              onClick={() => {
                setModalOpen(false)
                setEditing(null)
              }}
            >
              取消
            </Button>
            <Button htmlType="submit" loading={saving} type="primary">
              保存
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export function IdentityProvidersPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({ query: '', status: '', type: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<IdentityProvider | null>(null)
  const [createdSecret, setCreatedSecret] = useState<SecretRevealState | null>(null)
  const [formProviderType, setFormProviderType] = useState<IdentityRuntimeProviderType>('oidc')
  const [form] = Form.useForm<ProviderFormValues>()
  const snapshot = usePermissionSnapshot().data?.data
  const canManage = hasPermission(snapshot, 'identity.providers.manage')

  const providersQuery = useQuery({
    queryKey: identityProviderQueryKeys.providers({
      status: filters.status,
      type: filters.type,
    }),
    queryFn: () =>
      listIdentityProviders({
        status: filters.status,
        type: filters.type,
      }),
  })
  const applicationsQuery = useQuery({
    queryKey: identityApplicationQueryKeys.applications({}),
    queryFn: () => listIdentityApplications({}),
  })
  const outpostsQuery = useQuery({
    enabled: modalOpen && formProviderType === 'proxy',
    queryKey: identityOutpostQueryKeys.outposts({}),
    queryFn: () => listIdentityOutposts({}),
  })

  const applications = applicationsQuery.data ?? []
  const applicationByID = useMemo(() => {
    const out = new Map<string, IdentityApplication>()
    applications.forEach((application) => out.set(application.id, application))
    return out
  }, [applications])
  const applicationOptions = useMemo(
    () =>
      applications.map((application) => ({
        label: `${application.name} (${application.slug})`,
        value: application.id,
      })),
    [applications],
  )
  const outpostOptions = useMemo(
    () =>
      (outpostsQuery.data ?? []).map((outpost) => ({
        label: `${outpost.name} (${outpost.mode})`,
        value: outpost.id,
      })),
    [outpostsQuery.data],
  )

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['identity', 'providers'] })
  }

  const createMutation = useMutation({
    mutationFn: (input: IdentityProviderInput) => createIdentityProvider(input),
    onSuccess: (provider) => {
      message.success(`已创建 ${provider?.name ?? 'Provider'}`)
      setModalOpen(false)
      setEditing(null)
      invalidate()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: IdentityProviderInput }) =>
      updateIdentityProvider(id, input),
    onSuccess: (provider) => {
      message.success(`已更新 ${provider?.name ?? 'Provider'}`)
      setModalOpen(false)
      setEditing(null)
      invalidate()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteIdentityProvider(id),
    onSuccess: () => {
      message.success('Provider 已删除')
      invalidate()
    },
  })

  const openCreate = () => {
    setEditing(null)
    setFormProviderType('oidc')
    form.setFieldsValue(defaultProviderValues())
    setModalOpen(true)
  }

  const openEdit = (provider: IdentityProvider) => {
    setEditing(provider)
    setFormProviderType(provider.type)
    form.setFieldsValue(providerValuesFor(provider))
    setModalOpen(true)
  }

  const submitForm = (values: ProviderFormValues) => {
    let input: IdentityProviderInput
    try {
      input = providerInputFromValues(values)
    } catch (error) {
      message.error(getErrorMessage(error))
      return
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, input })
      return
    }
    createMutation.mutate(input)
  }

  const filteredProviders = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    const providers = providersQuery.data ?? []
    if (!query) return providers
    return providers.filter((provider) => {
      const application = applicationByID.get(provider.applicationId)
      return [
        provider.name,
        provider.id,
        provider.applicationId,
        application?.name,
        application?.slug,
      ].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query),
      )
    })
  }, [applicationByID, filters.query, providersQuery.data])

  const columns = useMemo<TableColumnsType<IdentityProvider>>(
    () => [
      {
        title: 'Provider',
        dataIndex: 'name',
        width: 300,
        render: (_, record) => <ProviderNameCell provider={record} />,
      },
      {
        title: 'Type',
        dataIndex: 'type',
        width: 140,
        render: (value: IdentityRuntimeProviderType) => (
          <Tag color={value === 'oidc' ? 'blue' : 'gold'}>{value.toUpperCase()}</Tag>
        ),
      },
      {
        title: 'Application',
        dataIndex: 'applicationId',
        width: 260,
        render: (value: string) => {
          const application = applicationByID.get(value)
          return (
            <Space orientation="vertical" size={2}>
              <Text ellipsis title={application?.name ?? value}>
                {application?.name ?? value}
              </Text>
              {application?.slug ? <Text type="secondary">{application.slug}</Text> : null}
            </Space>
          )
        },
      },
      {
        title: 'Status',
        dataIndex: 'status',
        width: 150,
        render: (value: IdentityRuntimeProviderStatus, record) => (
          <Space orientation="vertical" size={2}>
            {statusTag(value)}
            <Tag color={record.enabled ? 'green' : 'default'}>
              {record.enabled ? 'Runtime on' : 'Runtime off'}
            </Tag>
          </Space>
        ),
      },
      {
        title: 'Updated',
        dataIndex: 'updatedAt',
        width: 140,
        render: formatDateTime,
      },
      {
        title: 'Actions',
        key: 'actions',
        fixed: 'right',
        width: 128,
        render: (_, record) => (
          <Space size={4}>
            <ManagementIconButton
              disabled={!canManage}
              icon={<EditOutlined />}
              tooltip="编辑"
              onClick={() => openEdit(record)}
            />
            <Popconfirm
              cancelText="取消"
              disabled={!canManage}
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              okText="删除"
              title={`删除 ${record.name}`}
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Button danger disabled={!canManage} icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [applicationByID, canManage, deleteMutation],
  )

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="soha-page soha-identity-providers-page">
      <ManagementDetailHeader
        actions={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => providersQuery.refetch()}>
              刷新
            </Button>
            <Button
              disabled={!canManage}
              icon={<PlusOutlined />}
              type="primary"
              onClick={openCreate}
            >
              新建 Provider
            </Button>
          </Space>
        }
        description="管理 Soha 对下游应用暴露的 OIDC / Proxy Provider。OIDC client 可在展开行中维护。"
        title="Identity Providers"
      />

      <AdminTable
        rowKey="id"
        columns={columns}
        dataSource={filteredProviders}
        empty={
          <ManagementState
            kind="empty"
            title="暂无 Provider"
            description="创建 Provider 后可为下游应用提供统一登录。"
          />
        }
        expandable={{
          expandedRowRender: (record: IdentityProvider) => (
            <OIDCClientsPanel
              canManage={canManage}
              provider={record}
              onSecretCreated={setCreatedSecret}
            />
          ),
          rowExpandable: (record: IdentityProvider) => record.type === 'oidc',
        }}
        loading={providersQuery.isLoading || providersQuery.isFetching}
        title="Provider 列表"
        toolbar={
          <ManagementTableToolbar>
            <ManagementToolbarSearch
              placeholder="搜索 Provider 或应用"
              value={filters.query}
              onChange={(value) => setFilters((current) => ({ ...current, query: value }))}
            />
            <Select
              allowClear
              placeholder="类型"
              style={{ width: 140 }}
              options={providerTypeOptions}
              value={filters.type || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, type: value ?? '' }))}
            />
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 150 }}
              options={providerStatusOptions}
              value={filters.status || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, status: value ?? '' }))}
            />
          </ManagementTableToolbar>
        }
      />

      <Modal
        destroyOnHidden
        footer={null}
        open={modalOpen}
        title={editing ? '编辑 Provider' : '新建 Provider'}
        width={860}
        onCancel={() => {
          setModalOpen(false)
          setEditing(null)
        }}
      >
        <Form
          form={form}
          className="soha-identity-provider-form"
          initialValues={defaultProviderValues()}
          layout="vertical"
          onValuesChange={(changedValues: Partial<ProviderFormValues>) => {
            if (changedValues.type) {
              setFormProviderType(changedValues.type)
            }
          }}
          onFinish={submitForm}
        >
          <div className="soha-identity-provider-form-grid">
            <Form.Item
              label="名称"
              name="name"
              rules={[{ required: true, message: '请输入 Provider 名称' }]}
            >
              <Input placeholder="Grafana OIDC" />
            </Form.Item>
            <Form.Item
              label="Application"
              name="applicationId"
              rules={[{ required: true, message: '请选择应用' }]}
            >
              <Select
                loading={applicationsQuery.isLoading || applicationsQuery.isFetching}
                options={applicationOptions}
                placeholder="选择下游应用"
                showSearch={{ optionFilterProp: 'label' }}
              />
            </Form.Item>
            <Form.Item label="Type" name="type">
              <Select options={providerTypeOptions} />
            </Form.Item>
            <Form.Item label="Status" name="status">
              <Select options={providerStatusOptions} />
            </Form.Item>
          </div>

          <Form.Item label="Enabled" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          {formProviderType === 'proxy' ? (
            <ProxyConfigFields
              outpostLoading={outpostsQuery.isLoading || outpostsQuery.isFetching}
              outpostOptions={outpostOptions}
            />
          ) : null}

          <div className="soha-identity-provider-json-grid">
            <Form.Item
              label={formProviderType === 'proxy' ? 'Advanced config JSON' : 'Config JSON'}
              name="configJson"
            >
              <Input.TextArea autoSize={{ minRows: 5, maxRows: 10 }} />
            </Form.Item>
            <Form.Item label="Secret refs JSON" name="secretRefsJson">
              <Input.TextArea autoSize={{ minRows: 5, maxRows: 10 }} />
            </Form.Item>
          </div>

          <div className="soha-identity-provider-form-actions">
            <Button
              onClick={() => {
                setModalOpen(false)
                setEditing(null)
              }}
            >
              取消
            </Button>
            <Button htmlType="submit" loading={saving} type="primary">
              保存
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        okText="我已保存"
        open={Boolean(createdSecret)}
        title="OIDC Client Secret"
        onCancel={() => setCreatedSecret(null)}
        onOk={() => setCreatedSecret(null)}
      >
        <Space className="soha-identity-secret-reveal" orientation="vertical" size={12}>
          <Alert
            showIcon
            type="warning"
            title="Client secret 仅展示一次。关闭后需要轮换 secret 才能再次获得新值。"
          />
          <div>
            <Text type="secondary">Client ID</Text>
            <Paragraph copyable className="soha-identity-secret-value">
              {createdSecret?.clientId}
            </Paragraph>
          </div>
          <div>
            <Text type="secondary">Client Secret</Text>
            <Input.Password
              readOnly
              value={createdSecret?.clientSecret ?? ''}
              addonAfter={
                <Button
                  icon={<CopyOutlined />}
                  size="small"
                  type="text"
                  onClick={() => {
                    const value = createdSecret?.clientSecret
                    if (!value || !navigator.clipboard) return
                    navigator.clipboard.writeText(value).then(
                      () => message.success('已复制 client secret'),
                      () => message.error('复制失败'),
                    )
                  }}
                />
              }
            />
          </div>
        </Space>
      </Modal>
    </div>
  )
}
