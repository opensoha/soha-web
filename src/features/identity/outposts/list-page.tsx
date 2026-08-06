import { useMemo, useState } from 'react'
import { App, Button, Form, Popconfirm, Select, Space, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { identityRuntimeQueries } from '../runtime'
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

const statusLabels: Record<IdentityOutpostStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  degraded: 'Degraded',
}

function statusTag(status: IdentityOutpostStatus) {
  const normalizedStatus = statusLabels[status] ? status : 'offline'
  return <StatusTag label={statusLabels[normalizedStatus]} value={normalizedStatus} />
}

function modeTag(mode: IdentityOutpostMode) {
  const tone =
    mode === 'embedded'
      ? 'blue'
      : mode === 'kubernetes'
        ? 'purple'
        : mode === 'external'
          ? 'cyan'
          : 'default'
  return <MetadataTag label={mode} tone={tone} />
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
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [queryForm] = Form.useForm<IdentityOutpostPageFilters>()
  const [filters, setFilters] = useState<IdentityOutpostPageFilters>({
    mode: '',
    status: '',
    query: '',
  })
  const [editing, setEditing] = useState<IdentityOutpost | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [createdToken, setCreatedToken] = useState<IdentityOutpostCreatedToken | null>(null)
  const snapshot = usePermissionSnapshot().data?.data
  const canCreate = hasPermission(snapshot, 'identity.outposts.create')
  const canUpdate = hasPermission(snapshot, 'identity.outposts.update')
  const canDelete = hasPermission(snapshot, 'identity.outposts.delete')
  const canRotate = hasPermission(snapshot, 'identity.outposts.rotate')

  const outpostsQuery = useQuery(
    identityOutpostQueries.list({ mode: filters.mode, status: filters.status }),
  )
  const runtimeQuery = useQuery(identityRuntimeQueries.capabilities())
  const allowedModes = useMemo<IdentityOutpostMode[]>(() => {
    const capability = runtimeQuery.data?.outpost
    if (!capability) return []
    return [
      capability.embeddedRuntime.available && 'embedded',
      capability.agentRuntime.available && 'agent',
      capability.kubernetesArtifact.available && 'kubernetes',
      capability.externalProtocol.available && 'external',
    ].filter((mode): mode is IdentityOutpostMode => Boolean(mode))
  }, [runtimeQuery.data])

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
  const rotateTokenMutation = useMutation({
    ...identityOutpostMutations.rotateToken(queryClient),
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
      title: 'Runtime',
      dataIndex: 'runtimeStatus',
      width: 180,
      render: (value: IdentityOutpost['runtimeStatus'], record) => (
        <Space orientation="vertical" size={0}>
          <StatusTag value={value || 'unknown'} />
          {record.runtimeReason ? <Text type="secondary">{record.runtimeReason}</Text> : null}
        </Space>
      ),
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
      dataIndex: 'lastHeartbeatAt',
      width: 160,
      render: (value: string | undefined, record) => formatDateTime(value || record.lastSeenAt),
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
      width: 136,
      render: (_value, record) => (
        <Space size={4}>
          <ManagementIconButton
            disabled={!canUpdate}
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
            tooltip="编辑 Outpost"
          />
          <Popconfirm
            title="轮换 Outpost token"
            description="旧 token 将立即失效。确认已准备更新 Outpost 配置。"
            okButtonProps={{ loading: rotateTokenMutation.isPending }}
            okText="轮换"
            onConfirm={() =>
              rotateTokenMutation.mutate(record.id, {
                onSuccess: (outpost) => {
                  message.success(`已轮换 ${outpost.name} token`)
                  if (outpost.token) setCreatedToken({ name: outpost.name, token: outpost.token })
                },
              })
            }
          >
            <ManagementIconButton
              disabled={!canRotate}
              icon={<KeyOutlined />}
              tooltip="轮换 token"
            />
          </Popconfirm>
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
              disabled={!canDelete}
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
        className="soha-identity-outposts-page"
        query={{
          actions: (
            <ManagementQueryActions
              disabledReset={!filters.query && !filters.mode && !filters.status}
              loading={outpostsQuery.isFetching}
              onReset={() => {
                queryForm.resetFields()
                setFilters({ mode: '', status: '', query: '' })
              }}
            />
          ),
          children: (
            <>
              <ManagementKeywordField
                label={t('common.keyword', '关键词')}
                name="query"
                placeholder={t('identity.outposts.search', '搜索名称、endpoint、版本')}
              />
              <ManagementQueryField
                label={t('identity.outposts.mode', '模式')}
                name="mode"
                width={160}
              >
                <Select
                  allowClear
                  options={identityOutpostModeOptions}
                  placeholder={t('identity.outposts.mode', '模式')}
                />
              </ManagementQueryField>
              <ManagementQueryField
                label={t('identity.outposts.status', '状态')}
                name="status"
                width={160}
              >
                <Select
                  allowClear
                  options={identityOutpostStatusOptions}
                  placeholder={t('identity.outposts.status', '状态')}
                />
              </ManagementQueryField>
            </>
          ),
          form: queryForm,
          initialValues: { mode: '', status: '', query: '' },
          onFinish: (values) =>
            setFilters({
              mode: values.mode ?? '',
              status: values.status ?? '',
              query: String(values.query ?? '').trim(),
            }),
        }}
        table={{
          columnSettingIconOnly: true,
          columnSettingPlacement: 'header',
          columns,
          dataSource: filteredOutposts,
          loading: outpostsQuery.isLoading || outpostsQuery.isFetching,
          rowKey: 'id',
          scroll: { x: 'max-content' },
          headerExtra: (
            <ManagementTableToolbar>
              <Button
                autoInsertSpace={false}
                disabled={!canCreate || allowedModes.length === 0}
                icon={<PlusOutlined />}
                onClick={openCreate}
                size="small"
                type="primary"
              >
                {t('identity.outposts.create', '新建 Outpost')}
              </Button>
              <ManagementRefreshButton
                aria-label={t('common.refresh', '刷新')}
                loading={outpostsQuery.isFetching}
                onClick={() => void outpostsQuery.refetch()}
                title={t('common.refresh', '刷新')}
                tooltip={t('common.refresh', '刷新')}
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
        allowedModes={allowedModes}
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
