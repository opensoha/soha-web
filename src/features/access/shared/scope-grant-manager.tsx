import { useMemo, useState } from 'react'
import { App, Button, Modal, Popconfirm, Space, Tag, Tooltip } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { accessMutations, invalidateAccessScopeGrants } from './mutations'
import { accessQueries } from './queries'
import { ScopeGrantEditor } from './scope-grant-editor'
import type { AccessScopeGrant } from './types'

type ColumnProps<T> = TableColumnsType<T>[number]

interface ScopeGrantManagerProps {
  subjectType: 'user' | 'team'
  subjectId: string | null
  visible: boolean
  title: string
  onClose: () => void
}

export function ScopeGrantManager({
  subjectType,
  subjectId,
  visible,
  title,
  onClose,
}: ScopeGrantManagerProps) {
  const { message } = App.useApp()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const canCreateScopeGrants = hasPermission(snapshot, 'access.scope-grants.create')
  const canUpdateScopeGrants = hasPermission(snapshot, 'access.scope-grants.update')
  const canDeleteScopeGrants = hasPermission(snapshot, 'access.scope-grants.delete')
  const canViewRoles = hasPermission(snapshot, 'access.roles.view')
  const canViewApplications = hasPermission(snapshot, 'delivery.applications.view')
  const canViewApplicationEnvironments = hasPermission(
    snapshot,
    'delivery.application-environments.view',
  )
  const canViewClusters = hasPermission(snapshot, 'platform.clusters.view')
  const canUseEditor =
    Boolean(subjectId) &&
    canViewRoles &&
    ((canViewApplications && canViewApplicationEnvironments) || canViewClusters)
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<AccessScopeGrant | null>(null)
  const [grantModalVisible, setGrantModalVisible] = useState(false)
  const grantsQuery = useQuery(accessQueries.scopeGrants(visible && Boolean(subjectId)))
  const applicationsQuery = useQuery(
    accessQueries.applicationOptions(visible && canViewApplications),
  )
  const clustersQuery = useQuery(accessQueries.clusterOptions(visible && canViewClusters))
  const applicationMap = useMemo(
    () => Object.fromEntries((applicationsQuery.data ?? []).map((item) => [item.id, item.name])),
    [applicationsQuery.data],
  )
  const clusterMap = useMemo(
    () => Object.fromEntries((clustersQuery.data ?? []).map((item) => [item.id, item.name])),
    [clustersQuery.data],
  )
  const grants = useMemo(
    () =>
      (grantsQuery.data ?? []).filter(
        (item) => item.subjectType === subjectType && item.subjectId === subjectId,
      ),
    [grantsQuery.data, subjectId, subjectType],
  )

  const createMutation = useMutation({
    ...accessMutations.scopeGrants.create(),
    onSuccess: async () => {
      message.success('授权项创建成功')
      await invalidateAccessScopeGrants(queryClient)
      setGrantModalVisible(false)
    },
    onError: (error) => message.error(error.message),
  })
  const updateMutation = useMutation({
    ...accessMutations.scopeGrants.update(),
    onSuccess: async () => {
      message.success('授权项更新成功')
      await invalidateAccessScopeGrants(queryClient)
      setEditing(null)
      setGrantModalVisible(false)
    },
    onError: (error) => message.error(error.message),
  })
  const deleteMutation = useMutation({
    ...accessMutations.scopeGrants.delete(),
    onSuccess: async () => {
      message.success('授权项已删除')
      await invalidateAccessScopeGrants(queryClient)
    },
    onError: (error) => message.error(error.message),
  })

  const submitGrant = (payload: Record<string, unknown>) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values: payload })
      return
    }
    createMutation.mutate(payload)
  }

  const columns: ColumnProps<AccessScopeGrant>[] = [
    {
      title: '范围类型',
      dataIndex: 'scopeType',
      render: (value: string) => (value === 'platform' ? '平台范围' : '交付范围'),
    },
    {
      title: '资源范围',
      key: 'resourceScope',
      render: (_: unknown, record: AccessScopeGrant) =>
        record.scopeType === 'platform'
          ? record.clusterIds?.map((item) => <Tag key={item}>{clusterMap[item] || item}</Tag>)
          : record.businessLineId || '-',
    },
    {
      title: '环境',
      dataIndex: 'environmentIds',
      render: (values: string[] | undefined, record: AccessScopeGrant) =>
        record.scopeType === 'platform'
          ? '-'
          : values?.length
            ? values.map((item) => <Tag key={item}>{item}</Tag>)
            : '全部',
    },
    {
      title: '应用',
      dataIndex: 'applicationIds',
      render: (values: string[] | undefined, record: AccessScopeGrant) =>
        record.scopeType === 'platform'
          ? '-'
          : values?.length
            ? values.map((item) => <Tag key={item}>{applicationMap[item] || item}</Tag>)
            : '全部',
    },
    { title: '角色', dataIndex: 'role' },
    {
      title: '效果',
      dataIndex: 'effect',
      render: (value: string) => (value === 'deny' ? '拒绝' : '允许'),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (value: boolean) => <StatusTag value={value ? 'enabled' : 'disabled'} />,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: AccessScopeGrant) => (
        <Space className="soha-row-action-icons">
          {canUpdateScopeGrants || canDeleteScopeGrants ? (
            <>
              {canUpdateScopeGrants ? (
                <ManagementIconButton
                  aria-label="编辑授权项"
                  icon={<EditOutlined />}
                  size="small"
                  tooltip="编辑"
                  onClick={() => {
                    setEditing(record)
                    setGrantModalVisible(true)
                  }}
                />
              ) : null}
              {canDeleteScopeGrants ? (
                <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate(record.id)}>
                  <ManagementIconButton
                    aria-label="删除授权项"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    tooltip="删除"
                  />
                </Popconfirm>
              ) : null}
            </>
          ) : (
            '-'
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Modal title={title} open={visible} onCancel={onClose} footer={null} width={880}>
        <div className="soha-page">
          <AdminTable
            columnSettingIconOnly
            columnSettingPlacement="header"
            shellClassName="soha-management-table-shell"
            title="授权项"
            headerExtra={
              canCreateScopeGrants ? (
                <ManagementTableToolbar>
                  <Tooltip
                    title={canUseEditor ? undefined : '需要角色目录及应用范围或集群查看权限'}
                  >
                    <span>
                      <Button
                        disabled={!canUseEditor}
                        icon={<PlusOutlined />}
                        type="primary"
                        onClick={() => {
                          setEditing(null)
                          setGrantModalVisible(true)
                        }}
                      >
                        新建授权项
                      </Button>
                    </span>
                  </Tooltip>
                </ManagementTableToolbar>
              ) : null
            }
            columns={columns}
            dataSource={grants}
            empty={
              grantsQuery.isError ? (
                <ManagementState
                  bordered={false}
                  compact
                  kind="error"
                  description="授权范围加载失败，请重试。"
                  actions={<Button onClick={() => void grantsQuery.refetch()}>重试</Button>}
                />
              ) : (
                <ManagementState
                  bordered={false}
                  compact
                  title="未设置额外范围"
                  description="当前仍按用户角色和访问策略生效。"
                />
              )
            }
            rowKey="id"
            loading={grantsQuery.isLoading}
            scroll={{ x: 'max-content' }}
          />
        </div>
      </Modal>
      <ScopeGrantEditor
        editing={editing}
        open={grantModalVisible}
        fixedSubject={subjectId ? { id: subjectId, type: subjectType } : undefined}
        onCancel={() => {
          setGrantModalVisible(false)
          setEditing(null)
        }}
        onSubmit={submitGrant}
        pending={createMutation.isPending || updateMutation.isPending}
      />
    </>
  )
}
