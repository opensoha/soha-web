import { useMemo, useState } from 'react'
import { App, Button, Modal, Space, Tabs, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  CloudSyncOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ManagementIconButton,
  ManagementState,
  useManagementTextFilter,
} from '@/components/management-list'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { settingsQueries } from '@/features/settings'
import { formatDateTime } from '@/utils/time'
import { AccessManagementTablePage } from '../shared/management-page'
import { directorySyncApi } from './api'
import { ChangePreviewModal } from './change-preview'
import { DirectoryConnectionModal } from './connection-drawer'
import { DirectoryConflictCenter } from './conflict-center'
import { directorySyncMutations } from './mutations'
import { directorySyncQueries } from './queries'
import { DirectoryRunHistory } from './run-history'
import type { DirectoryConnection, DirectoryConnectionInput, DirectorySyncPreview } from './types'
import '../shared/styles.css'

const { Text } = Typography
const providerLabels: Record<string, string> = {
  feishu: '飞书',
  wecom: '企业微信',
  dingtalk: '钉钉',
  ldap: 'LDAP',
  scim: 'SCIM',
  custom: '自定义',
}
const modeLabels: Record<string, string> = {
  manual: '手动',
  scheduled: '定时',
  scheduled_and_realtime: '定时 + 实时',
}

