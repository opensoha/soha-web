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
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { accessMutations, invalidateAccessScopeGrants } from './mutations'
import { accessQueries } from './queries'
import { ScopeGrantEditor } from './scope-grant-editor'
import type { AccessScopeGrant } from './types'

type ColumnProps<T> = TableColumnsType<T>[number]

interface ScopeGrantManagerProps {
  fixedApplication?: { businessLineId: string; id: string; name?: string }
  inline?: boolean
  subjectType?: 'user' | 'team'
  subjectId?: string | null
  visible: boolean
  title: string
  onClose?: () => void
}

export function ScopeGrantManager({
  fixedApplication,
  inline = false,
  subjectType = 'user',
  subjectId = null,
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
  const canViewUsers = hasPermission(snapshot, 'access.users.view')
  const canViewTeams = hasPermission(snapshot, 'access.groups.view')
  const canViewRoles = hasPermission(snapshot, 'access.roles.view')
  const canViewApplications = hasPermission(snapshot, 'delivery.applications.view')
  const canViewApplicationEnvironments = hasPermission(
    snapshot,
    'delivery.application-environments.view',
  )
  const canViewClusters = hasPermission(snapshot, 'platform.clusters.view')
  const listsApplicationGrants = inline && Boolean(fixedApplication)
  const canUseEditor =
    (listsApplicationGrants ? canViewUsers || canViewTeams : Boolean(subjectId)) &&
    canViewRoles &&
    ((canViewApplications && canViewApplicationEnvironments) || canViewClusters)
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<AccessScopeGrant | null>(null)
  const [grantModalVisible, setGrantModalVisible] = useState(false)
  const subject = { subjectId: subjectId ?? '', subjectType }
  const applicationGrantsQuery = useQuery(
    accessQueries.scopeGrantsAll(visible && listsApplicationGrants),
  )
  const subjectGrantsQuery = useQuery(
    accessQueries.scopeGrants(
      subject,
      visible && !listsApplicationGrants && Boolean(subjectId),
    ),
  )
  const grantsQuery = listsApplicationGrants ? applicationGrantsQuery : subjectGrantsQuery
  const usersQuery = useQuery(
    accessQueries.users(visible && listsApplicationGrants && canViewUsers),
  )
  const teamsQuery = useQuery(
    accessQueries.teams(visible && listsApplicationGrants && canViewTeams),
  )
  const applicationsQuery = useQuery(
    accessQueries.applicationOptions(visible && canViewApplications),
  )
  const applicationEnvironmentsQuery = useQuery(
    accessQueries.applicationEnvironments(
      visible && listsApplicationGrants && canViewApplicationEnvironments,
    ),
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
  const subjectMap = useMemo(
    () =>
      Object.fromEntries([
        ...(usersQuery.data ?? []).map((item) => [
          `user:${item.id}`,
          item.displayName || item.username,
        ]),
        ...(teamsQuery.data ?? []).map((item) => [`team:${item.id}`, item.name]),
      ]),
    [teamsQuery.data, usersQuery.data],
  )
  const environmentMap = useMemo(
    () =>
      Object.fromEntries(
        (applicationEnvironmentsQuery.data ?? []).map((item) => [
          item.environmentId,
          item.environmentKey || item.environmentId,
        ]),
      ),
    [applicationEnvironmentsQuery.data],
  )
  const grants = useMemo(
    () =>
      fixedApplication
        ? (grantsQuery.data ?? []).filter(
            (grant) =>
              grant.scopeType === 'delivery' && grant.applicationIds?.includes(fixedApplication.id),
          )
        : (grantsQuery.data ?? []),
    [fixedApplication, grantsQuery.data],
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
    const targetSubject = editing
      ? { subjectId: editing.subjectId, subjectType: editing.subjectType }
      : listsApplicationGrants
        ? {
            subjectId: String(payload.subjectId ?? ''),
            subjectType: payload.subjectType as 'team' | 'user',
          }
        : subject
    if (!targetSubject.subjectId) return
    if (editing) {
      updateMutation.mutate({ ...targetSubject, id: editing.id, values: payload })
      return
    }
    createMutation.mutate({ ...targetSubject, values: payload })
  }

  const actionColumn: ColumnProps<AccessScopeGrant> = {
    ...tableColumnPresets.action,
    title: '操作',
    dataIndex: 'id',
    render: (_: unknown, record: AccessScopeGrant) => {
      const targetSubject = listsApplicationGrants
        ? { subjectId: record.subjectId, subjectType: record.subjectType }
        : subject
      return (
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
                <Popconfirm
                  title="确认删除？"
                  onConfirm={() => deleteMutation.mutate({ ...targetSubject, id: record.id })}
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
      )
    },
  }
  const columns: ColumnProps<AccessScopeGrant>[] = [
    ...(listsApplicationGrants
      ? [
          {
            title: '授权主体',
            key: 'subject',
            render: (_: unknown, record: AccessScopeGrant) => (
              <Space wrap size={6}>
                <Tooltip title={record.subjectId}>
                  <span>
                    {subjectMap[`${record.subjectType}:${record.subjectId}`] || record.subjectId}
                  </span>
                </Tooltip>
                <MetadataTag
                  label={record.subjectType === 'team' ? '组织' : '用户'}
                  tone={record.subjectType === 'team' ? 'purple' : 'blue'}
                />
              </Space>
            ),
          },
          {
            title: '环境范围',
            dataIndex: 'environmentIds',
            render: (values: string[] | undefined) =>
              values?.length ? (
                <Space wrap size={[0, 4]}>
                  {values.map((item) => (
                    <MetadataTag key={item} label={environmentMap[item] || item} />
                  ))}
                </Space>
              ) : (
                <MetadataTag label="应用默认" tone="blue" />
              ),
          },
        ]
      : [
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
                    <Tag key={item}>{clusterMap[item] || item}</Tag>
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
        ]),
    { title: '角色', dataIndex: 'role' },
    {
      title: '效果',
      dataIndex: 'effect',
      render: (value: AccessScopeGrant['effect']) => (
        <StatusTag value={value} label={value === 'deny' ? '拒绝' : '允许'} />
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      render: (value: boolean) => <StatusTag value={value ? 'enabled' : 'disabled'} />,
    },
    actionColumn,
  ]

  const table = (
    <AdminTable
      columnSettingIconOnly
      columnSettingPlacement="header"
      shellClassName="soha-management-table-shell"
      title={inline ? title : '授权项'}
      headerExtra={
        canCreateScopeGrants ? (
          <ManagementTableToolbar>
            <Tooltip title={canUseEditor ? undefined : '需要主体、角色及应用环境目录查看权限'}>
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
                  {inline ? '新增授权' : '新建授权项'}
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
            title={inline ? '暂无额外授权' : '未设置额外范围'}
            description="未设置时仅使用角色与访问策略。"
          />
        )
      }
      rowKey="id"
      loading={grantsQuery.isLoading}
      localSorting
      scroll={{ x: 'max-content' }}
    />
  )

  return (
    <>
      {inline ? (
        table
      ) : (
        <Modal title={title} open={visible} onCancel={onClose} footer={null} width={880}>
          <div className="soha-page">{table}</div>
        </Modal>
      )}
      <ScopeGrantEditor
        editing={editing}
        fixedApplication={fixedApplication}
        open={grantModalVisible}
        fixedSubject={
          editing
            ? { id: editing.subjectId, type: editing.subjectType }
            : !listsApplicationGrants && subjectId
              ? { id: subjectId, type: subjectType }
              : undefined
        }
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
