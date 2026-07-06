import { useMemo, useState } from 'react'
import {
  App,
  Avatar,
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
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
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
import type {
  IdentityApplication,
  IdentityApplicationInput,
  IdentityApplicationStatus,
  IdentityAssignmentSubjectType,
  IdentityProviderType,
} from '@/features/provider-portal/provider-portal-api'
import {
  createIdentityApplication,
  deleteIdentityApplication,
  identityApplicationQueryKeys,
  listIdentityApplications,
  listIdentityProviderCapabilities,
  updateIdentityApplication,
} from './identity-applications-api'
import './identity-applications-page.css'

const { Paragraph, Text } = Typography

interface IdentityApplicationFormValues {
  assignments: Array<{
    effect: 'allow'
    subjectId: string
    subjectType: IdentityAssignmentSubjectType
  }>
  category: string
  description: string
  featured: boolean
  iconUrl: string
  launchUrl: string
  name: string
  oidcClientId: string
  oidcRedirectUri: string
  oidcScopes: string[]
  portalVisible: boolean
  providerId: string
  providerType: IdentityProviderType
  slug: string
  sortOrder: number
  status: IdentityApplicationStatus
  tags: string[]
}

const providerTypeOptions: Array<{ label: string; value: IdentityProviderType }> = [
  { label: 'Link', value: 'link' },
  { label: 'OIDC', value: 'oidc' },
  { label: 'Proxy', value: 'proxy' },
]

const statusOptions: Array<{ label: string; value: IdentityApplicationStatus }> = [
  { label: 'Draft', value: 'draft' },
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
  { label: 'Maintenance', value: 'maintenance' },
]

const assignmentSubjectOptions: Array<{ label: string; value: IdentityAssignmentSubjectType }> = [
  { label: 'User', value: 'user' },
  { label: 'Role', value: 'role' },
  { label: 'Team', value: 'team' },
  { label: 'Tag', value: 'tag' },
]

const oidcScopeOptions = [
  { label: 'openid', value: 'openid' },
  { label: 'profile', value: 'profile' },
  { label: 'email', value: 'email' },
  { label: 'roles', value: 'roles' },
  { label: 'teams', value: 'teams' },
  { label: 'projects', value: 'projects' },
  { label: 'tags', value: 'tags' },
]

const statusTagMeta: Record<IdentityApplicationStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: 'Draft' },
  enabled: { color: 'green', label: 'Enabled' },
  disabled: { color: 'default', label: 'Disabled' },
  maintenance: { color: 'gold', label: 'Maintenance' },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function metadataObject(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key]
  return isRecord(value) ? value : undefined
}

function metadataString(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const oidc = metadataObject(metadata, 'oidc')
  for (const key of keys) {
    const value = oidc?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function metadataStringList(metadata: Record<string, unknown> | undefined, keys: string[]) {
  const collect = (source?: Record<string, unknown>) => {
    const out: string[] = []
    keys.forEach((key) => {
      const value = source?.[key]
      if (typeof value === 'string') {
        out.push(...value.split(/[,\s]+/))
      } else if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'string') out.push(item)
        })
      }
    })
    return compactStrings(out)
  }
  const topLevel = collect(metadata)
  if (topLevel.length) return topLevel
  return collect(metadataObject(metadata, 'oidc'))
}

function defaultFormValues(): IdentityApplicationFormValues {
  return {
    assignments: [],
    category: '',
    description: '',
    featured: false,
    iconUrl: '',
    launchUrl: '',
    name: '',
    oidcClientId: '',
    oidcRedirectUri: '',
    oidcScopes: [],
    portalVisible: true,
    providerId: '',
    providerType: 'link',
    slug: '',
    sortOrder: 1000,
    status: 'draft',
    tags: [],
  }
}

function formValuesForApplication(application: IdentityApplication): IdentityApplicationFormValues {
  return {
    assignments: (application.assignments ?? []).map((assignment) => ({
      effect: 'allow',
      subjectId: assignment.subjectId,
      subjectType: assignment.subjectType,
    })),
    category: application.category ?? '',
    description: application.description ?? '',
    featured: application.featured,
    iconUrl: application.iconUrl ?? '',
    launchUrl: application.launchUrl ?? '',
    name: application.name,
    oidcClientId: metadataString(application.metadata, ['oidcClientId', 'clientId']),
    oidcRedirectUri: metadataString(application.metadata, ['oidcRedirectUri', 'redirectUri']),
    oidcScopes: metadataStringList(application.metadata, ['oidcScopes', 'scopes']),
    portalVisible: application.portalVisible,
    providerId: application.providerId ?? '',
    providerType: application.providerType,
    slug: application.slug,
    sortOrder: application.sortOrder,
    status: application.status,
    tags: application.tags ?? [],
  }
}

