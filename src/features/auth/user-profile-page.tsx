import type { ChangeEvent, CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Slider,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { DescriptionsProps, TableColumnsType, TabsProps } from 'antd'
import {
  ApiOutlined,
  EditOutlined,
  IdcardOutlined,
  KeyOutlined,
  LinkOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ManagementIconButton } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth/permission-snapshot'
import { consolePermissionLabelMap } from '@/features/auth/permission-catalog'
import type { CreatedPersonalAccessToken, PersonalAccessToken } from '@/features/copilot/ai-gateway-model'
import { api } from '@/services/api-client'
import { useAuthStore } from '@/stores/auth-store'
import type { ApiResponse, LinkedIdentity, UserProfile, UserSession } from '@/types'
import { formatDateTime, formatRelativeTime } from '@/utils/time'
import './user-profile-page.css'

const { Paragraph, Text, Title } = Typography

type GatewayTokenExpiration = '7d' | '30d' | '90d' | 'never' | 'custom'
type AvatarFit = 'cover' | 'contain' | 'fill'
type AvatarCrop = { x: number; y: number; zoom: number }

interface GatewayTokenFormValues {
  name: string
  permissionKeys?: string[]
  scopes?: string[]
  expiresIn?: GatewayTokenExpiration
  customExpiresAt?: string
}

interface ProfileFormValues {
  displayName?: string
  email: string
  phone?: string
  avatarUrl?: string
  avatarFit?: AvatarFit
}

interface AvatarFormValues {
  avatarUrl?: string
  avatarFit?: AvatarFit
}

interface PasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const gatewayPermissionOptions = ['ai.gateway.invoke', 'ai.gateway.view'].map((value) => ({
  label: consolePermissionLabelMap[value] ? `${consolePermissionLabelMap[value]} (${value})` : value,
  value,
}))

const gatewayExpirationOptions = [
  { label: '7 天', value: '7d' },
  { label: '30 天', value: '30d' },
  { label: '90 天', value: '90d' },
  { label: '不过期', value: 'never' },
  { label: '自定义', value: 'custom' },
]

const avatarFileMaxBytes = 512 * 1024
const avatarOutputSize = 160
const defaultAvatarCrop: AvatarCrop = { x: 0, y: 0, zoom: 1 }

function compact(value?: null | string) {
  return String(value || '').trim()
}

function valueOrUnset(value?: null | string) {
  return compact(value) || '未设置'
}

function providerLabel(value?: string) {
  const normalized = compact(value).toLowerCase()
  const labels: Record<string, string> = {
    password: '账号密码',
    oidc: 'OIDC',
    oauth2: 'OAuth2',
    saml: 'SAML',
    feishu: '飞书',
    dingtalk: '钉钉',
    wecom: '企业微信',
  }
  return labels[normalized] || valueOrUnset(value)
}

function providerTag(value?: string) {
  const normalized = compact(value).toLowerCase()
  const color = normalized === 'password' ? 'default' : normalized === 'oidc' ? 'processing' : 'success'
  return <Tag color={color}>{providerLabel(value)}</Tag>
}

function tagList(items?: string[], empty = '暂无') {
  const values = (items ?? []).map(compact).filter(Boolean)
  if (values.length === 0) {
    return <Text type="secondary">{empty}</Text>
  }
  return (
    <Space size={[6, 6]} wrap>
      {values.map((item) => <Tag key={item}>{item}</Tag>)}
    </Space>
  )
}

function compactTagList(items?: string[], max = 3) {
  const values = (items ?? []).map(compact).filter(Boolean)
  if (values.length === 0) {
    return <Text type="secondary">-</Text>
  }
  return (
    <Space className="soha-profile-compact-tags" size={[4, 4]} wrap>
      {values.slice(0, max).map((item) => <Tag key={item}>{item}</Tag>)}
      {values.length > max ? <Tag>+{values.length - max}</Tag> : null}
    </Space>
  )
}

function metadataText(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : '-'
}

function gatewayTokenStatus(record: Pick<PersonalAccessToken, 'expiresAt' | 'revokedAt'>) {
  if (record.revokedAt) return 'revoked'
  if (record.expiresAt) {
    const expiresAt = new Date(record.expiresAt).getTime()
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return 'expired'
  }
  return 'active'
}

function gatewayTokenExpiresAt(values: GatewayTokenFormValues) {
  const expiresIn = values.expiresIn ?? '30d'
  if (expiresIn === 'never') return undefined
  if (expiresIn === 'custom') return compact(values.customExpiresAt) || undefined
  const days = expiresIn === '7d' ? 7 : expiresIn === '90d' ? 90 : 30
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + days)
  return expiresAt.toISOString()
}

