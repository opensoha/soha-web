import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Select,
  Segmented,
  Space,
  Statistic,
  Switch,
  Tag,
  Tabs,
  Typography,
  Tooltip,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined, PauseCircleOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useLocation, useSearchParams } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementKeywordField,
  ManagementIconButton,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementTableToolbar,
  useManagementTextFilter,
} from '@/components/management-list'
import { hasPermission, invalidateAuthz, usePermissionSnapshot } from '@/features/auth/permission-snapshot'
import { MENU_ICON_OPTIONS, isKnownMenuIcon, resolveMenuIcon } from '@/features/system/menu-icons'
import { normalizeMenuSection, resolveMenuSectionLabel } from '@/features/system/menu-schema'
import {
  MENU_WORKBENCH_LABELS,
  MENU_WORKBENCH_ORDER,
  buildAnnouncementLifecycle,
  buildAuditResourceLabel,
  buildMenuFormValues,
  buildMenuSectionFilterOptions,
  buildTargetScopeLabel,
  buildWorkbenchMenuTree,
  collectMenuDescendantIds,
  compactText,
  countDirectMenuChildren,
  filterMenuTree,
  findMenuItemByID,
  flattenMenuItems,
  getMenuVisibilityModeOptions,
  isTodayDate,
  normalizeMenuSubmitValues,
  prettifyAction,
  prettifyOperationType,
  stringifyPayload,
  summarizeMenuVisibility,
  summarizeMenuWorkbench,
} from '@/features/system/system-model'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { api } from '@/services/api-client'
import { formatDateTime, formatRelativeTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import {
  UsageSnapshotDiffView,
  UsageSnapshotPanel,
  UsageSnapshotRawJson,
  UsageSnapshotSummary,
  usageSnapshotFilterParams,
} from '@/features/system/usage-snapshot'
import type { ApiResponse } from '@/types'
import type {
  AccessRoleOption,
  Announcement,
  AuditLog,
  MenuItem,
  MenuWorkbenchSurface,
  OnlineUser,
  OperationLog,
} from '@/features/system/system-model'
import './system-pages.css'

export { filterMenuTree, getMenuDerivedPermissionKeys, summarizeMenuVisibility } from '@/features/system/system-model'

const { Paragraph, Text, Title } = Typography

const MODAL_FORM_LAYOUT = {
  labelAlign: 'left' as const,
  labelCol: { flex: '120px' },
  wrapperCol: { flex: 'auto' },
}

function buildQueryPath(path: string, params: Record<string, string>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    const trimmed = value.trim()
    if (trimmed) {
      search.set(key, trimmed)
    }
  })
  const queryString = search.toString()
  return queryString ? `${path}?${queryString}` : path
}

/* ─── Online Users ─── */

function SourceTag({ value }: { value?: string }) {
  const normalized = (value || '').toLowerCase()
  if (!normalized) return <>-</>
  if (normalized === 'console') return <Tag color="blue">Console</Tag>
  if (normalized === 'oidc') return <Tag color="green">OIDC</Tag>
  if (normalized === 'api') return <Tag color="orange">API</Tag>
  return <Tag>{value}</Tag>
}