function metadataFromFormValues(
  values: IdentityApplicationFormValues,
  current?: IdentityApplication | null,
) {
  const metadata: Record<string, unknown> = { ...(current?.metadata ?? {}) }
  delete metadata.oidcClientId
  delete metadata.oidcRedirectUri
  delete metadata.oidcScopes

  if (values.providerType !== 'oidc') {
    delete metadata.oidc
    return metadata
  }

  const oidc: Record<string, unknown> = { ...(metadataObject(metadata, 'oidc') ?? {}) }
  const clientId = values.oidcClientId?.trim()
  const redirectUri = values.oidcRedirectUri?.trim()
  const scopes = compactStrings(values.oidcScopes ?? [])

  if (clientId) oidc.clientId = clientId
  else delete oidc.clientId
  if (redirectUri) oidc.redirectUri = redirectUri
  else delete oidc.redirectUri
  if (scopes.length) oidc.scopes = scopes
  else delete oidc.scopes

  if (Object.keys(oidc).length) metadata.oidc = oidc
  else delete metadata.oidc
  return metadata
}

function inputFromFormValues(
  values: IdentityApplicationFormValues,
  current?: IdentityApplication | null,
): IdentityApplicationInput {
  return {
    assignments: (values.assignments ?? [])
      .filter((assignment) => String(assignment.subjectId ?? '').trim())
      .map((assignment) => ({
        effect: 'allow',
        subjectId: assignment.subjectId.trim(),
        subjectType: assignment.subjectType || 'role',
      })),
    category: values.category?.trim() ?? '',
    description: values.description?.trim() ?? '',
    featured: Boolean(values.featured),
    iconUrl: values.iconUrl?.trim() ?? '',
    launchUrl: values.launchUrl?.trim() ?? '',
    metadata: metadataFromFormValues(values, current),
    name: values.name.trim(),
    portalVisible: Boolean(values.portalVisible),
    providerId: values.providerId?.trim() ?? '',
    providerType: values.providerType || 'link',
    slug: values.slug?.trim() ?? '',
    sortOrder: Number(values.sortOrder || 1000),
    status: values.status || 'draft',
    tags: compactStrings(values.tags),
  }
}

function ApplicationNameCell({ application }: { application: IdentityApplication }) {
  return (
    <div className="soha-identity-app-name-cell">
      <Avatar
        alt={application.name}
        icon={application.iconUrl ? undefined : <AppstoreOutlined />}
        shape="square"
        size={40}
        src={application.iconUrl || undefined}
      >
        {application.name.slice(0, 1).toUpperCase()}
      </Avatar>
      <div className="soha-identity-app-name-copy">
        <Text strong ellipsis title={application.name}>
          {application.name}
        </Text>
        <Text type="secondary" ellipsis title={application.slug}>
          {application.slug}
        </Text>
        {application.description ? (
          <Paragraph
            className="soha-identity-app-description"
            ellipsis={{ rows: 2, tooltip: application.description }}
          >
            {application.description}
          </Paragraph>
        ) : null}
      </div>
    </div>
  )
}

function statusTag(status: IdentityApplicationStatus) {
  const meta = statusTagMeta[status] ?? statusTagMeta.draft
  return <Tag color={meta.color}>{meta.label}</Tag>
}

function assignmentsSummary(application: IdentityApplication) {
  const assignments = application.assignments ?? []
  if (!assignments.length) return <Text type="secondary">All authenticated users</Text>
  return (
    <Space size={[4, 4]} wrap>
      {assignments.slice(0, 4).map((assignment) => (
        <Tag key={`${assignment.subjectType}:${assignment.subjectId}`}>
          {assignment.subjectType}:{assignment.subjectId}
        </Tag>
      ))}
      {assignments.length > 4 ? <Tag>+{assignments.length - 4}</Tag> : null}
    </Space>
  )
}

