import { useMemo, useState } from 'react'
import { Alert, App, Button, Form, Input, Modal, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { ManagementDataPage } from '@/components/management-data-page'
import { hasPermission, usePermissionSnapshot } from '@/features/auth/permission-snapshot'
import type {
  IdentityOutpost,
  IdentityOutpostInput,
  IdentityOutpostMode,
  IdentityOutpostStatus,
} from './identity-outposts-api'
import {
  createIdentityOutpost,
  deleteIdentityOutpost,
  identityOutpostQueryKeys,
  listIdentityOutposts,
  updateIdentityOutpost,
} from './identity-outposts-api'

const { Text } = Typography

interface IdentityOutpostFormValues {
  endpoint?: string
  metadataJson?: string
  mode: IdentityOutpostMode
  name: string
  status: IdentityOutpostStatus
  version?: string
}

const modeOptions: Array<{ label: string; value: IdentityOutpostMode }> = [
  { label: 'Embedded', value: 'embedded' },
  { label: 'Agent', value: 'agent' },
  { label: 'Kubernetes', value: 'kubernetes' },
  { label: 'External', value: 'external' },
]

const statusOptions: Array<{ label: string; value: IdentityOutpostStatus }> = [
  { label: 'Online', value: 'online' },
  { label: 'Offline', value: 'offline' },
  { label: 'Degraded', value: 'degraded' },
]

const statusTagMeta: Record<IdentityOutpostStatus, { color: string; label: string }> = {
  online: { color: 'green', label: 'Online' },
  offline: { color: 'default', label: 'Offline' },
  degraded: { color: 'gold', label: 'Degraded' },
}

function statusTag(status: IdentityOutpostStatus) {
  const meta = statusTagMeta[status] ?? statusTagMeta.offline
  return <Tag color={meta.color}>{meta.label}</Tag>
}

function modeTag(mode: IdentityOutpostMode) {
  const color = mode === 'embedded' ? 'blue' : mode === 'kubernetes' ? 'purple' : mode === 'external' ? 'cyan' : 'default'
  return <Tag color={color}>{mode}</Tag>
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

function parseMetadata(value?: string) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('metadata must be a JSON object')
  }
  return parsed as Record<string, unknown>
}

function formValues(outpost?: IdentityOutpost | null): IdentityOutpostFormValues {
  return {
    endpoint: outpost?.endpoint ?? '',
    metadataJson: JSON.stringify(outpost?.metadata ?? {}, null, 2),
    mode: outpost?.mode ?? 'embedded',
    name: outpost?.name ?? '',
    status: outpost?.status ?? 'offline',
    version: outpost?.version ?? '',
  }
}

function inputFromValues(values: IdentityOutpostFormValues): IdentityOutpostInput {
  return {
    endpoint: values.endpoint?.trim(),
    metadata: parseMetadata(values.metadataJson),
    mode: values.mode,
    name: values.name.trim(),
    status: values.status,
    version: values.version?.trim(),
  }
}