function validDateTime(value?: string) {
  if (!value) return true
  return Number.isFinite(new Date(value).getTime())
}

function defaultGatewayTokenName(profile?: UserProfile) {
  const base = compact(profile?.username) || compact(profile?.displayName) || 'user'
  return `${base}-gateway-key`
}

function normalizeAvatarFit(value?: string): AvatarFit {
  return value === 'contain' || value === 'fill' ? value : 'cover'
}

function avatarStyle(fit?: string) {
  return { '--soha-avatar-fit': normalizeAvatarFit(fit) } as CSSProperties
}

function readFileAsDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error ?? new Error('读取头像文件失败'))
    reader.readAsDataURL(file)
  })
}

function isDataAvatarURL(value?: string) {
  return compact(value).toLowerCase().startsWith('data:image/')
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('头像图片加载失败'))
    image.src = source
  })
}

async function cropAvatarDataURL(source: string, crop: AvatarCrop) {
  const image = await loadImage(source)
  const canvas = document.createElement('canvas')
  canvas.width = avatarOutputSize
  canvas.height = avatarOutputSize
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('浏览器不支持头像裁剪')
  }
  const baseScale = Math.max(avatarOutputSize / image.naturalWidth, avatarOutputSize / image.naturalHeight)
  const scale = baseScale * crop.zoom
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  context.drawImage(image, avatarOutputSize / 2 + crop.x - width / 2, avatarOutputSize / 2 + crop.y - height / 2, width, height)
  return canvas.toDataURL('image/png')
}