export function IdentityApplicationsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({ query: '', status: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<IdentityApplication | null>(null)
  const [form] = Form.useForm<IdentityApplicationFormValues>()
  const formProviderType = Form.useWatch('providerType', form) ?? 'link'
  const snapshot = usePermissionSnapshot().data?.data
  const canManage = hasPermission(snapshot, 'identity.applications.manage')

  const applicationsQuery = useQuery({
    queryKey: identityApplicationQueryKeys.applications(filters),
    queryFn: () => listIdentityApplications(filters),
  })
  const providerCapabilitiesQuery = useQuery({
    queryKey: identityApplicationQueryKeys.providerCapabilities,
    queryFn: listIdentityProviderCapabilities,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['identity', 'applications'] })
    void queryClient.invalidateQueries({ queryKey: ['provider-portal'] })
  }

  const createMutation = useMutation({
    mutationFn: (input: IdentityApplicationInput) => createIdentityApplication(input),
    onSuccess: (application) => {
      message.success(`已创建 ${application?.name ?? '应用'}`)
      setModalOpen(false)
      setEditing(null)
      invalidate()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: IdentityApplicationInput }) =>
      updateIdentityApplication(id, input),
    onSuccess: (application) => {
      message.success(`已更新 ${application?.name ?? '应用'}`)
      setModalOpen(false)
      setEditing(null)
      invalidate()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteIdentityApplication(id),
    onSuccess: () => {
      message.success('应用已删除')
      invalidate()
    },
  })

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue(defaultFormValues())
    setModalOpen(true)
  }

  const openEdit = (application: IdentityApplication) => {
    setEditing(application)
    form.setFieldsValue(formValuesForApplication(application))
    setModalOpen(true)
  }

  const submitForm = (values: IdentityApplicationFormValues) => {
    const input = inputFromFormValues(values, editing)
    if (editing) {
      updateMutation.mutate({ id: editing.id, input })
      return
    }
    createMutation.mutate(input)
  }

  const columns = useMemo<TableColumnsType<IdentityApplication>>(
    () => [
      {
        title: 'Application',
        dataIndex: 'name',
        width: 360,
        render: (_, record) => <ApplicationNameCell application={record} />,
      },
      {
        title: 'Provider',
        dataIndex: 'providerType',
        width: 150,
        render: (value: IdentityProviderType, record) => (
          <Space orientation="vertical" size={2}>
            <Tag>{value.toUpperCase()}</Tag>
            {record.providerId ? <Text type="secondary">{record.providerId}</Text> : null}
          </Space>
        ),
      },
      {
        title: 'Portal',
        dataIndex: 'portalVisible',
        width: 150,
        render: (portalVisible: boolean, record) => (
          <Space orientation="vertical" size={2}>
            {statusTag(record.status)}
            <Tag color={portalVisible ? 'blue' : 'default'}>
              {portalVisible ? 'Visible' : 'Hidden'}
            </Tag>
            {record.featured ? <Tag color="purple">Featured</Tag> : null}
          </Space>
        ),
      },
      {
        title: 'Assignments',
        key: 'assignments',
        width: 260,
        render: (_, record) => assignmentsSummary(record),
      },
      {
        title: 'Launch URL',
        dataIndex: 'launchUrl',
        width: 280,
        render: (value: string | undefined, record) =>
          value ? (
            <Text ellipsis title={value}>
              {value}
            </Text>
          ) : record.providerType === 'oidc' ? (
            <Tag color="blue">Generated authorize URL</Tag>
          ) : (
            <Text type="secondary">-</Text>
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
    [canManage, deleteMutation, openEdit],
  )

  const saving = createMutation.isPending || updateMutation.isPending
  const applications = applicationsQuery.data ?? []

  return (
    <div className="soha-page soha-identity-applications-page">
      <ManagementDetailHeader
        actions={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => applicationsQuery.refetch()}>
              刷新
            </Button>
            <Button disabled={!canManage} icon={<PlusOutlined />} type="primary" onClick={openCreate}>
              新建应用
            </Button>
          </Space>
        }
        description="管理 Soha Provider Portal 中展示和授权的下游应用。OIDC 与 Proxy Provider 可在 Providers 页面配置。"
        title="Identity Applications"
      />

      <div className="soha-identity-capability-row">
        {(providerCapabilitiesQuery.data ?? []).map((capability) => (
          <div className="soha-identity-capability" key={capability.type}>
            <div className="soha-identity-capability-title">
              <Tag>{capability.type.toUpperCase()}</Tag>
              <Tag color="gold">{capability.status}</Tag>
            </div>
            <Text type="secondary">{capability.description}</Text>
          </div>
        ))}
      </div>

      <AdminTable
        rowKey="id"
        columns={columns}
        dataSource={applications}
        empty={<ManagementState kind="empty" title="暂无应用" description="创建应用后会出现在门户目录中。" />}
        loading={applicationsQuery.isLoading || applicationsQuery.isFetching}
        title="应用目录"
        toolbar={
          <ManagementTableToolbar>
            <ManagementToolbarSearch
              placeholder="搜索名称、slug、分类"
              value={filters.query}
              onChange={(value) => setFilters((current) => ({ ...current, query: value }))}
            />
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 160 }}
              options={statusOptions}
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
        title={editing ? '编辑应用' : '新建应用'}
        width={900}
        onCancel={() => {
          setModalOpen(false)
          setEditing(null)
        }}
      >
        <Form
          form={form}
          className="soha-identity-app-form"
          initialValues={defaultFormValues()}
          layout="vertical"
          onFinish={submitForm}
        >
          <div className="soha-identity-form-grid">
            <Form.Item
              label="名称"
              name="name"
              rules={[{ required: true, message: '请输入应用名称' }]}
            >
              <Input placeholder="Grafana" />
            </Form.Item>
            <Form.Item label="Slug" name="slug">
              <Input placeholder="grafana" />
            </Form.Item>
            <Form.Item label="Provider type" name="providerType">
              <Select options={providerTypeOptions} />
            </Form.Item>
            <Form.Item label="Status" name="status">
              <Select options={statusOptions} />
            </Form.Item>
            <Form.Item label="Category" name="category">
              <Input placeholder="Observability" />
            </Form.Item>
            <Form.Item label="Sort order" name="sortOrder">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item label="Description" name="description">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>

          <div className="soha-identity-form-grid">
            <Form.Item label="Launch URL" name="launchUrl">
              <Input prefix={<LinkOutlined />} placeholder="https://grafana.example.com" />
            </Form.Item>
            <Form.Item label="Provider ID" name="providerId">
              <Input placeholder="reserved for OIDC / Proxy phases" />
            </Form.Item>
          </div>

          {formProviderType === 'oidc' ? (
            <div className="soha-identity-oidc-launch-editor">
              <Text strong>OIDC launch</Text>
              <div className="soha-identity-form-grid">
                <Form.Item label="Client ID override" name="oidcClientId">
                  <Input placeholder="client-id" />
                </Form.Item>
                <Form.Item label="Redirect URI override" name="oidcRedirectUri">
                  <Input placeholder="https://app.example.com/callback" />
                </Form.Item>
              </div>
              <Form.Item label="Scopes" name="oidcScopes">
                <Select
                  mode="tags"
                  options={oidcScopeOptions}
                  tokenSeparators={[',', ' ']}
                />
              </Form.Item>
            </div>
          ) : null}

          <div className="soha-identity-form-grid">
            <Form.Item label="Icon URL" name="iconUrl">
              <Input placeholder="https://example.com/icon.png" />
            </Form.Item>
            <Form.Item label="Tags" name="tags">
              <Select mode="tags" tokenSeparators={[',']} />
            </Form.Item>
          </div>

          <div className="soha-identity-switch-row">
            <Form.Item label="Portal visible" name="portalVisible" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="Featured" name="featured" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>

          <Form.List name="assignments">
            {(fields, { add, remove }) => (
              <div className="soha-identity-assignment-editor">
                <div className="soha-identity-assignment-header">
                  <Text strong>Assignments</Text>
                  <Button
                    icon={<PlusOutlined />}
                    size="small"
                    onClick={() => add({ effect: 'allow', subjectId: '', subjectType: 'role' })}
                  >
                    添加
                  </Button>
                </div>
                {fields.length ? (
                  fields.map((field) => (
                    <div className="soha-identity-assignment-row" key={field.key}>
                      <Form.Item name={[field.name, 'subjectType']} rules={[{ required: true }]}>
                        <Select options={assignmentSubjectOptions} />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'subjectId']}
                        rules={[{ required: true, message: '请输入 subject id' }]}
                      >
                        <Input placeholder="admin / team-a / user-id" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'effect']}>
                        <Select disabled options={[{ label: 'Allow', value: 'allow' }]} />
                      </Form.Item>
                      <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))
                ) : (
                  <Text type="secondary">未配置 assignment 时，所有已登录用户可访问该应用。</Text>
                )}
              </div>
            )}
          </Form.List>

          <div className="soha-identity-form-actions">
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