export function IdentityOutpostsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({ mode: '', status: '', query: '' })
  const [editing, setEditing] = useState<IdentityOutpost | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [createdToken, setCreatedToken] = useState<{ name: string; token: string } | null>(null)
  const [form] = Form.useForm<IdentityOutpostFormValues>()
  const snapshot = usePermissionSnapshot().data?.data
  const canManage = hasPermission(snapshot, 'identity.outposts.manage')

  const outpostsQuery = useQuery({
    queryKey: identityOutpostQueryKeys.outposts({ mode: filters.mode, status: filters.status }),
    queryFn: () => listIdentityOutposts({ mode: filters.mode, status: filters.status }),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['identity', 'outposts'] })
  }

  const createMutation = useMutation({
    mutationFn: createIdentityOutpost,
    onSuccess: (outpost) => {
      message.success(`已创建 Outpost ${outpost?.name ?? ''}`)
      if (outpost?.token) {
        setCreatedToken({ name: outpost.name, token: outpost.token })
      }
      setModalOpen(false)
      setEditing(null)
      invalidate()
    },
    onError: (error: Error) => message.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ outpostId, input }: { outpostId: string; input: IdentityOutpostInput }) =>
      updateIdentityOutpost(outpostId, input),
    onSuccess: (outpost) => {
      message.success(`已更新 Outpost ${outpost?.name ?? ''}`)
      setModalOpen(false)
      setEditing(null)
      invalidate()
    },
    onError: (error: Error) => message.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteIdentityOutpost,
    onSuccess: () => {
      message.success('已删除 Outpost')
      invalidate()
    },
    onError: (error: Error) => message.error(error.message),
  })

  const outposts = outpostsQuery.data ?? []
  const filteredOutposts = useMemo(() => {
    const keyword = filters.query.trim().toLowerCase()
    if (!keyword) return outposts
    return outposts.filter((item) => [
      item.name,
      item.mode,
      item.status,
      item.endpoint,
      item.version,
    ].some((value) => String(value ?? '').toLowerCase().includes(keyword)))
  }, [filters.query, outposts])

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue(formValues(null))
    setModalOpen(true)
  }

  const openEdit = (outpost: IdentityOutpost) => {
    setEditing(outpost)
    form.setFieldsValue(formValues(outpost))
    setModalOpen(true)
  }

  const submitForm = async () => {
    const values = await form.validateFields()
    let input: IdentityOutpostInput
    try {
      input = inputFromValues(values)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'metadata JSON 无效')
      return
    }
    if (editing) {
      updateMutation.mutate({ outpostId: editing.id, input })
      return
    }
    createMutation.mutate(input)
  }

  const columns: TableColumnsType<IdentityOutpost> = [
    {
      title: 'Outpost',
      dataIndex: 'name',
      width: 220,
      render: (_value, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      width: 140,
      render: (value: IdentityOutpostMode) => modeTag(value),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 140,
      render: (value: IdentityOutpostStatus) => statusTag(value),
    },
    {
      title: 'Endpoint',
      dataIndex: 'endpoint',
      ellipsis: true,
      render: (value?: string) => value || <Text type="secondary">-</Text>,
    },
    {
      title: 'Version',
      dataIndex: 'version',
      width: 140,
      render: (value?: string) => value || <Text type="secondary">-</Text>,
    },
    {
      title: 'Last Seen',
      dataIndex: 'lastSeenAt',
      width: 160,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      width: 160,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 104,
      render: (_value, record) => (
        <Space size={4}>
          <ManagementIconButton
            disabled={!canManage}
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
            tooltip="编辑 Outpost"
          />
          <Popconfirm
            title="删除 Outpost"
            description={`确认删除 ${record.name}？`}
            okButtonProps={{ danger: true }}
            okText="删除"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <ManagementIconButton
              danger
              disabled={!canManage}
              icon={<DeleteOutlined />}
              tooltip="删除 Outpost"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <ManagementDataPage
        header={{
          title: 'Outposts',
          description: 'Proxy Provider 的边缘运行组件与 embedded forward-auth 控制面。',
          actions: (
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => outpostsQuery.refetch()}>
                刷新
              </Button>
              <Button
                disabled={!canManage}
                icon={<PlusOutlined />}
                onClick={openCreate}
                type="primary"
              >
                新建 Outpost
              </Button>
            </Space>
          ),
        }}
        table={{
          columns,
          dataSource: filteredOutposts,
          loading: outpostsQuery.isLoading,
          rowKey: 'id',
          scroll: { x: 1100 },
          toolbar: (
            <ManagementTableToolbar>
              <ManagementToolbarSearch
                onChange={(value) => setFilters((current) => ({ ...current, query: value }))}
                placeholder="搜索名称、endpoint、版本"
                value={filters.query}
              />
              <Select
                allowClear
                onChange={(value) => setFilters((current) => ({ ...current, mode: value ?? '' }))}
                options={modeOptions}
                placeholder="Mode"
                style={{ width: 160 }}
                value={filters.mode || undefined}
              />
              <Select
                allowClear
                onChange={(value) => setFilters((current) => ({ ...current, status: value ?? '' }))}
                options={statusOptions}
                placeholder="Status"
                style={{ width: 160 }}
                value={filters.status || undefined}
              />
            </ManagementTableToolbar>
          ),
          empty: (
            <ManagementState
              description="创建 embedded 或外部 Outpost 后，可在 Proxy Provider 中绑定使用。"
              kind="empty"
              title="暂无 Outpost"
            />
          ),
        }}
      />

      <Modal
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnHidden
        okText={editing ? '保存' : '创建'}
        onCancel={() => setModalOpen(false)}
        onOk={() => void submitForm()}
        open={modalOpen}
        title={editing ? `编辑 ${editing.name}` : '新建 Outpost'}
        width={720}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: '请输入 Outpost 名称' }]}>
            <Input placeholder="edge-grafana" />
          </Form.Item>
          <Space.Compact block>
            <Form.Item name="mode" label="Mode" style={{ width: '50%' }} rules={[{ required: true }]}>
              <Select options={modeOptions} />
            </Form.Item>
            <Form.Item name="status" label="Status" style={{ width: '50%' }} rules={[{ required: true }]}>
              <Select options={statusOptions} />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="endpoint" label="Endpoint">
            <Input placeholder="https://outpost.example.com" />
          </Form.Item>
          <Form.Item name="version" label="Version">
            <Input placeholder="0.1.0" />
          </Form.Item>
          <Form.Item name="metadataJson" label="Metadata JSON">
            <Input.TextArea autoSize={{ minRows: 4, maxRows: 10 }} spellCheck={false} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        footer={
          <Button type="primary" onClick={() => setCreatedToken(null)}>
            关闭
          </Button>
        }
        onCancel={() => setCreatedToken(null)}
        open={Boolean(createdToken)}
        title={createdToken ? `${createdToken.name} token` : 'Outpost token'}
        width={720}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="warning"
            title="Token is shown once"
            description="Use this token for outpost claim, heartbeat, check, and events calls."
          />
          <Text code copyable={{ text: createdToken?.token ?? '' }} style={{ wordBreak: 'break-all' }}>
            {createdToken?.token}
          </Text>
        </Space>
      </Modal>
    </>
  )
}