export function OnlineUsersPage() {
  const location = useLocation()
  const sessionsBasePath = location.pathname.startsWith('/identity/') ? '/identity/sessions' : '/auth/sessions'
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [providerFilter, setProviderFilter] = useState<string>('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const canManageOnlineUsers =
    hasPermission(permissionSnapshotQuery.data?.data, 'system.online-users.manage') ||
    hasPermission(permissionSnapshotQuery.data?.data, 'identity.sessions.manage')

  const { data, isLoading } = useQuery({
    queryKey: ['online-users', sessionsBasePath],
    queryFn: () => api.get<ApiResponse<OnlineUser[]>>(sessionsBasePath),
    select: (response: any) => ({
      data: (response.data ?? []).map((item: any) => ({
        id: item.id,
        userId: item.userId,
        userName: item.userName,
        email: item.email,
        providerType: item.providerType,
        status: item.status,
        loginTime: item.createdAt,
        lastSeenAt: item.lastSeenAt,
        expiry: item.expiresAt,
        source: item.metadata?.source,
        sourceIp: item.metadata?.sourceIp,
        userAgent: item.metadata?.userAgent,
      })),
    }),
    refetchInterval: 10000,
  })

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => api.post(`${sessionsBasePath}/${sessionId}/revoke`),
    onSuccess: (_result, sessionId) => {
      void message.success('用户会话已下线')
      void queryClient.invalidateQueries({ queryKey: ['online-users', sessionsBasePath] })
      setSelectedSessionIds((current) => current.filter((id) => id !== sessionId))
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const batchRevokeMutation = useMutation({
    mutationFn: async (sessionIds: string[]) =>
      Promise.allSettled(sessionIds.map((sessionId) => api.post(`${sessionsBasePath}/${sessionId}/revoke`))),
    onSuccess: (results) => {
      const successCount = results.filter((item) => item.status === 'fulfilled').length
      const failureCount = results.length - successCount
      void message.success(failureCount > 0 ? `批量下线完成，成功 ${successCount}，失败 ${failureCount}` : `已批量下线 ${successCount} 个会话`)
      setSelectedSessionIds([])
      void queryClient.invalidateQueries({ queryKey: ['online-users', sessionsBasePath] })
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const sessions = data?.data ?? []
  const providerOptions = useMemo(
    () => Array.from(new Set(sessions.map((item: OnlineUser) => item.providerType).filter(Boolean))).sort().map((value) => ({
      value,
      label: value,
    })),
    [sessions],
  )
  const keywordFilteredSessions = useManagementTextFilter(sessions, searchKeyword, (item: OnlineUser) => [
    item.userId,
    item.userName,
    item.email,
    item.providerType,
    item.source,
    item.sourceIp,
    item.userAgent,
  ])
  const filteredSessions = useMemo(() => {
    return keywordFilteredSessions.filter((item: OnlineUser) => !providerFilter || item.providerType === providerFilter)
  }, [keywordFilteredSessions, providerFilter])
  const selectedSessions = useMemo(
    () => filteredSessions.filter((item: OnlineUser) => selectedSessionIds.includes(item.id)),
    [filteredSessions, selectedSessionIds],
  )

  const columns: TableColumnsType<OnlineUser> = [
    { title: '用户 ID', dataIndex: 'userId', width: 180, ellipsis: true },
    { title: '用户名', dataIndex: 'userName', width: 140 },
    { title: '邮箱', dataIndex: 'email', width: 240, ellipsis: true },
    { title: '登录方式', dataIndex: 'providerType', width: 120 },
    { title: '来源', dataIndex: 'source', width: 100, render: (value: string) => <SourceTag value={value} /> },
    { title: 'IP', dataIndex: 'sourceIp', width: 140, ellipsis: true, render: (value: string) => value || '-' },
    { title: '设备', dataIndex: 'userAgent', width: 280, ellipsis: true, render: (value: string) => value || '-' },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <StatusTag value={value} />,
    },
    { ...tableColumnPresets.datetime, title: '登录时间', dataIndex: 'loginTime', render: (_: string, record: OnlineUser) => formatDateTime(record.loginTime) },
    { ...tableColumnPresets.datetime, title: '最近活跃', dataIndex: 'lastSeenAt', render: (_: string, record: OnlineUser) => formatDateTime(record.lastSeenAt) },
    { title: '活跃时长', dataIndex: 'lastSeenAt', width: 120, render: (_: string, record: OnlineUser) => formatRelativeTime(record.lastSeenAt) },
    { ...tableColumnPresets.datetime, title: '过期时间', dataIndex: 'expiry', render: (_: string, record: OnlineUser) => formatDateTime(record.expiry) },
    {
      ...tableColumnPresets.action,
      title: '操作',
      width: 88,
      dataIndex: 'id',
      render: (_: string, record: OnlineUser) => (
        canManageOnlineUsers ? (
          <Popconfirm title="确认下线该用户会话？" onConfirm={() => revokeMutation.mutate(record.id)}>
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label="下线用户"
              loading={revokeMutation.isPending}
            />
          </Popconfirm>
        ) : '-'
      ),
    },
  ]

  return (
    <ManagementDataPage
      query={{
        onFinish: () => undefined,
        actions: (
          <ManagementQueryActions
            disabledReset={!providerFilter && !searchKeyword.trim()}
            onReset={() => {
              setProviderFilter('')
              setSearchKeyword('')
            }}
          />
        ),
        children: (
          <>
            <ManagementQueryField minWidth={160} width={180} label="登录方式">
              <Select
                allowClear
                placeholder="全部方式"
                value={providerFilter || undefined}
                onChange={(value) => setProviderFilter(value || '')}
                options={providerOptions}
              />
            </ManagementQueryField>
            <ManagementKeywordField
              label="关键字"
              placeholder="搜索用户 / 邮箱 / IP / 设备"
              value={searchKeyword}
              onChange={setSearchKeyword}
            />
          </>
        ),
      }}
      table={{
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        headerExtra: canManageOnlineUsers ? (
          <ManagementTableToolbar>
            <Button
              size="small"
              danger
              variant="outlined"
              disabled={selectedSessions.length === 0}
              loading={batchRevokeMutation.isPending}
              onClick={() => batchRevokeMutation.mutate(selectedSessions.map((item: OnlineUser) => item.id))}
            >
              {`批量下线 (${selectedSessions.length})`}
            </Button>
          </ManagementTableToolbar>
        ) : null,
        columns,
        dataSource: filteredSessions,
        rowKey: 'id',
        loading: isLoading,
        pageSize: 20,
        scroll: { x: 'max-content' },
        rowSelection: canManageOnlineUsers ? {
          selectedRowKeys: selectedSessionIds,
          onChange: (selectedRowKeys: React.Key[]) => setSelectedSessionIds(selectedRowKeys.map(String)),
        } : undefined,
      }}
    />
  )
}

/* ─── Announcements ─── */

export function AnnouncementsPage() {
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [previewing, setPreviewing] = useState<Announcement | null>(null)
  const [statusView, setStatusView] = useState('all')
  const canManageAnnouncements = hasPermission(permissionSnapshotQuery.data?.data, 'system.announcements.manage')

  const { data, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.get<ApiResponse<Announcement[]>>('/announcements'),
  })

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.post('/announcements', values),
    onSuccess: () => {
      void message.success('公告创建成功')
      void queryClient.invalidateQueries({ queryKey: ['announcements'] })
      setModalVisible(false)
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      api.put(`/announcements/${id}`, values),
    onSuccess: () => {
      void message.success('公告更新成功')
      void queryClient.invalidateQueries({ queryKey: ['announcements'] })
      setModalVisible(false)
      setEditing(null)
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.post<ApiResponse<Announcement>>(`/announcements/${id}/publish`),
    onSuccess: () => {
      void message.success('公告已发布')
      void queryClient.invalidateQueries({ queryKey: ['announcements'] })
      void queryClient.invalidateQueries({ queryKey: ['announcements', 'inbox'] })
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => api.post<ApiResponse<Announcement>>(`/announcements/${id}/withdraw`),
    onSuccess: () => {
      void message.success('公告已撤回')
      void queryClient.invalidateQueries({ queryKey: ['announcements'] })
      void queryClient.invalidateQueries({ queryKey: ['announcements', 'inbox'] })
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      void message.success('公告已删除')
      void queryClient.invalidateQueries({ queryKey: ['announcements'] })
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const normalizeAnnouncementFormValues = (values: Record<string, unknown>) => ({
    ...values,
    startsAt: values.startsAt ? dayjs(values.startsAt as dayjs.Dayjs).toISOString() : null,
    endsAt: values.endsAt ? dayjs(values.endsAt as dayjs.Dayjs).toISOString() : null,
    audience: 'all',
  })

  const handleSubmit = (values: Record<string, unknown>) => {
    const payload = normalizeAnnouncementFormValues(values)
    if (editing) {
      updateMutation.mutate({ id: editing.id, values: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const announcements = data?.data ?? []

  const announcementSummary = useMemo(() => {
    const published = announcements.filter((item) => buildAnnouncementLifecycle(item) === 'published').length
    const draft = announcements.filter((item) => buildAnnouncementLifecycle(item) === 'draft').length
    const scheduled = announcements.filter((item) => buildAnnouncementLifecycle(item) === 'scheduled').length
    const sticky = announcements.filter((item) => item.sticky).length
    return { published, draft, scheduled, sticky }
  }, [announcements])

  const filteredAnnouncements = useMemo(() => {
    if (statusView === 'all') return announcements
    return announcements.filter((item) => buildAnnouncementLifecycle(item) === statusView)
  }, [announcements, statusView])

  const announcementTabs = [
    { key: 'all', label: `全部 (${announcements.length})` },
    { key: 'published', label: `已发布 (${announcementSummary.published})` },
    { key: 'draft', label: `草稿 (${announcementSummary.draft})` },
    { key: 'scheduled', label: `待生效 (${announcementSummary.scheduled})` },
  ]

  const renderAnnouncementActions = (record: Announcement) => (
    <Space className="soha-row-action-icons">
      <ManagementIconButton
        aria-label="预览公告"
        icon={<EyeOutlined />}
        size="small"
        tooltip="预览"
        onClick={() => setPreviewing(record)}
      />
      {canManageAnnouncements ? (
        <ManagementIconButton
          aria-label="编辑公告"
          icon={<EditOutlined />}
          size="small"
          tooltip="编辑"
          onClick={() => { setEditing(record); setModalVisible(true) }}
        />
      ) : null}
      {canManageAnnouncements && buildAnnouncementLifecycle(record) !== 'published' ? (
        <ManagementIconButton
          aria-label="发布公告"
          icon={<SendOutlined />}
          size="small"
          tooltip="发布"
          onClick={() => publishMutation.mutate(record.id)}
          loading={publishMutation.isPending && publishMutation.variables === record.id}
        />
      ) : null}
      {canManageAnnouncements && buildAnnouncementLifecycle(record) === 'published' ? (
        <ManagementIconButton
          aria-label="撤回公告"
          icon={<PauseCircleOutlined />}
          size="small"
          tooltip="撤回"
          onClick={() => withdrawMutation.mutate(record.id)}
          loading={withdrawMutation.isPending && withdrawMutation.variables === record.id}
        />
      ) : null}
      {canManageAnnouncements ? (
        <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate(record.id)}>
          <ManagementIconButton
            aria-label="删除公告"
            danger
            icon={<DeleteOutlined />}
            size="small"
            tooltip="删除"
          />
        </Popconfirm>
      ) : null}
    </Space>
  )

  return (
    <div className="soha-page">
      <div className="soha-system-overview-grid">
        <Card variant="outlined" className="soha-system-metric-card">
          <Statistic title="已发布" value={announcementSummary.published} />
          <Text type="secondary">当前对用户可见的公告</Text>
        </Card>
        <Card variant="outlined" className="soha-system-metric-card">
          <Statistic title="草稿" value={announcementSummary.draft} />
          <Text type="secondary">仍在编辑，尚未推送</Text>
        </Card>
        <Card variant="outlined" className="soha-system-metric-card">
          <Statistic title="待生效" value={announcementSummary.scheduled} />
          <Text type="secondary">已配置时间窗，等待生效</Text>
        </Card>
        <Card variant="outlined" className="soha-system-metric-card">
          <Statistic title="置顶公告" value={announcementSummary.sticky} />
          <Text type="secondary">优先出现在用户端弹窗与铃铛中</Text>
        </Card>
      </div>

      <Card
        variant="outlined"
        className="soha-system-panel-card"
        extra={canManageAnnouncements ? (
          <Button size="small" icon={<PlusOutlined />} type="primary" onClick={() => { setEditing(null); setModalVisible(true) }}>
            新建公告
          </Button>
        ) : null}
      >
        <Tabs
          activeKey={statusView}
          onChange={setStatusView}
          items={announcementTabs.map((item) => ({
            key: item.key,
            label: item.label,
            children: (
              <List
                className="soha-system-announcement-list"
                itemLayout="vertical"
                loading={isLoading}
                dataSource={filteredAnnouncements}
                locale={{ emptyText: <Alert type="info" showIcon title="当前分组下暂无公告" /> }}
                renderItem={(record: Announcement) => {
                  const lifecycle = buildAnnouncementLifecycle(record)
                  return (
                    <List.Item
                      key={record.id}
                      actions={[renderAnnouncementActions(record)]}
                      extra={(
                        <div className="soha-system-announcement-extra">
                          <Text type="secondary">{`发布时间 ${formatDateTime(record.publishedAt || record.updatedAt || record.createdAt)}`}</Text>
                          <Text type="secondary">{`生效窗口 ${formatDateTime(record.startsAt)} ~ ${formatDateTime(record.endsAt)}`}</Text>
                        </div>
                      )}
                    >
                      <List.Item.Meta
                        title={(
                          <Space size={8} wrap>
                            <Button type="link" className="soha-system-linklike" onClick={() => setPreviewing(record)}>
                              {record.title}
                            </Button>
                            <StatusTag value={record.level} />
                            <StatusTag value={record.status} />
                            {record.sticky ? <Tag color="purple">置顶</Tag> : null}
                            {lifecycle === 'scheduled' ? <Tag color="gold">待生效</Tag> : null}
                            {lifecycle === 'expired' ? <Tag>已过期</Tag> : null}
                          </Space>
                        )}
                        description={record.summary ? <Text>{record.summary}</Text> : <Text type="secondary">无摘要</Text>}
                      />
                      <Paragraph className="soha-system-announcement-content" ellipsis={{ rows: 3, expandable: true, symbol: '展开正文' }}>
                        {record.content}
                      </Paragraph>
                    </List.Item>
                  )
                }}
              />
            ),
          }))}
        />
      </Card>
      <Modal
        title={editing ? '编辑公告' : '新建公告'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditing(null) }}
        footer={null}
        destroyOnHidden
      >
        <Form
          {...MODAL_FORM_LAYOUT}
          onFinish={(values) => { if (!canManageAnnouncements) return; handleSubmit(values as Record<string, unknown>) }}
          initialValues={editing ? {
            title: editing.title,
            summary: editing.summary,
            content: editing.content,
            level: editing.level,
            status: editing.status,
            sticky: editing.sticky,
            startsAt: editing.startsAt ? dayjs(editing.startsAt) : null,
            endsAt: editing.endsAt ? dayjs(editing.endsAt) : null,
          } : { level: 'info', status: 'draft', sticky: false }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <Input />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="level" label="级别">
            <Select options={[
              { value: 'info', label: '信息' },
              { value: 'warning', label: '警告' },
              { value: 'critical', label: '严重' },
            ]}
            />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[
              { value: 'draft', label: '草稿' },
              { value: 'published', label: '已发布' },
            ]}
            />
          </Form.Item>
          <Form.Item name="sticky" label="置顶" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="startsAt" label="生效开始">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endsAt" label="生效结束">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <div className="soha-form-actions">
            <Button onClick={() => setModalVisible(false)}>取消</Button>
            {canManageAnnouncements ? (
              <Button htmlType="submit" type="primary" loading={createMutation.isPending || updateMutation.isPending}>
                {editing ? '更新' : '创建'}
              </Button>
            ) : null}
          </div>
        </Form>
      </Modal>
      <Drawer
        title={previewing?.title || '公告详情'}
        open={Boolean(previewing)}
        onClose={() => setPreviewing(null)}
        size={560}
        destroyOnHidden
      >
        {previewing ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: 'status', label: '状态', children: <Space size={8} wrap><StatusTag value={previewing.level} /><StatusTag value={previewing.status} />{previewing.sticky ? <Tag color="purple">置顶</Tag> : null}</Space> },
                { key: 'publishedAt', label: '发布时间', children: formatDateTime(previewing.publishedAt || previewing.updatedAt || previewing.createdAt) },
                { key: 'window', label: '生效窗口', children: `${formatDateTime(previewing.startsAt)} ~ ${formatDateTime(previewing.endsAt)}` },
              ]}
            />
            {previewing.summary ? <Alert type="info" showIcon title={previewing.summary} /> : null}
            <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{previewing.content}</Paragraph>
          </Space>
        ) : null}
      </Drawer>
    </div>
  )
}

/* ─── Menus ─── */

function MenuVisibilityTags({ item }: { item: Pick<MenuItem, 'id' | 'path' | 'roleIds' | 'visibilityMode' | 'derivedPermissionKeys'> }) {
  const summary = summarizeMenuVisibility(item)

  if (summary.mode === 'explicit') {
    return (
      <Space wrap size={[4, 4]}>
        <Tag color="gold">显式覆盖</Tag>
        {summary.explicitRoleIds.length > 0 ? (
          <Tooltip title={summary.explicitRoleIds.join(', ')}>
            <Tag>{`角色 ${summary.explicitRoleIds.length}`}</Tag>
          </Tooltip>
        ) : (
          <Tag>未绑定角色</Tag>
        )}
      </Space>
    )
  }

  if (summary.mode === 'derived') {
    return (
      <Space wrap size={[4, 4]}>
        <Tag color="blue">自动派生</Tag>
        <Tooltip title={summary.derivedPermissionKeys.join(', ')}>
          <Tag>{summary.derivedPermissionKeys.length === 1 ? summary.derivedPermissionKeys[0] : `权限键 ${summary.derivedPermissionKeys.length}`}</Tag>
        </Tooltip>
      </Space>
    )
  }

  return (
    <Space wrap size={[4, 4]}>
      <Tag>未映射</Tag>
      <Tag color="default">需显式配置</Tag>
    </Space>
  )
}

function MenuWorkbenchTag({ item, menuLookup }: { item: Pick<MenuItem, 'id' | 'path' | 'parentId'>; menuLookup: Map<string, MenuItem> }) {
  const summary = summarizeMenuWorkbench(item, menuLookup)
  const color = summary.key === 'unmapped'
    ? 'default'
    : summary.key === 'system'
      ? 'purple'
      : summary.key === 'delivery'
        ? 'blue'
        : summary.key === 'platform'
          ? 'cyan'
          : 'geekblue'

  return <Tag color={color}>{summary.label}</Tag>
}

function formatSyntheticChildCount(record: MenuItem) {
  const count = countDirectMenuChildren(record)
  if (count === 0) return ''
  if (record.syntheticKind === 'workbench' && (record.children ?? []).every((item) => item.syntheticKind === 'section')) {
    return `${count} 个分组`
  }
  return `${count} 个菜单`
}

export function MenusPage() {
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [form] = Form.useForm()
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [sectionFilter, setSectionFilter] = useState<string>('')
  const [workbenchFilter, setWorkbenchFilter] = useState<string>('')
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'derived' | 'explicit' | 'unmapped'>('all')
  const [treeView, setTreeView] = useState<'workbench' | 'top' | 'all'>('workbench')
  const canManageMenus = hasPermission(permissionSnapshotQuery.data?.data, 'system.menus.manage')

  const { data, isLoading } = useQuery({
    queryKey: ['menus'],
    queryFn: () => api.get<ApiResponse<MenuItem[]>>('/menus'),
  })

  const { data: rolesResponse } = useQuery({
    queryKey: ['access-roles', 'menu-overrides'],
    queryFn: () => api.get<ApiResponse<AccessRoleOption[]>>('/access/roles'),
    enabled: canManageMenus && modalVisible,
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.post('/menus', values),
    onSuccess: () => {
	      void message.success('菜单创建成功')
	      void queryClient.invalidateQueries({ queryKey: ['menus'] })
	      void invalidateAuthz(queryClient)
	      form.resetFields()
      setModalVisible(false)
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      api.put(`/menus/${id}`, values),
    onSuccess: () => {
	      void message.success('菜单更新成功')
	      void queryClient.invalidateQueries({ queryKey: ['menus'] })
	      void invalidateAuthz(queryClient)
	      form.resetFields()
      setModalVisible(false)
      setEditing(null)
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/menus/${id}`),
    onSuccess: () => {
	      void message.success('菜单已删除')
	      void queryClient.invalidateQueries({ queryKey: ['menus'] })
	      void invalidateAuthz(queryClient)
	    },
    onError: (err: Error) => void message.error(err.message),
  })

  const handleSubmit = (values: Record<string, unknown>) => {
    const normalizedValues = normalizeMenuSubmitValues(values)
    if (editing) {
      updateMutation.mutate({ id: editing.id, values: normalizedValues })
    } else {
      createMutation.mutate(normalizedValues)
    }
  }

  const menuTree = data?.data ?? []
  const menuItems = flattenMenuItems(menuTree)
  const menuLookup = useMemo(() => new Map(menuItems.map((item) => [item.id, item])), [menuItems])
  const rawFilteredMenuTree = useMemo(
    () => filterMenuTree(menuTree, {
      topLevelOnly: treeView === 'top',
      section: sectionFilter,
      workbench: workbenchFilter,
      enabled: enabledFilter,
      visibility: visibilityFilter,
    }),
    [enabledFilter, menuTree, sectionFilter, treeView, visibilityFilter, workbenchFilter],
  )
  const filteredMenuTree = useMemo(
    () => treeView === 'workbench' ? buildWorkbenchMenuTree(rawFilteredMenuTree) : rawFilteredMenuTree,
    [rawFilteredMenuTree, treeView],
  )
  const sectionOptions = useMemo(
    () => buildMenuSectionFilterOptions(menuItems),
    [menuItems],
  )
  const workbenchOptions = useMemo(
    () => MENU_WORKBENCH_ORDER.map((value) => ({
      value,
      label: MENU_WORKBENCH_LABELS[value],
    })),
    [],
  )
  const menuPageSize = Math.max(menuItems.length, 1)
  const roleOptions = (rolesResponse?.data ?? []).map((role) => ({
    value: role.id,
    label: role.name || role.id,
  }))
  const blockedParentIds = new Set(editing ? [editing.id, ...collectMenuDescendantIds(editing)] : [])
  const parentOptions = [
    { label: '顶级菜单', value: '' },
    ...Array.from(
      menuItems
        .filter((item) => !blockedParentIds.has(item.id))
        .reduce((acc, item) => {
          const workbench = summarizeMenuWorkbench(item, menuLookup)
          const current = acc.get(workbench.key) ?? []
          current.push({
            value: item.id,
            label: `${'— '.repeat(item.depth ?? 0)}${item.labelZh}`,
          })
          acc.set(workbench.key, current)
          return acc
        }, new Map<MenuWorkbenchSurface, Array<{ value: string; label: string }>>()),
    )
      .sort(([left], [right]) => MENU_WORKBENCH_ORDER.indexOf(left) - MENU_WORKBENCH_ORDER.indexOf(right))
      .map(([key, options]) => ({
        label: MENU_WORKBENCH_LABELS[key],
        options,
      })),
  ]

  useEffect(() => {
    if (!modalVisible) return

    form.resetFields()
    form.setFieldsValue(buildMenuFormValues(editing))
  }, [editing, form, modalVisible])

  const columns: TableColumnsType<MenuItem> = [
    {
      title: '菜单名称',
      dataIndex: 'labelZh',
      render: (value: string, record: MenuItem) => (
        record.syntheticKind ? (
          <Space size={8} wrap>
            <Text strong>{value}</Text>
            <Tag color={record.syntheticKind === 'workbench' ? 'blue' : 'default'}>{record.syntheticKind === 'workbench' ? '工作台' : '分组'}</Tag>
            {formatSyntheticChildCount(record) ? <Tag color="blue">{formatSyntheticChildCount(record)}</Tag> : null}
          </Space>
        ) : (
          <Space orientation="vertical" size={2}>
            <Space size={8} wrap>
              <Text strong>{value}</Text>
              <Tag>{record.parentId ? '子菜单' : '顶级'}</Tag>
              {countDirectMenuChildren(record) > 0 ? <Tag color="blue">{`${countDirectMenuChildren(record)} 个子项`}</Tag> : null}
            </Space>
            <Text type="secondary">{record.labelEn || '-'}</Text>
          </Space>
        )
      ),
    },
    { title: '路径', dataIndex: 'path', render: (value: string, record: MenuItem) => record.syntheticKind ? '-' : value },
    {
      title: '工作台',
      key: 'workbench',
      render: (_: unknown, record: MenuItem) => {
        if (record.syntheticKind === 'workbench' && record.syntheticWorkbenchKey) {
          return <Tag color="blue">{MENU_WORKBENCH_LABELS[record.syntheticWorkbenchKey]}</Tag>
        }
        if (record.syntheticKind === 'section' && record.syntheticWorkbenchKey) {
          return <Tag>{MENU_WORKBENCH_LABELS[record.syntheticWorkbenchKey]}</Tag>
        }
        return <MenuWorkbenchTag item={record} menuLookup={menuLookup} />
      },
    },
    {
      title: '图标',
      dataIndex: 'iconKey',
      render: (value: string, record: MenuItem) => record.syntheticKind ? '-' : (
        <Space size={8} wrap>
          <span>{resolveMenuIcon(value)}</span>
          <Text code>{value || '-'}</Text>
          {!isKnownMenuIcon(value) ? <Tag color="gold">未映射</Tag> : null}
        </Space>
      ),
    },
    {
      title: '分组',
      dataIndex: 'section',
      render: (value: string, record: MenuItem) => {
        if (record.syntheticKind === 'workbench') return '-'
        const section = normalizeMenuSection(value)
        return section ? <Tag>{resolveMenuSectionLabel(section)}</Tag> : <Tag>未分组</Tag>
      },
    },
    { title: '排序', dataIndex: 'sortOrder', render: (value: number, record: MenuItem) => record.syntheticKind ? '-' : value },
    {
      title: '可见',
      dataIndex: 'enabled',
      render: (v: boolean, record: MenuItem) => record.syntheticKind ? '-' : <BooleanTag value={v} />,
    },
    {
      title: '可见性策略',
      key: 'visibilityModel',
      render: (_: unknown, record: MenuItem) => record.syntheticKind ? '-' : <MenuVisibilityTags item={record} />,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: MenuItem) => (
        <Space className="soha-row-action-icons">
          {canManageMenus && !record.syntheticKind ? (
            <ManagementIconButton
              aria-label="编辑菜单"
              icon={<EditOutlined />}
              size="small"
              tooltip="编辑"
              onClick={() => { setEditing(findMenuItemByID(menuTree, record.id) ?? record); setModalVisible(true) }}
            />
          ) : null}
          {canManageMenus && !record.syntheticKind ? (
            <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate(record.id)}>
              <ManagementIconButton
                aria-label="删除菜单"
                danger
                icon={<DeleteOutlined />}
                size="small"
                tooltip="删除"
              />
            </Popconfirm>
          ) : null}
          {!canManageMenus || record.syntheticKind ? '-' : null}
        </Space>
      ),
    },
  ]

  return (
    <ManagementDataPage
      query={{
        collapsible: true,
        onFinish: () => undefined,
        actions: (
          <ManagementQueryActions
            disabledReset={treeView === 'workbench' && !sectionFilter && !workbenchFilter && enabledFilter === 'all' && visibilityFilter === 'all'}
            onReset={() => {
              setTreeView('workbench')
              setSectionFilter('')
              setWorkbenchFilter('')
              setEnabledFilter('all')
              setVisibilityFilter('all')
            }}
          />
        ),
        children: (
          <>
            <ManagementQueryField label="树视图" minWidth={300} width={340}>
              <Segmented
                size="small"
                value={treeView}
                onChange={(value) => setTreeView(value as 'workbench' | 'top' | 'all')}
                options={[
                  { value: 'workbench', label: '工作台视图' },
                  { value: 'top', label: '默认看顶级' },
                  { value: 'all', label: '看全部树' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={180} width={220} label="分组">
              <Select
                allowClear
                placeholder="全部分组"
                value={sectionFilter || undefined}
                onChange={(value) => setSectionFilter(value || '')}
                options={sectionOptions}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={180} width={220} label="工作台">
              <Select
                allowClear
                placeholder="全部工作台"
                value={workbenchFilter || undefined}
                onChange={(value) => setWorkbenchFilter(value || '')}
                options={workbenchOptions}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={140} width={160} label="状态">
              <Select
                value={enabledFilter}
                onChange={(value) => setEnabledFilter(value as 'all' | 'enabled' | 'disabled')}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'enabled', label: '仅启用' },
                  { value: 'disabled', label: '仅禁用' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={160} width={180} label="策略">
              <Select
                value={visibilityFilter}
                onChange={(value) => setVisibilityFilter(value as 'all' | 'derived' | 'explicit' | 'unmapped')}
                options={[
                  { value: 'all', label: '全部策略' },
                  { value: 'derived', label: '自动派生' },
                  { value: 'explicit', label: '显式覆盖' },
                  { value: 'unmapped', label: '未映射' },
                ]}
              />
            </ManagementQueryField>
          </>
        ),
      }}
      tableNode={(
        <AdminTable
        key={treeView}
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        columns={columns}
        dataSource={filteredMenuTree}
        rowKey="id"
        loading={isLoading}
        pageSize={menuPageSize}
        pagination={false}
        scroll={{ x: 1320 }}
        headerExtra={canManageMenus ? (
          <ManagementTableToolbar>
            <Button size="small" icon={<PlusOutlined />} type="primary" onClick={() => { setEditing(null); setModalVisible(true) }}>
              新建菜单
            </Button>
          </ManagementTableToolbar>
        ) : null}
        expandable={{
          defaultExpandAllRows: treeView !== 'top',
          rowExpandable: (record: MenuItem) => countDirectMenuChildren(record) > 0,
        }}
      />
      )}
      afterTable={(
        <Modal
        title={editing ? '编辑菜单' : '新建菜单'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditing(null); form.resetFields() }}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={form}
          {...MODAL_FORM_LAYOUT}
          onFinish={(values) => { if (!canManageMenus) return; handleSubmit(values as Record<string, unknown>) }}
        >
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.path !== next.path || prev.roleIds !== next.roleIds || prev.visibilityMode !== next.visibilityMode || prev.id !== next.id}>
            {({ getFieldValue }) => {
              const draftMenu = {
                id: String(getFieldValue('id') || ''),
                path: String(getFieldValue('path') || ''),
                roleIds: Array.isArray(getFieldValue('roleIds')) ? getFieldValue('roleIds').map(String) : [],
                visibilityMode: getFieldValue('visibilityMode') === 'explicit' ? 'explicit' : 'derived',
              } satisfies Pick<MenuItem, 'id' | 'path' | 'roleIds' | 'visibilityMode'>
              const visibilitySummary = summarizeMenuVisibility(draftMenu)
              const visibilityMode = getFieldValue('visibilityMode') === 'explicit' ? 'explicit' : 'derived'

              return (
                <>
                  <Alert
                    showIcon
                    type={visibilitySummary.mode === 'unmapped' ? 'warning' : 'info'}
                    title={visibilitySummary.mode === 'explicit' ? '当前菜单使用显式角色覆盖' : visibilitySummary.mode === 'derived' ? '当前菜单将按权限键自动派生可见性' : '当前菜单尚未映射已知权限键'}
                    description={visibilitySummary.mode === 'explicit'
                      ? '仅为少数例外场景保留显式角色覆盖。保存后会提交 roleIds，覆盖默认的 permissionKeys 派生行为。'
                      : visibilitySummary.mode === 'derived'
                        ? `当前可派生权限键: ${visibilitySummary.derivedPermissionKeys.join(', ')}`
                        : '该菜单没有匹配到前端路由权限键。若仍需控制可见性，请切换为显式覆盖并填写角色 ID。'}
                    style={{ marginBottom: 16 }}
                  />
                  <Form.Item
                    name="visibilityMode"
                    label="可见性模式"
                    rules={[{ required: true, message: '请选择可见性模式' }]}
                  >
                    <Select options={getMenuVisibilityModeOptions(visibilitySummary)} />
                  </Form.Item>
                  {visibilitySummary.derivedPermissionKeys.length > 0 ? (
                    <Form.Item label="派生权限键">
                      <Select
                        mode="multiple"
                        open={false}
                        value={visibilitySummary.derivedPermissionKeys}
                        options={visibilitySummary.derivedPermissionKeys.map((permissionKey) => ({
                          value: permissionKey,
                          label: permissionKey,
                        }))}
                      />
                    </Form.Item>
                  ) : null}
                  {visibilityMode === 'explicit' ? (
                    <Form.Item name="roleIds" label="覆盖角色">
                      <Select
                        mode="tags"
                        options={roleOptions}
                        placeholder="输入角色 ID，或选择已有角色"
                        tokenSeparators={[',']}
                      />
                    </Form.Item>
                  ) : null}
                </>
              )
            }}
          </Form.Item>
          <Form.Item name="labelZh" label="中文名称" rules={[{ required: true, message: '请输入中文名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="labelEn" label="英文名称">
            <Input />
          </Form.Item>
          <Form.Item name="parentId" label="父级菜单">
            <Select options={parentOptions} />
          </Form.Item>
          <Form.Item name="path" label="路径" rules={[{ required: true, message: '请输入路径' }]}>
            <Input />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.id !== next.id || prev.path !== next.path || prev.parentId !== next.parentId}>
            {({ getFieldValue }) => {
              const draftPlacement = summarizeMenuWorkbench({
                id: String(getFieldValue('id') || ''),
                path: String(getFieldValue('path') || ''),
                parentId: String(getFieldValue('parentId') || ''),
              }, menuLookup)
              const hasPlacementConflict = Boolean(
                draftPlacement.parentPlacement &&
                draftPlacement.pathPlacement !== 'unmapped' &&
                draftPlacement.parentPlacement !== draftPlacement.pathPlacement,
              )

              return (
                <Form.Item label="工作台归属">
                  <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                    <Space wrap>
                      <Tag color={draftPlacement.key === 'unmapped' ? 'default' : 'blue'}>{draftPlacement.label}</Tag>
                      {draftPlacement.parentPlacement ? <Text type="secondary">跟随父级菜单</Text> : <Text type="secondary">按路径自动派生</Text>}
                      {hasPlacementConflict ? <Tag color="gold">父级与路径不一致</Tag> : null}
                    </Space>
                    <Text type={hasPlacementConflict ? 'danger' : 'secondary'}>
                      {hasPlacementConflict
                        ? `当前路径命中 ${draftPlacement.pathPlacementLabel}，但父级菜单属于 ${draftPlacement.parentPlacementLabel}。保存后侧栏将按父级工作台收纳。`
                        : draftPlacement.key === 'unmapped'
                          ? '当前菜单尚未映射到已知工作台；若需要进入侧栏，请确认路径或父级菜单归属。'
                          : `当前菜单会在 ${draftPlacement.label} 的导航树内展示。`}
                    </Text>
                  </Space>
                </Form.Item>
              )
            }}
          </Form.Item>
          <Form.Item name="iconKey" label="图标" rules={[{ required: true, message: '请选择图标' }]}>
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              options={MENU_ICON_OPTIONS.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
              optionRender={(option) => {
                const target = MENU_ICON_OPTIONS.find((item) => item.value === option.value)
                return (
                  <Space size={8}>
                    <span>{target?.preview}</span>
                    <span>{target?.label || option.label}</span>
                    <Text code>{String(option.value)}</Text>
                  </Space>
                )
              }}
            />
          </Form.Item>
          <Form.Item name="section" label="分组">
            <Select
              mode="tags"
              maxCount={1}
              options={sectionOptions}
              tokenSeparators={[',']}
              placeholder="选择已有分组，或直接输入新的分组键"
            />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="是否启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div className="soha-form-actions">
            <Button onClick={() => { setModalVisible(false); setEditing(null); form.resetFields() }}>取消</Button>
            {canManageMenus ? (
              <Button htmlType="submit" type="primary" loading={createMutation.isPending || updateMutation.isPending}>
                {editing ? '更新' : '创建'}
              </Button>
            ) : null}
          </div>
        </Form>
      </Modal>
      )}
    />
  )
}

/* ─── Audit Logs ─── */

function AuditLogDrawer({ record, open, onClose }: { record: AuditLog | null; open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title={record ? `审计记录 · ${prettifyAction(record.action)}` : '审计记录'} size={620} destroyOnHidden>
      {record ? (
        <Tabs
          items={[
            {
              key: 'overview',
              label: '概览',
              children: (
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <UsageSnapshotPanel metadata={record.metadata} />
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      { key: 'time', label: '发生时间', children: formatDateTime(record.createdAt) },
                      { key: 'actor', label: '操作者', children: record.actorName || record.actorId || '-' },
                      { key: 'action', label: '动作', children: <StatusTag value={record.action} /> },
                      { key: 'resource', label: '资源', children: [record.resourceKind, record.resourceName].filter(Boolean).join(' / ') || '-' },
                      { key: 'result', label: '结果', children: <StatusTag value={record.result} /> },
                      { key: 'summary', label: '摘要', children: record.summary || '-' },
                    ]}
                  />
                  <Card variant="outlined" className="soha-system-payload-card">
                    <Title level={5} style={{ marginTop: 0 }}>访问上下文</Title>
                    <Descriptions
                      size="small"
                      column={1}
                      items={[
                        { key: 'roles', label: '角色', children: record.roles?.length ? record.roles.join(', ') : '-' },
                        { key: 'teams', label: '团队', children: record.teams?.length ? record.teams.join(', ') : '-' },
                        { key: 'requestPath', label: '路径', children: record.requestPath || '-' },
                        { key: 'requestMethod', label: '方法', children: record.requestMethod || '-' },
                        { key: 'requestId', label: '请求 ID', children: record.requestId || '-' },
                        { key: 'sourceIp', label: '来源 IP', children: record.sourceIp || '-' },
                      ]}
                    />
                  </Card>
                </Space>
              ),
            },
            {
              key: 'diff',
              label: '结构化 diff',
              children: (
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <UsageSnapshotDiffView metadata={record.metadata} />
                  <Card variant="outlined" className="soha-system-payload-card">
                    <Typography.Title level={5} style={{ marginTop: 0 }}>原始 JSON</Typography.Title>
                    <UsageSnapshotRawJson metadata={record.metadata} />
                  </Card>
                </Space>
              ),
            },
          ]}
        />
      ) : null}
    </Drawer>
  )
}

export function AuditLogsPage() {
  const location = useLocation()
  const auditEventsPath = location.pathname.startsWith('/identity/') ? '/identity/audit/events' : '/audit/logs'
  const [searchParams] = useSearchParams()
  const initialUsageFilters = useMemo(() => usageSnapshotFilterParams(searchParams), [searchParams])
  const [actionFilter, setActionFilter] = useState<string>('')
  const [resultFilter, setResultFilter] = useState<string>('')
  const [metadataKeyFilter, setMetadataKeyFilter] = useState<string>(initialUsageFilters.metadataKey)
  const [metadataValueFilter, setMetadataValueFilter] = useState<string>(initialUsageFilters.metadataValue)
  const [viewMode, setViewMode] = useState<'all' | 'abnormal' | 'today'>('all')
  const [activeRecord, setActiveRecord] = useState<AuditLog | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', auditEventsPath, actionFilter, resultFilter, metadataKeyFilter, metadataValueFilter],
    queryFn: () => api.get<ApiResponse<AuditLog[]>>(buildQueryPath(auditEventsPath, {
      action: actionFilter,
      result: resultFilter,
      metadataKey: metadataKeyFilter,
      metadataValue: metadataValueFilter,
    })),
  })

  const rawLogs = data?.data ?? []
  const filteredLogs = useMemo(() => {
    if (viewMode === 'abnormal') {
      return rawLogs.filter((item) => !['success', 'published'].includes(item.result))
    }
    if (viewMode === 'today') {
      return rawLogs.filter((item) => isTodayDate(item.createdAt))
    }
    return rawLogs
  }, [rawLogs, viewMode])

  const columns: TableColumnsType<AuditLog> = [
    { ...tableColumnPresets.datetime, title: '时间', dataIndex: 'createdAt', render: (value: string) => formatDateTime(value) },
    {
      title: '操作者',
      dataIndex: 'actorName',
      width: 160,
      render: (_: string, record: AuditLog) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.actorName || record.actorId || '-'}</Text>
          {record.actorId && record.actorId !== record.actorName ? <Text type="secondary">{record.actorId}</Text> : null}
        </Space>
      ),
    },
    {
      title: '事件',
      dataIndex: 'action',
      width: 240,
      render: (_: string, record: AuditLog) => {
        const resource = buildAuditResourceLabel(record.resourceKind, record.resourceName)
        return (
          <div className="soha-log-event-cell">
            <Space size={8} wrap>
              <StatusTag value={record.action} />
              {resource.secondary ? <Text type="secondary">{resource.secondary}</Text> : null}
            </Space>
            <Text strong>{resource.primary}</Text>
          </div>
        )
      },
    },
    {
      ...tableColumnPresets.status,
      title: '结果',
      dataIndex: 'result',
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      render: (value: string) => (
        <Space orientation="vertical" size={4}>
          <Paragraph className="soha-log-summary" ellipsis={{ rows: 2, tooltip: value }}>
            {value || '-'}
          </Paragraph>
        </Space>
      ),
    },
    {
      title: 'Usage Snapshot',
      dataIndex: 'metadata',
      width: 260,
      render: (value: AuditLog['metadata']) => <UsageSnapshotSummary metadata={value} />,
    },
    {
      ...tableColumnPresets.action,
      title: '详情',
      dataIndex: 'id',
      render: (_: string, record: AuditLog) => (
        <ManagementIconButton
          aria-label="查看审计详情"
          icon={<EyeOutlined />}
          size="small"
          tooltip="详情"
          onClick={() => setActiveRecord(record)}
        />
      ),
    },
  ]

  return (
    <ManagementDataPage
      query={{
        collapsible: true,
        onFinish: () => undefined,
        actions: (
          <ManagementQueryActions
            disabledReset={viewMode === 'all' && !actionFilter && !resultFilter && !metadataKeyFilter && !metadataValueFilter.trim()}
            onReset={() => {
              setViewMode('all')
              setActionFilter('')
              setResultFilter('')
              setMetadataKeyFilter('')
              setMetadataValueFilter('')
            }}
          />
        ),
        children: (
          <>
            <ManagementQueryField label="视图" minWidth={260} width={300}>
              <Segmented
                size="small"
                value={viewMode}
                onChange={(value) => setViewMode(value as 'all' | 'abnormal' | 'today')}
                options={[
                  { value: 'all', label: '全部' },
                  { value: 'abnormal', label: '异常 / 拒绝' },
                  { value: 'today', label: '今日' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={140} width={160} label="动作">
              <Select
                allowClear
                placeholder="全部动作"
                value={actionFilter || undefined}
                onChange={(value) => setActionFilter(value || '')}
                options={[
                  { value: 'list', label: 'list' },
                  { value: 'view', label: 'view' },
                  { value: 'create', label: 'create' },
                  { value: 'update', label: 'update' },
                  { value: 'delete', label: 'delete' },
                  { value: 'login', label: 'login' },
                  { value: 'publish', label: 'publish' },
                  { value: 'withdraw', label: 'withdraw' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={140} width={160} label="结果">
              <Select
                allowClear
                placeholder="全部结果"
                value={resultFilter || undefined}
                onChange={(value) => setResultFilter(value || '')}
                options={[
                  { value: 'success', label: 'success' },
                  { value: 'failure', label: 'failure' },
                  { value: 'deny', label: 'deny' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={180} width={220} label="字段">
              <Select
                allowClear
                placeholder="usageSnapshot 字段"
                value={metadataKeyFilter || undefined}
                onChange={(value) => setMetadataKeyFilter(value || '')}
                options={[
                  { value: 'usageSnapshot.templateKind', label: 'templateKind' },
                  { value: 'usageSnapshot.templateId', label: 'templateId' },
                  { value: 'usageSnapshot.riskLevel', label: 'riskLevel' },
                  { value: 'usageSnapshot.before.templateId', label: 'before.templateId' },
                  { value: 'usageSnapshot.after.templateId', label: 'after.templateId' },
                  { value: 'usageSnapshot.after.riskLevel', label: 'after.riskLevel' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField grow minWidth={180} width={220} label="字段值">
              <Input
                allowClear
                placeholder="usageSnapshot 值"
                value={metadataValueFilter}
                onChange={(event) => setMetadataValueFilter(event.target.value)}
              />
            </ManagementQueryField>
          </>
        ),
      }}
      table={{
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        columns,
        dataSource: filteredLogs,
        rowKey: 'id',
        loading: isLoading,
        pageSize: 50,
        scroll: { x: 'max-content' },
        onRow: (record: AuditLog) => ({
          onClick: () => setActiveRecord(record),
          style: { cursor: 'pointer' },
        }),
      }}
      afterTable={<AuditLogDrawer record={activeRecord} open={Boolean(activeRecord)} onClose={() => setActiveRecord(null)} />}
    />
  )
}

/* ─── Operation Logs ─── */

function OperationLogDrawer({ record, open, onClose }: { record: OperationLog | null; open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title={record ? prettifyOperationType(record.operationType).primary : '操作详情'} size={640} destroyOnHidden>
      {record ? (
        <Tabs
          items={[
            {
              key: 'overview',
              label: '概览',
              children: (
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <UsageSnapshotPanel metadata={record.metadata} />
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      { key: 'time', label: '发生时间', children: formatDateTime(record.createdAt) },
                      { key: 'actor', label: '操作者', children: record.actorName || record.actorId || '-' },
                      { key: 'operation', label: '操作', children: <Space orientation="vertical" size={0}><Text strong>{prettifyOperationType(record.operationType).primary}</Text><Text type="secondary">{record.operationType}</Text></Space> },
                      { key: 'target', label: '目标', children: <Space orientation="vertical" size={0}><Text strong>{buildTargetScopeLabel(record.targetScope || {}).primary}</Text><Text type="secondary">{buildTargetScopeLabel(record.targetScope || {}).secondary || '-'}</Text></Space> },
                      { key: 'result', label: '结果', children: <StatusTag value={record.result} /> },
                      { key: 'summary', label: '摘要', children: record.summary || '-' },
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: 'scope',
              label: '目标范围',
              children: <pre className="soha-system-json-block">{stringifyPayload(record.targetScope)}</pre>,
            },
            {
              key: 'request',
              label: '请求上下文',
              children: (
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    { key: 'path', label: '路径', children: record.requestPath || '-' },
                    { key: 'method', label: '方法', children: record.requestMethod || '-' },
                    { key: 'requestId', label: '请求 ID', children: record.requestId || '-' },
                    { key: 'sourceIp', label: '来源 IP', children: record.sourceIp || '-' },
                  ]}
                />
              ),
            },
            {
              key: 'diff',
              label: '结构化 diff',
              children: (
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <UsageSnapshotDiffView metadata={record.metadata} />
                  <Card variant="outlined" className="soha-system-payload-card">
                    <Typography.Title level={5} style={{ marginTop: 0 }}>原始 JSON</Typography.Title>
                    <UsageSnapshotRawJson metadata={record.metadata} />
                  </Card>
                </Space>
              ),
            },
          ]}
        />
      ) : null}
    </Drawer>
  )
}

export function OperationLogsPage() {
  const [searchParams] = useSearchParams()
  const initialUsageFilters = useMemo(() => usageSnapshotFilterParams(searchParams), [searchParams])
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>('')
  const [resultFilter, setResultFilter] = useState<string>('')
  const [metadataKeyFilter, setMetadataKeyFilter] = useState<string>(initialUsageFilters.metadataKey)
  const [metadataValueFilter, setMetadataValueFilter] = useState<string>(initialUsageFilters.metadataValue)
  const [moduleView, setModuleView] = useState<'all' | 'system' | 'access' | 'platform' | 'virtualization' | 'delivery'>('all')
  const [activeRecord, setActiveRecord] = useState<OperationLog | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['operation-logs', operationTypeFilter, resultFilter, metadataKeyFilter, metadataValueFilter],
    queryFn: () => api.get<ApiResponse<OperationLog[]>>(buildQueryPath('/operations/logs', {
      operationType: operationTypeFilter,
      result: resultFilter,
      metadataKey: metadataKeyFilter,
      metadataValue: metadataValueFilter,
    })),
  })

  const rawLogs = data?.data ?? []
  const filteredLogs = useMemo(() => {
    if (moduleView === 'all') return rawLogs
    return rawLogs.filter((item) => compactText(String(item.targetScope?.module || '')) === moduleView)
  }, [moduleView, rawLogs])

  const columns: TableColumnsType<OperationLog> = [
    { ...tableColumnPresets.datetime, title: '时间', dataIndex: 'createdAt', render: (value: string) => formatDateTime(value) },
    {
      title: '操作者',
      dataIndex: 'actorName',
      width: 160,
      render: (_: string, record: OperationLog) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.actorName || record.actorId || '-'}</Text>
          {record.actorId && record.actorId !== record.actorName ? <Text type="secondary">{record.actorId}</Text> : null}
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'operationType',
      width: 260,
      render: (value: string) => {
        const pretty = prettifyOperationType(value)
        return (
          <div className="soha-log-event-cell">
            <Text strong>{pretty.primary}</Text>
            <Text type="secondary">{pretty.secondary}</Text>
          </div>
        )
      },
    },
    {
      title: '目标',
      dataIndex: 'targetScope',
      width: 260,
      render: (value: Record<string, unknown>) => {
        const target = buildTargetScopeLabel(value || {})
        return (
          <div className="soha-log-event-cell">
            <Text strong>{target.primary}</Text>
            <Text type="secondary">{target.secondary || '-'}</Text>
          </div>
        )
      },
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'result',
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      render: (value: string) => (
        <Paragraph className="soha-log-summary" ellipsis={{ rows: 2, tooltip: value }}>
          {value || '-'}
        </Paragraph>
      ),
    },
    {
      title: 'Usage Snapshot',
      dataIndex: 'metadata',
      width: 260,
      render: (value: OperationLog['metadata']) => <UsageSnapshotSummary metadata={value} />,
    },
    {
      ...tableColumnPresets.action,
      title: '详情',
      dataIndex: 'id',
      render: (_: string, record: OperationLog) => (
        <ManagementIconButton
          aria-label="查看操作详情"
          icon={<EyeOutlined />}
          size="small"
          tooltip="详情"
          onClick={() => setActiveRecord(record)}
        />
      ),
    },
  ]

  return (
    <ManagementDataPage
      query={{
        collapsible: true,
        onFinish: () => undefined,
        actions: (
          <ManagementQueryActions
            disabledReset={moduleView === 'all' && !operationTypeFilter.trim() && !resultFilter && !metadataKeyFilter && !metadataValueFilter.trim()}
            onReset={() => {
              setModuleView('all')
              setOperationTypeFilter('')
              setResultFilter('')
              setMetadataKeyFilter('')
              setMetadataValueFilter('')
            }}
          />
        ),
        children: (
          <>
            <ManagementQueryField label="视图" minWidth={260} width={300}>
              <Segmented
                size="small"
                value={moduleView}
                onChange={(value) => setModuleView(value as 'all' | 'system' | 'access' | 'platform' | 'virtualization' | 'delivery')}
                options={[
                  { value: 'all', label: '全部' },
                  { value: 'system', label: '系统' },
                  { value: 'access', label: '访问控制' },
                  { value: 'platform', label: '平台' },
                  { value: 'virtualization', label: '虚拟化' },
                  { value: 'delivery', label: '交付' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={180} width={220} label="操作类型">
              <Input
                allowClear
                placeholder="按操作类型过滤"
                value={operationTypeFilter}
                onChange={(event) => setOperationTypeFilter(event.target.value)}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={140} width={160} label="结果">
              <Select
                allowClear
                placeholder="全部结果"
                value={resultFilter || undefined}
                onChange={(value) => setResultFilter(value || '')}
                options={[
                  { value: 'success', label: 'success' },
                  { value: 'failure', label: 'failure' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={180} width={220} label="字段">
              <Select
                allowClear
                placeholder="usageSnapshot 字段"
                value={metadataKeyFilter || undefined}
                onChange={(value) => setMetadataKeyFilter(value || '')}
                options={[
                  { value: 'usageSnapshot.templateKind', label: 'templateKind' },
                  { value: 'usageSnapshot.templateId', label: 'templateId' },
                  { value: 'usageSnapshot.riskLevel', label: 'riskLevel' },
                  { value: 'usageSnapshot.before.templateId', label: 'before.templateId' },
                  { value: 'usageSnapshot.after.templateId', label: 'after.templateId' },
                  { value: 'usageSnapshot.after.riskLevel', label: 'after.riskLevel' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField grow minWidth={180} width={220} label="字段值">
              <Input
                allowClear
                placeholder="usageSnapshot 值"
                value={metadataValueFilter}
                onChange={(event) => setMetadataValueFilter(event.target.value)}
              />
            </ManagementQueryField>
          </>
        ),
      }}
      table={{
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        columns,
        dataSource: filteredLogs,
        rowKey: 'id',
        loading: isLoading,
        pageSize: 50,
        scroll: { x: 'max-content' },
        onRow: (record: OperationLog) => ({
          onClick: () => setActiveRecord(record),
          style: { cursor: 'pointer' },
        }),
      }}
      afterTable={<OperationLogDrawer record={activeRecord} open={Boolean(activeRecord)} onClose={() => setActiveRecord(null)} />}
    />
  )
}