export function DirectorySyncPage() {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const permissionQuery = usePermissionSnapshot()
  const snapshot = permissionQuery.data?.data
  const canView = hasPermission(snapshot, 'access.directory.view')
  const canManage = hasPermission(snapshot, 'access.directory.manage')
  const canSync = hasPermission(snapshot, 'access.directory.sync')
  const canManagePeople = hasPermission(snapshot, 'access.directory.people.manage')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<DirectoryConnection | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<DirectoryConnection | null>(null)
  const [preview, setPreview] = useState<DirectorySyncPreview | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const connectionsQuery = useQuery(directorySyncQueries.connections(canView))
  const runsQuery = useQuery(directorySyncQueries.runs(selected?.id ?? ''))
  const conflictsQuery = useQuery(directorySyncQueries.conflicts(canView))
  const identitySettingsQuery = useQuery({
    ...settingsQueries.identity(),
    enabled: canManage && formOpen,
  })
  const createMutation = useMutation(directorySyncMutations.create(queryClient))
  const updateMutation = useMutation(directorySyncMutations.update(queryClient))
  const validateMutation = useMutation(directorySyncMutations.validate(queryClient))
  const syncMutation = useMutation(directorySyncMutations.sync(queryClient))
  const cancelMutation = useMutation(directorySyncMutations.cancel(queryClient))
  const resolveMutation = useMutation(directorySyncMutations.resolveConflict(queryClient))
  const previewMutation = useMutation({ mutationFn: directorySyncApi.preview })
  const connections = connectionsQuery.data ?? []
  const filtered = useManagementTextFilter(connections, search, (item) => [
    item.name,
    item.providerType,
    item.status,
    item.policy.mode,
  ])

  const confirmPeople = (onConfirmed: () => void) => {
    modal.confirm({
      title: '确认开启人员同步？',
      content: '开启后目录同步可能创建或更新用户、登录身份和组织成员关系。组织同步不受此开关影响。',
      okText: '确认开启',
      cancelText: '保持关闭',
      onOk: onConfirmed,
    })
  }

  const columns = useMemo<TableColumnsType<DirectoryConnection>>(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        width: 180,
        render: (value: string) => <Text strong>{value}</Text>,
      },
      {
        title: '目录类型',
        dataIndex: 'providerType',
        width: 110,
        render: (value: string) => <Tag>{providerLabels[value] ?? value}</Tag>,
      },
      { title: '组织同步', width: 100, render: () => <BooleanTag value trueLabel="已开启" /> },
      {
        title: '人员同步',
        width: 100,
        render: (_value, record) => (
          <BooleanTag value={record.policy.syncPeople} trueLabel="已开启" falseLabel="未开启" />
        ),
      },
      {
        title: '同步方式',
        width: 120,
        render: (_value, record) => modeLabels[record.policy.mode] ?? record.policy.mode,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (value: string) => <StatusTag value={value} />,
      },
      {
        title: '最近同步',
        dataIndex: 'lastRunAt',
        width: 180,
        render: (value?: string) => (value ? formatDateTime(value) : '-'),
      },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 180,
        render: (_value, record) => (
          <Space size={2}>
            <ManagementIconButton
              aria-label="查看同步记录"
              tooltip="同步记录"
              icon={<EyeOutlined />}
              onClick={() => setSelected(record)}
            />
            {canSync ? (
              <ManagementIconButton
                aria-label="预览变更"
                tooltip="预览变更"
                icon={<CloudSyncOutlined />}
                onClick={() => {
                  setPreview(null)
                  setPreviewOpen(true)
                  previewMutation.mutate(record.id, {
                    onSuccess: setPreview,
                    onError: (error) => void message.error(error.message),
                  })
                }}
              />
            ) : null}
            {canManage ? (
              <ManagementIconButton
                aria-label="验证连接"
                tooltip="验证连接"
                icon={<SafetyCertificateOutlined />}
                onClick={() =>
                  validateMutation.mutate(record.id, {
                    onSuccess: (result) =>
                      void message[result.valid ? 'success' : 'warning'](
                        result.message ?? (result.valid ? '连接验证通过' : '连接验证失败'),
                      ),
                    onError: (error) => void message.error(error.message),
                  })
                }
              />
            ) : null}
            {canManage ? (
              <ManagementIconButton
                aria-label="编辑目录连接"
                tooltip="编辑"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(record)
                  setFormOpen(true)
                }}
              />
            ) : null}
            {canSync ? (
              <ManagementIconButton
                aria-label="立即同步"
                tooltip="立即同步"
                icon={<CloudSyncOutlined />}
                onClick={() =>
                  syncMutation.mutate(record.id, {
                    onSuccess: () => {
                      setSelected(record)
                      void message.success('同步任务已启动')
                    },
                    onError: (error) => void message.error(error.message),
                  })
                }
              />
            ) : null}
          </Space>
        ),
      },
    ],
    [canManage, canSync, message, previewMutation, syncMutation, validateMutation],
  )

  if (!canView)
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有查看目录同步的权限。" />
      </div>
    )
  if (connectionsQuery.isError)
    return (
      <div className="soha-page">
        <ManagementState
          kind="error"
          description={connectionsQuery.error.message}
          actions={<Button onClick={() => void connectionsQuery.refetch()}>重试</Button>}
        />
      </div>
    )

  return (
    <AccessManagementTablePage
      columns={columns}
      createAction={
        canManage ? (
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            新增目录连接
          </Button>
        ) : null
      }
      dataSource={filtered}
      rowKey="id"
      loading={connectionsQuery.isLoading}
      placeholder="搜索连接、目录类型、状态或同步方式"
      searchKeyword={search}
      setSearchKeyword={setSearch}
    >
      <DirectoryConnectionModal
        canManagePeople={canManagePeople}
        confirm={confirmPeople}
        connection={editing}
        loading={createMutation.isPending || updateMutation.isPending}
        loginProviders={identitySettingsQuery.data?.providers ?? []}
        loginProvidersLoading={identitySettingsQuery.isLoading}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onSubmit={(input: DirectoryConnectionInput) => {
          const options = {
            onSuccess: () => {
              setFormOpen(false)
              void message.success('目录连接已保存')
            },
            onError: (error: Error) => void message.error(error.message),
          }
          if (editing) updateMutation.mutate({ id: editing.id, input }, options)
          else createMutation.mutate(input, options)
        }}
      />
      <ChangePreviewModal
        loading={previewMutation.isPending}
        open={previewOpen}
        preview={preview}
        syncing={syncMutation.isPending}
        onClose={() => setPreviewOpen(false)}
        onSync={() => {
          if (!preview?.connectionId) return
          syncMutation.mutate(preview.connectionId, {
            onSuccess: () => {
              setPreviewOpen(false)
              void message.success('同步已完成，组织数据已更新')
            },
            onError: (error) => void message.error(error.message),
          })
        }}
      />
      <Modal
        title={selected ? `${selected.name} · 同步运行` : '同步运行'}
        width={960}
        open={Boolean(selected)}
        footer={null}
        onCancel={() => setSelected(null)}
      >
        <Tabs
          items={[
            {
              key: 'runs',
              label: '运行历史',
              children: (
                <DirectoryRunHistory
                  canSync={canSync}
                  loading={runsQuery.isLoading}
                  runs={runsQuery.data ?? []}
                  onCancel={() =>
                    selected &&
                    cancelMutation.mutate(selected.id, {
                      onSuccess: () => void message.success('已提交取消请求'),
                      onError: (error) => void message.error(error.message),
                    })
                  }
                />
              ),
            },
            {
              key: 'conflicts',
              label: `冲突 (${(conflictsQuery.data ?? []).filter((item) => item.connectionId === selected?.id && item.status === 'open').length})`,
              children: (
                <DirectoryConflictCenter
                  canManagePeople={canManagePeople}
                  loading={conflictsQuery.isLoading}
                  conflicts={(conflictsQuery.data ?? []).filter(
                    (item) => item.connectionId === selected?.id,
                  )}
                  onResolve={(id, resolution) =>
                    resolveMutation.mutate(
                      { id, resolution },
                      {
                        onSuccess: () => void message.success('冲突已处理'),
                        onError: (error) => void message.error(error.message),
                      },
                    )
                  }
                />
              ),
            },
          ]}
        />
      </Modal>
    </AccessManagementTablePage>
  )
}
