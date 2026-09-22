import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { isApiError } from '@/services/api-error'
import { identityProviderQueries } from '../providers'
import { providersForOutpost } from './deployment-model'
import { OutpostDetailDrawer } from './components/outpost-detail-drawer'
import {
  App,
  Button,
  Form,
  Popconfirm,
  Select,
  Space,
  Typography,
  Tooltip,
  type TableColumnsType,
} from 'antd'
import { DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementDensityButton,
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { tableColumnPresets } from '@/utils/table-columns'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { identityRuntimeQueries } from '../runtime'
import { IdentityOutpostFormModal } from './components/outpost-form-modal'
import {
  IdentityOutpostTokenModal,
  type IdentityOutpostCreatedToken,
} from './components/outpost-token-modal'
import { identityOutpostMutations } from './mutations'
import { identityOutpostModeOptions } from './options'
import { identityOutpostQueries } from './queries'
import {
  outpostConfigurationSummary,
  outpostRuntimeLabels,
  outpostRuntimeReason,
} from './runtime-model'
import type {
  IdentityOutpost,
  IdentityOutpostFilters,
  IdentityOutpostInput,
  IdentityOutpostMode,
} from './types'
import '../shared/application-access.css'
import './styles.css'

const { Text } = Typography

interface IdentityOutpostPageFilters extends IdentityOutpostFilters {
  query: string
  runtimeStatus?: IdentityOutpost['runtimeStatus'] | ''
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
    runtimeStatus: '',
    query: '',
  })
  const [params, setParams] = useSearchParams()
  const showDetails = (id: string, view = 'overview') =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('outpost', id)
      next.set('outpostTab', view)
      return next
    })
  const closeDetails = () =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('outpost')
      next.delete('outpostTab')
      return next
    })
  const [editing, setEditing] = useState<IdentityOutpost | null>(null)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15 })
  const [modalOpen, setModalOpen] = useState(false)
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const [createdToken, setCreatedToken] = useState<IdentityOutpostCreatedToken | null>(null)
  const snapshot = usePermissionSnapshot().data?.data
  const canCreate = hasPermission(snapshot, 'identity.outposts.create')
  const canUpdate = hasPermission(snapshot, 'identity.outposts.update')
  const canDelete = hasPermission(snapshot, 'identity.outposts.delete')
  const canRotate = hasPermission(snapshot, 'identity.outposts.rotate')
  const canViewProviders = hasPermission(snapshot, 'identity.providers.view')
  const providerBindings = useQuery({
    ...identityProviderQueries.list({ type: 'proxy' }),
    enabled: canViewProviders,
  })

  const outpostsQuery = useQuery({
    ...identityOutpostQueries.list({ mode: filters.mode }),
    refetchInterval: 15_000,
  })
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
    return outposts.filter(
      (item) =>
        (!filters.runtimeStatus || item.runtimeStatus === filters.runtimeStatus) &&
        (!keyword ||
          [
            item.name,
            item.mode,
            item.runtimeStatus,
            item.forwardAuthUrl,
            item.endpoint,
            item.runtimeVersion,
          ].some((value) =>
            String(value ?? '')
              .toLowerCase()
              .includes(keyword),
          )),
    )
  }, [filters.query, filters.runtimeStatus, outposts])

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
        showDetails(outpost.id)
        if (outpost.token) {
          setCreatedToken({ name: outpost.name, token: outpost.token })
        }
        setModalOpen(false)
        setEditing(null)
      },
    })
  }

  const currentPage = Math.min(
    pagination.current,
    Math.max(1, Math.ceil(filteredOutposts.length / pagination.pageSize)),
  )
  const nodeActions = (outpost: IdentityOutpost) => (
    <Space size={4}>
      <ManagementIconButton
        disabled={!canUpdate}
        icon={<EditOutlined />}
        onClick={() => openEdit(outpost)}
        tooltip="编辑 Outpost"
      />
      <Popconfirm
        title="轮换 Outpost token"
        description="旧 token 将立即失效。确认已准备更新 Outpost 配置。"
        disabled={!canRotate}
        okButtonProps={{ loading: rotateTokenMutation.isPending }}
        okText="轮换"
        onConfirm={() =>
          rotateTokenMutation.mutate(outpost.id, {
            onSuccess: (result) => {
              message.success(`已轮换 ${result.name} token`)
              if (result.token) setCreatedToken({ name: result.name, token: result.token })
            },
          })
        }
      >
        <ManagementIconButton disabled={!canRotate} icon={<KeyOutlined />} tooltip="轮换 token" />
      </Popconfirm>
      <Popconfirm
        title="删除 Outpost"
        description={`确认删除 ${outpost.name}？`}
        disabled={!canDelete}
        okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
        okText="删除"
        onConfirm={() =>
          deleteMutation.mutate(outpost.id, {
            onSuccess: () => {
              message.success('已删除 Outpost')
              if (params.get('outpost') === outpost.id) closeDetails()
            },
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
  )

  const columns: TableColumnsType<IdentityOutpost> = [
    {
      title: '接入节点',
      dataIndex: 'name',
      width: 250,
      render: (_, outpost) => (
        <Space orientation="vertical" size={2}>
          <Link to={'?outpost=' + encodeURIComponent(outpost.id)}>{outpost.name}</Link>
          {outpost.mode !== 'embedded' && (
            <Button type="link" size="small" onClick={() => showDetails(outpost.id, 'deploy')}>
              查看部署
            </Button>
          )}
        </Space>
      ),
    },
    { title: '模式', dataIndex: 'mode', width: 100, render: modeTag },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'runtimeStatus',
      render: (_, outpost) => (
        <Tooltip
          title={
            outpost.runtimeStatus === 'available'
              ? undefined
              : outpostRuntimeReason(outpost.runtimeReason)
          }
        >
          <span tabIndex={outpost.runtimeStatus === 'available' ? undefined : 0}>
            <StatusTag
              value={outpost.runtimeStatus}
              label={outpostRuntimeLabels[outpost.runtimeStatus]}
            />
          </span>
        </Tooltip>
      ),
    },
    {
      title: '配置同步',
      key: 'configuration',
      width: 140,
      render: (_, outpost) => outpostConfigurationSummary(outpost),
    },
    {
      title: '关联应用',
      key: 'applications',
      width: 120,
      render: (_, outpost) =>
        !canViewProviders ? (
          '无查看权限'
        ) : providerBindings.isError ? (
          <Button type="link" size="small" onClick={() => void providerBindings.refetch()}>
            加载失败，重试
          </Button>
        ) : providerBindings.isSuccess ? (
          <Button type="link" size="small" onClick={() => showDetails(outpost.id, 'apps')}>
            {
              new Set(
                providersForOutpost(providerBindings.data, outpost.id).map(
                  (provider) => provider.applicationId,
                ),
              ).size
            }{' '}
            个应用
          </Button>
        ) : (
          '加载中'
        ),
    },
    {
      ...tableColumnPresets.datetime,
      title: '最近心跳',
      key: 'heartbeat',
      render: (_, outpost) =>
        outpost.mode === 'embedded' ? (
          <Text type="secondary">—</Text>
        ) : !outpost.lastHeartbeatAt ? (
          '尚未收到'
        ) : (
          formatDateTime(outpost.lastHeartbeatAt)
        ),
    },
    {
      ...tableColumnPresets.action,
      key: 'actions',
      render: (_, outpost) => nodeActions(outpost),
    },
  ]

  return (
    <>
      <ManagementDataPage
        className="soha-identity-access-page soha-identity-outposts-page"
        query={{
          actions: (
            <ManagementQueryActions
              disabledReset={!filters.query && !filters.mode && !filters.runtimeStatus}
              loading={outpostsQuery.isFetching}
              onReset={() => {
                queryForm.resetFields()
                setFilters({ mode: '', runtimeStatus: '', query: '' })
                setPagination((current) => ({ ...current, current: 1 }))
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
                width={180}
                minWidth={180}
              >
                <Select
                  allowClear
                  options={identityOutpostModeOptions}
                  placeholder={t('identity.outposts.mode', '模式')}
                />
              </ManagementQueryField>
              <ManagementQueryField
                label={t('identity.outposts.status', '状态')}
                name="runtimeStatus"
                width={180}
                minWidth={180}
              >
                <Select
                  allowClear
                  options={Object.entries(outpostRuntimeLabels).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  placeholder={t('identity.outposts.status', '状态')}
                />
              </ManagementQueryField>
            </>
          ),
          form: queryForm,
          initialValues: { mode: '', runtimeStatus: '', query: '' },
          onFinish: (values) => {
            setFilters({
              mode: values.mode ?? '',
              runtimeStatus: values.runtimeStatus ?? '',
              query: String(values.query ?? '').trim(),
            })
            setPagination((current) => ({ ...current, current: 1 }))
          },
        }}
        beforeQuery={
          outpostsQuery.isError ? (
            <ManagementState
              kind={
                isApiError(outpostsQuery.error) && outpostsQuery.error.status === 403
                  ? 'no-permission'
                  : 'error'
              }
              title="接入节点加载失败"
              description={outpostsQuery.error.message}
              actions={<Button onClick={() => void outpostsQuery.refetch()}>重试</Button>}
            />
          ) : runtimeQuery.isError ? (
            <ManagementState
              kind="error"
              title="运行能力加载失败"
              description={runtimeQuery.error.message}
              actions={<Button onClick={() => void runtimeQuery.refetch()}>重试</Button>}
            />
          ) : null
        }
        table={{
          rowKey: 'id',
          columns,
          dataSource: outpostsQuery.isError ? [] : filteredOutposts,
          loading: outpostsQuery.isLoading || outpostsQuery.isFetching,
          tableSize,
          columnSettingPlacement: 'header',
          columnSettingIconOnly: true,
          pagination: {
            current: currentPage,
            pageSize: pagination.pageSize,
            onChange: (current: number, pageSize: number) => setPagination({ current, pageSize }),
          },
          empty: (
            <ManagementState
              kind={outpostsQuery.isError ? 'error' : 'empty'}
              title={outpostsQuery.isError ? '接入节点加载失败' : '暂无接入节点'}
              description={
                filters.query || filters.mode || filters.runtimeStatus
                  ? '没有符合条件的接入节点，请调整筛选条件。'
                  : '创建内嵌或远程节点后，可在认证接入中关联应用。'
              }
            />
          ),
          headerExtra: (
            <ManagementTableToolbar>
              <Button
                disabled={!canCreate || allowedModes.length === 0}
                icon={<PlusOutlined />}
                onClick={openCreate}
                type="primary"
              >
                {t('identity.outposts.create', '新建 Outpost')}
              </Button>
              <ManagementDensityButton
                aria-label={t('table.density', '切换表格密度')}
                tooltip={t('table.density', '切换表格密度')}
                onClick={() => setTableSize((size) => (size === 'small' ? 'middle' : 'small'))}
              />
              <ManagementRefreshButton
                aria-label={t('common.refresh', '刷新')}
                loading={outpostsQuery.isFetching}
                onClick={() => void outpostsQuery.refetch()}
                tooltip={t('common.refresh', '刷新')}
              />
            </ManagementTableToolbar>
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

      {params.get('outpost') && (
        <OutpostDetailDrawer
          id={params.get('outpost') ?? ''}
          initialTab={params.get('outpostTab') ?? 'overview'}
          onClose={closeDetails}
          onEdit={openEdit}
        />
      )}
      <IdentityOutpostTokenModal
        onClose={() => {
          setCreatedToken(null)
          createMutation.reset()
          rotateTokenMutation.reset()
        }}
        value={createdToken}
      />
    </>
  )
}
