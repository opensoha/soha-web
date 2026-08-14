import { useMemo, useState } from 'react'
import { App, Button, Popconfirm, Space, Tooltip } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { BooleanTag, MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { accessMutations, invalidateAccessScopeGrants } from '../shared/mutations'
import { accessQueries } from '../shared/queries'
import { ScopeGrantEditor } from '../shared/scope-grant-editor'
import type { AccessScopeGrant } from '../shared/types'
import '../shared/styles.css'

type ColumnProps<T> = TableColumnsType<T>[number]

export function AccessScopeGrantsPage() {
  const { message } = App.useApp()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const canViewScopeGrants = hasPermission(snapshot, 'access.scope-grants.view')
  const canCreateScopeGrants = hasPermission(snapshot, 'access.scope-grants.create')
  const canUpdateScopeGrants = hasPermission(snapshot, 'access.scope-grants.update')
  const canDeleteScopeGrants = hasPermission(snapshot, 'access.scope-grants.delete')
  const canViewRoles = hasPermission(snapshot, 'access.roles.view')
  const canViewUsers = hasPermission(snapshot, 'access.users.view')
  const canViewTeams = hasPermission(snapshot, 'access.groups.view')
  const canViewApplications = hasPermission(snapshot, 'delivery.applications.view')
  const canViewApplicationEnvironments = hasPermission(
    snapshot,
    'delivery.application-environments.view',
  )
  const canViewClusters = hasPermission(snapshot, 'platform.clusters.view')
  const canUseEditor =
    canViewRoles &&
    (canViewUsers || canViewTeams) &&
    ((canViewApplications && canViewApplicationEnvironments) || canViewClusters)
  const queryClient = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<AccessScopeGrant | null>(null)

  const grantsQuery = useQuery(accessQueries.scopeGrants(canViewScopeGrants))
  const applicationsQuery = useQuery(
    accessQueries.applicationOptions(canViewScopeGrants && canViewApplications),
  )
  const clustersQuery = useQuery(
    accessQueries.clusterOptions(canViewScopeGrants && canViewClusters),
  )
  const applicationMap = useMemo(
    () => Object.fromEntries((applicationsQuery.data ?? []).map((item) => [item.id, item.name])),
    [applicationsQuery.data],
  )
  const clusterMap = useMemo(
    () => Object.fromEntries((clustersQuery.data ?? []).map((item) => [item.id, item.name])),
    [clustersQuery.data],
  )

  const createMutation = useMutation({
    ...accessMutations.scopeGrants.create(),
    onSuccess: async () => {
      message.success('授权项创建成功')
      await invalidateAccessScopeGrants(queryClient)
      setModalVisible(false)
    },
    onError: (error) => message.error(error.message),
  })
  const updateMutation = useMutation({
    ...accessMutations.scopeGrants.update(),
    onSuccess: async () => {
      message.success('授权项更新成功')
      await invalidateAccessScopeGrants(queryClient)
      setModalVisible(false)
      setEditing(null)
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

  const columns: ColumnProps<AccessScopeGrant>[] = [
    {
      title: '主体类型',
      dataIndex: 'subjectType',
      render: (value: string) => (value === 'team' ? '组织' : '用户'),
    },
    { title: '主体 ID', dataIndex: 'subjectId' },
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
          ? record.clusterIds?.map((item) => (
              <MetadataTag key={item} label={clusterMap[item] || item} />
            ))
          : record.businessLineId || '-',
    },
    {
      title: '环境',
      dataIndex: 'environmentIds',
      render: (values: string[] | undefined, record: AccessScopeGrant) =>
        record.scopeType === 'platform'
          ? '-'
          : values?.length
            ? values.map((item) => <MetadataTag key={item} label={item} />)
            : '全部',
    },
    {
      title: '应用',
      dataIndex: 'applicationIds',
      render: (values: string[] | undefined, record: AccessScopeGrant) =>
        record.scopeType === 'platform'
          ? '-'
          : values?.length
            ? values.map((item) => <MetadataTag key={item} label={applicationMap[item] || item} />)
            : '全部',
    },
    { title: '角色', dataIndex: 'role' },
    {
      title: '效果',
      dataIndex: 'effect',
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (value: boolean) => <BooleanTag value={value} />,
    },
    {
      ...tableColumnPresets.datetime,
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      render: (_: unknown, record: AccessScopeGrant) => (
        <Space className="soha-row-action-icons" size={2}>
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
                    setModalVisible(true)
                  }}
                />
              ) : null}
              {canDeleteScopeGrants ? (
                <Popconfirm
                  title="确认删除？"
                  onConfirm={() => deleteMutation.mutate(record.id)}
                  placement="topRight"
                >
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

  if (!canViewScopeGrants) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有授权范围页面权限。" />
      </div>
    )
  }

  return (
    <div className="soha-page">
      <AdminTable
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        title="授权范围"
        headerExtra={
          <ManagementTableToolbar>
            {canCreateScopeGrants ? (
              <Tooltip title={canUseEditor ? undefined : '需要主体、角色及资源目录查看权限'}>
                <span>
                  <Button
                    disabled={!canUseEditor}
                    icon={<PlusOutlined />}
                    type="primary"
                    onClick={() => {
                      setEditing(null)
                      setModalVisible(true)
                    }}
                  >
                    新建授权项
                  </Button>
                </span>
              </Tooltip>
            ) : null}
            <ManagementRefreshButton
              aria-label="刷新"
              loading={grantsQuery.isFetching}
              tooltip="刷新"
              onClick={() => void grantsQuery.refetch()}
            />
          </ManagementTableToolbar>
        }
        columns={columns}
        dataSource={grantsQuery.data ?? []}
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
              description="当前主体仍按角色和访问策略生效。"
            />
          )
        }
        rowKey="id"
        loading={grantsQuery.isLoading}
        scroll={{ x: 'max-content' }}
      />
      <ScopeGrantEditor
        editing={editing}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditing(null)
        }}
        onSubmit={(payload) => {
          if (editing) {
            updateMutation.mutate({ id: editing.id, values: payload })
            return
          }
          createMutation.mutate(payload)
        }}
        pending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
}