function avatarURLValid(value?: string) {
  const source = compact(value)
  if (!source) return true
  const lower = source.toLowerCase()
  if (lower.startsWith('data:image/') && lower.includes(';base64,')) return true
  try {
    const parsed = new URL(source)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function authUserFromProfile(profile: UserProfile) {
  return {
    userId: profile.userId,
    userName: valueOrUnset(profile.displayName || profile.username),
    username: profile.username,
    displayName: profile.displayName,
    email: profile.email,
    phone: profile.phone,
    avatarUrl: profile.avatarUrl,
    avatarFit: profile.avatarFit,
    status: profile.status,
    roles: profile.roles,
    teams: profile.teams,
    projects: profile.projects,
    tags: profile.tags,
  }
}

function tokenSummaryText(tokens: PersonalAccessToken[]) {
  const activeCount = tokens.filter((item) => gatewayTokenStatus(item) === 'active').length
  const expiredCount = tokens.filter((item) => gatewayTokenStatus(item) === 'expired').length
  const revokedCount = tokens.filter((item) => gatewayTokenStatus(item) === 'revoked').length
  return { activeCount, expiredCount, revokedCount }
}

export function UserProfilePage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const setAuthUser = useAuthStore((state) => state.setUser)
  const [profileForm] = Form.useForm<ProfileFormValues>()
  const [avatarForm] = Form.useForm<AvatarFormValues>()
  const [passwordForm] = Form.useForm<PasswordFormValues>()
  const [tokenForm] = Form.useForm<GatewayTokenFormValues>()
  const [profileOpen, setProfileOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [createTokenOpen, setCreateTokenOpen] = useState(false)
  const [oneTimeToken, setOneTimeToken] = useState<{ title: string; value: string; prefix?: string } | null>(null)
  const [avatarCrop, setAvatarCrop] = useState<AvatarCrop>(defaultAvatarCrop)
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null)
  const avatarDragRef = useRef<{ clientX: number; clientY: number; crop: AvatarCrop } | null>(null)
  const avatarUrlValue = Form.useWatch('avatarUrl', avatarForm)

  const { data, isLoading, error } = useQuery({
    queryKey: ['auth-profile'],
    queryFn: () => api.get<ApiResponse<UserProfile>>('/auth/profile'),
  })
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const canViewGatewayKeys = hasPermission(snapshot, 'ai.gateway.view')
  const canIssueGatewayKeys = hasPermission(snapshot, 'ai.gateway.invoke')

  const gatewayTokensQuery = useQuery({
    queryKey: ['ai-gateway', 'personal-access-tokens'],
    queryFn: () => api.get<ApiResponse<PersonalAccessToken[]>>('/ai-gateway/personal-access-tokens'),
    enabled: canViewGatewayKeys,
  })

  const profile = data?.data
  const gatewayTokens = gatewayTokensQuery.data?.data ?? []
  const gatewayTokenSummary = tokenSummaryText(gatewayTokens)
  const displayName = valueOrUnset(profile?.displayName || profile?.username)
  const avatarText = displayName === '未设置' ? 'U' : displayName.charAt(0).toUpperCase()
  const primaryIdentity = profile?.identities?.[0]
  const currentAvatarFit = normalizeAvatarFit(profile?.avatarFit)

  const openProfileEditor = () => {
    profileForm.setFieldsValue({
      displayName: profile?.displayName,
      email: profile?.email ?? '',
      phone: profile?.phone,
    })
    setProfileOpen(true)
  }

  const openAvatarEditor = () => {
    avatarForm.setFieldsValue({
      avatarUrl: profile?.avatarUrl ?? '',
      avatarFit: normalizeAvatarFit(profile?.avatarFit),
    })
    setAvatarCrop(defaultAvatarCrop)
    setAvatarOpen(true)
  }

  const openPasswordEditor = () => {
    passwordForm.resetFields()
    setPasswordOpen(true)
  }

  useEffect(() => {
    if (searchParams.get('changePassword') !== '1') return
    passwordForm.resetFields()
    setPasswordOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('changePassword')
    setSearchParams(next, { replace: true })
  }, [passwordForm, searchParams, setSearchParams])

  const openCreateToken = () => {
    tokenForm.setFieldsValue({
      name: defaultGatewayTokenName(profile),
      permissionKeys: ['ai.gateway.invoke'],
      scopes: [],
      expiresIn: '30d',
      customExpiresAt: undefined,
    })
    setCreateTokenOpen(true)
  }

  const refreshGatewayTokens = () => queryClient.invalidateQueries({ queryKey: ['ai-gateway', 'personal-access-tokens'] })

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      message.error('请选择图片文件')
      return
    }
    if (file.size > avatarFileMaxBytes) {
      message.error('头像文件不能超过 512KB')
      return
    }
    try {
      avatarForm.setFieldsValue({ avatarUrl: await readFileAsDataURL(file) })
      setAvatarCrop(defaultAvatarCrop)
    } catch (readError) {
      message.error(readError instanceof Error ? readError.message : '读取头像文件失败')
    }
  }

  const handleAvatarSubmit = async (values: AvatarFormValues) => {
    const source = compact(values.avatarUrl)
    try {
      updateProfileMutation.mutate({
        displayName: profile?.displayName,
        email: profile?.email ?? '',
        phone: profile?.phone,
        avatarUrl: source && isDataAvatarURL(source) ? await cropAvatarDataURL(source, avatarCrop) : source,
        avatarFit: 'cover',
      })
    } catch (cropError) {
      message.error(cropError instanceof Error ? cropError.message : '头像裁剪失败')
    }
  }

  const updateProfileMutation = useMutation<ApiResponse<UserProfile>, Error, ProfileFormValues>({
    mutationFn: (values) => api.patch<ApiResponse<UserProfile>>('/auth/profile', {
      displayName: compact(values.displayName),
      email: compact(values.email),
      phone: compact(values.phone),
      avatarUrl: values.avatarUrl === undefined ? compact(profile?.avatarUrl) : compact(values.avatarUrl),
      avatarFit: values.avatarFit === undefined ? currentAvatarFit : normalizeAvatarFit(values.avatarFit),
    }),
    onSuccess: (res, values) => {
      const updated = res.data
      if (values.avatarUrl !== undefined && compact(values.avatarUrl) && !compact(updated?.avatarUrl)) {
        message.error('头像保存未生效，请重试')
        return
      }
      queryClient.setQueryData(['auth-profile'], res)
      void queryClient.invalidateQueries({ queryKey: ['auth-profile'] })
      if (updated) {
        setAuthUser(authUserFromProfile(updated))
      }
      setProfileOpen(false)
      setAvatarOpen(false)
      profileForm.resetFields()
      avatarForm.resetFields()
      message.success('账号资料已更新')
    },
    onError: (mutationError) => message.error(mutationError.message),
  })

  const changePasswordMutation = useMutation<unknown, Error, PasswordFormValues>({
    mutationFn: (values) => api.post('/auth/profile/password', {
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    }),
    onSuccess: () => {
      setPasswordOpen(false)
      passwordForm.resetFields()
      message.success('密码已修改')
    },
    onError: (mutationError) => message.error(mutationError.message),
  })

  const createTokenMutation = useMutation<ApiResponse<CreatedPersonalAccessToken>, Error, GatewayTokenFormValues>({
    mutationFn: (values) => api.post<ApiResponse<CreatedPersonalAccessToken>>('/ai-gateway/personal-access-tokens', {
      name: values.name,
      permissionKeys: values.permissionKeys ?? [],
      scopes: values.scopes ?? [],
      expiresAt: gatewayTokenExpiresAt(values),
    }),
    onSuccess: (res) => {
      const created = res.data
      setCreateTokenOpen(false)
      tokenForm.resetFields()
      if (created?.value) {
        setOneTimeToken({
          title: 'Soha AI Gateway Login Key 已生成',
          value: created.value,
          prefix: created.token?.tokenPrefix,
        })
      }
      void refreshGatewayTokens()
      message.success('Gateway key 已生成')
    },
    onError: (mutationError) => message.error(mutationError.message),
  })

  const revokeTokenMutation = useMutation<unknown, Error, string>({
    mutationFn: (tokenId) => api.post(`/ai-gateway/personal-access-tokens/${tokenId}/revoke`),
    onSuccess: () => {
      void refreshGatewayTokens()
      message.success('Gateway key 已吊销')
    },
    onError: (mutationError) => message.error(mutationError.message),
  })

  const rotateTokenMutation = useMutation<ApiResponse<CreatedPersonalAccessToken>, Error, PersonalAccessToken>({
    mutationFn: (record) => api.post<ApiResponse<CreatedPersonalAccessToken>>(`/ai-gateway/personal-access-tokens/${record.id}/rotate`),
    onSuccess: (res) => {
      const created = res.data
      if (created?.value) {
        setOneTimeToken({
          title: 'Soha AI Gateway Login Key 已轮换',
          value: created.value,
          prefix: created.token?.tokenPrefix,
        })
      }
      void refreshGatewayTokens()
      message.success('Gateway key 已轮换')
    },
    onError: (mutationError) => message.error(mutationError.message),
  })

  const identityColumns = useMemo<TableColumnsType<LinkedIdentity>>(() => [
    {
      title: '登录方式',
      dataIndex: 'providerType',
      width: 120,
      render: (value: string) => providerTag(value),
    },
    {
      title: '提供方',
      dataIndex: 'providerId',
      width: 150,
      render: (value: string) => valueOrUnset(value),
    },
    {
      title: '外部账号',
      dataIndex: 'providerUserId',
      ellipsis: true,
      render: (value: string) => valueOrUnset(value),
    },
    {
      title: '关联资料',
      key: 'profile',
      width: 220,
      render: (_: unknown, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{valueOrUnset(record.displayName || record.email)}</Text>
          {record.email ? <Text type="secondary">{record.email}</Text> : null}
        </Space>
      ),
    },
    {
      title: '最近登录',
      dataIndex: 'lastLoginAt',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
  ], [])

  const sessionColumns = useMemo<TableColumnsType<UserSession>>(() => [
    {
      title: '登录方式',
      dataIndex: 'providerType',
      width: 120,
      render: (value: string) => providerTag(value),
    },
    {
      title: '来源',
      key: 'source',
      width: 110,
      render: (_: unknown, record) => metadataText(record.metadata, 'source'),
    },
    {
      title: 'IP',
      key: 'sourceIp',
      width: 140,
      ellipsis: true,
      render: (_: unknown, record) => metadataText(record.metadata, 'sourceIp'),
    },
    {
      title: '设备',
      key: 'userAgent',
      ellipsis: true,
      render: (_: unknown, record) => metadataText(record.metadata, 'userAgent'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: '最近活跃',
      dataIndex: 'lastSeenAt',
      width: 170,
      render: (value: string) => (
        <Space orientation="vertical" size={0}>
          <Text>{formatDateTime(value)}</Text>
          <Text type="secondary">{formatRelativeTime(value)}</Text>
        </Space>
      ),
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
  ], [])

  const gatewayTokenColumns = useMemo<TableColumnsType<PersonalAccessToken>>(() => [
    {
      title: 'Key',
      dataIndex: 'name',
      width: 210,
      ellipsis: true,
      render: (_: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.name || record.id}</Text>
          <Text type="secondary" copyable={{ text: record.tokenPrefix }}>{record.tokenPrefix}</Text>
        </Space>
      ),
    },
    {
      title: '权限',
      dataIndex: 'permissionKeys',
      className: 'soha-profile-gateway-tags-cell',
      width: 180,
      render: (value: string[]) => compactTagList(value, 3),
    },
    {
      title: 'Scopes',
      dataIndex: 'scopes',
      className: 'soha-profile-gateway-tags-cell',
      width: 110,
      render: (value: string[]) => compactTagList(value, 2),
    },
    {
      title: '最近使用',
      dataIndex: 'lastUsedAt',
      width: 135,
      render: (value: string) => (
        <Space orientation="vertical" size={0}>
          <Text>{formatDateTime(value)}</Text>
          {value ? <Text type="secondary">{formatRelativeTime(value)}</Text> : null}
        </Space>
      ),
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      width: 135,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: unknown, record) => <StatusTag value={gatewayTokenStatus(record)} />,
    },
    {
      title: '操作',
      key: 'actions',
      align: 'center',
      className: 'soha-table-actions-column',
      width: 64,
      render: (_: unknown, record) => (
        <Space className="soha-row-action-icons" size={2}>
          <Popconfirm
            title="轮换 Gateway key？"
            description="旧 key 会被吊销，新明文只展示一次。"
            okButtonProps={{ loading: rotateTokenMutation.isPending }}
            onConfirm={() => rotateTokenMutation.mutate(record)}
          >
            <ManagementIconButton
              size="small"
              tooltip="轮换"
              aria-label="轮换 Gateway key"
              icon={<ReloadOutlined />}
              loading={rotateTokenMutation.isPending}
              disabled={!canIssueGatewayKeys || !!record.revokedAt}
            />
          </Popconfirm>
          <Popconfirm
            title="吊销 Gateway key？"
            description="吊销后外部 AI Client 将不能再使用该 key 登录 Gateway。"
            okButtonProps={{ danger: true, loading: revokeTokenMutation.isPending }}
            onConfirm={() => revokeTokenMutation.mutate(record.id)}
          >
            <ManagementIconButton
              size="small"
              tooltip="吊销"
              aria-label="吊销 Gateway key"
              danger
              icon={<StopOutlined />}
              loading={revokeTokenMutation.isPending}
              disabled={!canIssueGatewayKeys || !!record.revokedAt}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ], [canIssueGatewayKeys, revokeTokenMutation, rotateTokenMutation])

  const descriptionItems = useMemo<DescriptionsProps['items']>(() => [
    { key: 'userId', label: 'ID', children: <Text copyable>{valueOrUnset(profile?.userId)}</Text>, span: 2 },
    { key: 'username', label: '用户名', children: valueOrUnset(profile?.username) },
    { key: 'displayName', label: '显示名', children: displayName },
    { key: 'email', label: '邮箱', children: valueOrUnset(profile?.email) },
    { key: 'phone', label: '电话', children: valueOrUnset(profile?.phone) },
    { key: 'status', label: '账号状态', children: profile?.status ? <StatusTag value={profile.status} /> : '未设置' },
    { key: 'lastLoginAt', label: '最近登录', children: formatDateTime(profile?.lastLoginAt) },
    { key: 'provider', label: '主要登录方式', children: providerTag(primaryIdentity?.providerType) },
  ], [displayName, primaryIdentity?.providerType, profile])

  const permissionItems = useMemo<DescriptionsProps['items']>(() => [
    { key: 'roles', label: '角色', children: tagList(profile?.roles) },
    { key: 'teams', label: '组织', children: tagList(profile?.teams) },
    { key: 'projects', label: '项目', children: tagList(profile?.projects) },
    { key: 'tags', label: '标签', children: tagList(profile?.tags) },
  ], [profile])

  const tabItems = useMemo<TabsProps['items']>(() => [
    {
      key: 'identities',
      label: '关联登录',
      children: (
        <Table
          columns={identityColumns}
          dataSource={profile?.identities ?? []}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联登录方式" /> }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 760 }}
          size="small"
        />
      ),
    },
    {
      key: 'sessions',
      label: '活跃会话',
      children: (
        <Table
          columns={sessionColumns}
          dataSource={profile?.sessions ?? []}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无活跃会话" /> }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 900 }}
          size="small"
        />
      ),
    },
    {
      key: 'access',
      label: '权限归属',
      children: (
        <Descriptions
          bordered
          column={1}
          items={permissionItems}
          size="small"
        />
      ),
    },
  ], [identityColumns, permissionItems, profile?.identities, profile?.sessions, sessionColumns])

  if (error) {
    return (
      <div className="soha-page">
        <Alert
          type="error"
          showIcon
          message="个人中心加载失败"
          description={(error as Error).message}
        />
      </div>
    )
  }

  if (isLoading || !profile) {
    return (
      <div className="soha-page soha-profile-page">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    )
  }

  const gatewayKeysUnavailable = !permissionSnapshotQuery.isLoading && !canViewGatewayKeys
  const gatewayKeysSummary = canViewGatewayKeys
    ? `${gatewayTokenSummary.activeCount} active / ${gatewayTokens.length} total`
    : '未授权'
  const avatarPreviewURL = avatarOpen && avatarUrlValue !== undefined
    ? compact(avatarUrlValue)
    : compact(profile.avatarUrl)
  const avatarCanCrop = isDataAvatarURL(avatarPreviewURL)

  return (
    <div className="soha-page soha-profile-page">
      <div className="soha-profile-layout">
        <Card className="soha-profile-summary-card" size="small">
          <div className="soha-profile-identity">
            <button className="soha-profile-avatar-button" type="button" aria-label="更换头像" onClick={openAvatarEditor}>
              <Avatar
                className="soha-profile-avatar"
                size={64}
                src={compact(profile.avatarUrl) || undefined}
                style={avatarStyle(currentAvatarFit)}
              >
                {avatarText}
              </Avatar>
              <span className="soha-profile-avatar-edit"><EditOutlined /></span>
            </button>
            <div className="soha-profile-identity__main">
              <Title level={4}>{displayName}</Title>
              <Text type="secondary">{profile.email || profile.username}</Text>
            </div>
          </div>
          <div className="soha-profile-summary-list">
            <div className="soha-profile-summary-item">
              <UserOutlined />
              <span>{valueOrUnset(profile.username)}</span>
            </div>
            <div className="soha-profile-summary-item">
              <MailOutlined />
              <span>{valueOrUnset(profile.email)}</span>
            </div>
            <div className="soha-profile-summary-item">
              <PhoneOutlined />
              <span>{valueOrUnset(profile.phone)}</span>
            </div>
            <div className="soha-profile-summary-item">
              <KeyOutlined />
              <span>{providerLabel(primaryIdentity?.providerType)}</span>
            </div>
          </div>
          <div className="soha-profile-kpi-grid">
            <div>
              <Text type="secondary">活跃会话</Text>
              <strong>{profile.sessions?.length ?? 0}</strong>
            </div>
            <div>
              <Text type="secondary">Gateway keys</Text>
              <strong>{gatewayKeysSummary}</strong>
            </div>
          </div>
          <div className="soha-profile-tag-section">
            <Text type="secondary">角色</Text>
            {tagList(profile.roles)}
          </div>
          <div className="soha-profile-tag-section">
            <Text type="secondary">组织</Text>
            {tagList(profile.teams)}
          </div>
        </Card>

        <div className="soha-profile-main">
          <Card
            size="small"
            title={(
              <Space>
                <IdcardOutlined />
                <span>账号资料</span>
              </Space>
            )}
            extra={(
              <Space className="soha-profile-actions" size={8} wrap>
                <Button
                  size="small"
                  aria-label="编辑资料"
                  icon={<EditOutlined />}
                  onClick={openProfileEditor}
                >
                  编辑信息
                </Button>
                <Button
                  size="small"
                  type="primary"
                  aria-label="修改密码"
                  icon={<LockOutlined />}
                  onClick={openPasswordEditor}
                >
                  修改密码
                </Button>
              </Space>
            )}
          >
            <Descriptions
              bordered
              column={{ xs: 1, md: 2 }}
              items={descriptionItems}
              size="small"
            />
          </Card>

          <Card
            className="soha-profile-gateway-card"
            size="small"
            title={(
              <Space>
                <ApiOutlined />
                <span>AI Gateway Login Key</span>
              </Space>
            )}
            extra={(
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                disabled={!canIssueGatewayKeys}
                onClick={openCreateToken}
              >
                生成 key
              </Button>
            )}
          >
            <div className="soha-profile-gateway-overview">
              <div>
                <Text strong>面向当前用户的 Soha Gateway 登录凭证</Text>
                <Paragraph type="secondary">
                  用于 soha-cli、MCP 客户端或外部 AI Client 以你的用户身份调用 Soha AI Gateway。明文只在生成或轮换后展示一次。
                </Paragraph>
              </div>
              <Space size={6} wrap>
                <Tag color="success">active {gatewayTokenSummary.activeCount}</Tag>
                <Tag>expired {gatewayTokenSummary.expiredCount}</Tag>
                <Tag>revoked {gatewayTokenSummary.revokedCount}</Tag>
              </Space>
            </div>

            {gatewayKeysUnavailable ? (
              <Alert
                type="warning"
                showIcon
                message="当前账号没有 AI Gateway key 查看权限"
                description="需要 ai.gateway.view 查看已有 key，需要 ai.gateway.invoke 生成、轮换或吊销个人 key。"
              />
            ) : (
              <Table
                columns={gatewayTokenColumns}
                dataSource={gatewayTokens}
                loading={gatewayTokensQuery.isLoading || permissionSnapshotQuery.isLoading}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 AI Gateway login key" /> }}
                pagination={false}
                rowKey="id"
                scroll={{ x: 920 }}
                size="small"
                tableLayout="fixed"
              />
            )}
          </Card>

          <Card
            size="small"
            title={(
              <Space>
                <SafetyCertificateOutlined />
                <span>安全与访问</span>
              </Space>
            )}
          >
            <Tabs items={tabItems} size="small" />
          </Card>
        </div>
      </div>

      <Modal
        title="更换头像"
        open={avatarOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={updateProfileMutation.isPending}
        destroyOnHidden
        onCancel={() => setAvatarOpen(false)}
        onOk={() => avatarForm.submit()}
      >
        <Form
          form={avatarForm}
          layout="vertical"
          size="small"
          onFinish={(values) => void handleAvatarSubmit(values)}
        >
          <div className="soha-profile-avatar-editor">
            {avatarCanCrop ? (
              <div
                className="soha-profile-avatar-crop"
                onPointerDown={(event) => {
                  avatarDragRef.current = { clientX: event.clientX, clientY: event.clientY, crop: avatarCrop }
                  event.currentTarget.setPointerCapture(event.pointerId)
                }}
                onPointerMove={(event) => {
                  const drag = avatarDragRef.current
                  if (!drag) return
                  setAvatarCrop({
                    ...drag.crop,
                    x: drag.crop.x + event.clientX - drag.clientX,
                    y: drag.crop.y + event.clientY - drag.clientY,
                  })
                }}
                onPointerUp={() => {
                  avatarDragRef.current = null
                }}
              >
                <img
                  src={avatarPreviewURL}
                  alt="头像预览"
                  draggable={false}
                  style={{ transform: `translate(${avatarCrop.x}px, ${avatarCrop.y}px) scale(${avatarCrop.zoom})` }}
                />
              </div>
            ) : (
              <Avatar
                className="soha-profile-avatar soha-profile-avatar-preview"
                size={96}
                src={avatarPreviewURL || undefined}
                style={avatarStyle(currentAvatarFit)}
              >
                {avatarText}
              </Avatar>
            )}
            <Space size={8} wrap>
              <Button icon={<UploadOutlined />} onClick={() => avatarFileInputRef.current?.click()}>
                上传图片
              </Button>
              <Button onClick={() => {
                avatarForm.setFieldsValue({ avatarUrl: '' })
                setAvatarCrop(defaultAvatarCrop)
              }}>
                清除头像
              </Button>
            </Space>
            {avatarCanCrop ? (
              <div className="soha-profile-avatar-zoom">
                <Text type="secondary">缩放</Text>
                <Slider
                  min={1}
                  max={3}
                  step={0.01}
                  value={avatarCrop.zoom}
                  tooltip={{ formatter: null }}
                  onChange={(value) => setAvatarCrop((crop) => ({ ...crop, zoom: Number(value) }))}
                />
              </div>
            ) : null}
            <input
              ref={avatarFileInputRef}
              className="soha-profile-avatar-file"
              hidden
              style={{ display: 'none' }}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleAvatarFileChange}
            />
          </div>
          <Form.Item
            name="avatarUrl"
            label="图片 URL"
            rules={[
              {
                validator: (_, value) => (
                  avatarURLValid(value)
                    ? Promise.resolve()
                    : Promise.reject(new Error('请输入 http(s) 图片地址或上传图片文件'))
                ),
              },
            ]}
          >
            <Input allowClear prefix={<LinkOutlined />} placeholder="https://example.com/avatar.png" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑账号资料"
        open={profileOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={updateProfileMutation.isPending}
        destroyOnHidden
        onCancel={() => setProfileOpen(false)}
        onOk={() => profileForm.submit()}
      >
        <Form
          form={profileForm}
          layout="vertical"
          size="small"
          onFinish={(values) => updateProfileMutation.mutate(values)}
        >
          <Form.Item name="displayName" label="显示名">
            <Input allowClear maxLength={64} placeholder="显示在控制台中的名称" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效邮箱' },
            ]}
          >
            <Input allowClear maxLength={120} />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input allowClear maxLength={32} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改密码"
        open={passwordOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={changePasswordMutation.isPending}
        destroyOnHidden
        onCancel={() => setPasswordOpen(false)}
        onOk={() => passwordForm.submit()}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          size="small"
          onFinish={(values) => changePasswordMutation.mutate(values)}
        >
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '新密码至少 8 位' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator: (_, value) => (
                  !value || getFieldValue('newPassword') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('两次输入的新密码不一致'))
                ),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="生成 Soha AI Gateway Login Key"
        open={createTokenOpen}
        okText="生成 key"
        cancelText="取消"
        confirmLoading={createTokenMutation.isPending}
        destroyOnHidden
        onCancel={() => setCreateTokenOpen(false)}
        onOk={() => tokenForm.submit()}
      >
        <Form
          form={tokenForm}
          layout="vertical"
          initialValues={{ permissionKeys: ['ai.gateway.invoke'], scopes: [], expiresIn: '30d' }}
          onFinish={(values) => createTokenMutation.mutate(values)}
        >
          <Form.Item name="name" label="Key 名称" rules={[{ required: true, message: '请输入 key 名称' }]}>
            <Input placeholder="例如 codex-local" />
          </Form.Item>
          <Form.Item name="permissionKeys" label="权限 keys">
            <Select mode="tags" tokenSeparators={[',', ' ']} options={gatewayPermissionOptions} />
          </Form.Item>
          <Form.Item name="scopes" label="Scopes">
            <Select mode="tags" tokenSeparators={[',', ' ']} placeholder="留空表示不额外收窄" />
          </Form.Item>
          <Form.Item name="expiresIn" label="有效期">
            <Select options={gatewayExpirationOptions} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.expiresIn !== next.expiresIn}>
            {({ getFieldValue }) => getFieldValue('expiresIn') === 'custom' ? (
              <Form.Item
                name="customExpiresAt"
                label="自定义过期时间"
                rules={[
                  { required: true, message: '请输入自定义过期时间' },
                  {
                    validator: (_, value) => (
                      validDateTime(value)
                        ? Promise.resolve()
                        : Promise.reject(new Error('请输入有效的 RFC3339 时间'))
                    ),
                  },
                ]}
              >
                <Input placeholder="例如 2026-06-30T00:00:00Z" />
              </Form.Item>
            ) : null}
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={oneTimeToken?.title}
        open={!!oneTimeToken}
        okText="我已保存"
        cancelButtonProps={{ style: { display: 'none' } }}
        destroyOnHidden
        onCancel={() => setOneTimeToken(null)}
        onOk={() => setOneTimeToken(null)}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="明文只展示一次"
            description="关闭后无法再次查看完整 key；如果丢失，需要轮换或重新生成。"
          />
          {oneTimeToken?.prefix ? (
            <Text type="secondary">Prefix: {oneTimeToken.prefix}</Text>
          ) : null}
          <Input.TextArea
            className="soha-profile-secret-value"
            readOnly
            autoSize={{ minRows: 3, maxRows: 6 }}
            value={oneTimeToken?.value}
          />
          <Paragraph copyable={{ text: oneTimeToken?.value ?? '' }} type="secondary">
            复制完整 key
          </Paragraph>
        </Space>
      </Modal>
    </div>
  )
}
