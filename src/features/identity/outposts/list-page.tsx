import { useMemo, useState } from 'react'
import { App, Button, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { IdentityOutpostFormModal } from './components/outpost-form-modal'
import {
  IdentityOutpostTokenModal,
  type IdentityOutpostCreatedToken,
} from './components/outpost-token-modal'
import { identityOutpostMutations } from './mutations'
import { identityOutpostModeOptions, identityOutpostStatusOptions } from './options'
import { identityOutpostQueries } from './queries'
import type {
  IdentityOutpost,
  IdentityOutpostFilters,
  IdentityOutpostInput,
  IdentityOutpostMode,
  IdentityOutpostStatus,
} from './types'

const { Text } = Typography

interface IdentityOutpostPageFilters extends IdentityOutpostFilters {
  query: string
}

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
  const color =
    mode === 'embedded'
      ? 'blue'
      : mode === 'kubernetes'
        ? 'purple'
        : mode === 'external'
          ? 'cyan'
          : 'default'
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

export function IdentityOutpostsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<IdentityOutpostPageFilters>({
    mode: '',
    status: '',
    query: '',
  })
  const [editing, setEditing] = useState<IdentityOutpost | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [createdToken, setCreatedToken] = useState<IdentityOutpostCreatedToken | null>(null)
  const snapshot = usePermissionSnapshot().data?.data
  const canManage = hasPermission(snapshot, 'identity.outposts.manage')

  const outpostsQuery = useQuery(
    identityOutpostQueries.list({ mode: filters.mode, status: filters.status }),
  )

  const createMutation = useMutation({
    ...identityOutpostMutations.create(queryClient),
    onError: (error: Error) => message.error(error.message),
  })
  const updateMutation = useMutation({
    ...identityOutpostMutations.update(queryClient),
    onError: (error: Error) => message.error(error.message),
  })
  const deleteMutation = useMutation({
    ...identityOutpostMutations.remove(queryClient),
    onError: (error: Error) => message.error(error.message),
  })

  const outposts = outpostsQuery.data ?? []
  const filteredOutposts = useMemo(() => {
    const keyword = filters.query.trim().toLowerCase()
    if (!keyword) return outposts
    return outposts.filter((item) =>
      [item.name, item.mode, item.status, item.endpoint, item.version].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(keyword),
      ),
    )
  }, [filters.query, outposts])

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (outpost: IdentityOutpost) => {
    setEditing(outpost)
    setModalOpen(true)
  }

  const submitForm = (input: IdentityOutpostInput) => {
    if (editing) {
      updateMutation.mutate(
        { outpostId: editing.id, input },
        {
          onSuccess: (outpost) => {
            message.success(`已更新 Outpost ${outpost.name}`)
            setModalOpen(false)
            setEditing(null)
          },
        },
      )
      return
    }
    createMutation.mutate(input, {
      onSuccess: (outpost) => {
        message.success(`已创建 Outpost ${outpost.name}`)
        if (outpost.token) {
          setCreatedToken({ name: outpost.name, token: outpost.token })
        }
        setModalOpen(false)
        setEditing(null)
      },
    })
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
            okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
            okText="删除"
            onConfirm={() =>
              deleteMutation.mutate(record.id, {
                onSuccess: () => message.success('已删除 Outpost'),
              })
            }
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
                options={identityOutpostModeOptions}
                placeholder="Mode"
                style={{ width: 160 }}
                value={filters.mode || undefined}
              />
              <Select
                allowClear
                onChange={(value) => setFilters((current) => ({ ...current, status: value ?? '' }))}
                options={identityOutpostStatusOptions}
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

      <IdentityOutpostFormModal
        editing={editing}
        onCancel={() => setModalOpen(false)}
        onSubmit={submitForm}
        open={modalOpen}
        submitting={createMutation.isPending || updateMutation.isPending}
      />

      <IdentityOutpostTokenModal onClose={() => setCreatedToken(null)} value={createdToken} />
    </>
  )
}
