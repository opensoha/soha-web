import { useMemo, useState } from 'react'
import { Button, Popconfirm, Select, Tag, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementTableToolbar,
  useManagementTextFilter,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime, formatRelativeTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { systemMutations } from '../mutations'
import { systemQueries } from '../queries'
import type { OnlineUser } from '../system-model'

function SourceTag({ value }: { value?: string }) {
  const normalized = (value || '').toLowerCase()
  if (!normalized) return <>-</>
  if (normalized === 'console') return <Tag color="blue">Console</Tag>
  if (normalized === 'oidc') return <Tag color="green">OIDC</Tag>
  if (normalized === 'api') return <Tag color="orange">API</Tag>
  return <Tag>{value}</Tag>
}

export function OnlineUsersPage() {
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [providerFilter, setProviderFilter] = useState<string>('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const canManageOnlineUsers = hasPermission(
    permissionSnapshotQuery.data?.data,
    'system.online-users.manage',
  )

  const { data: sessions = [], isLoading } = useQuery(systemQueries.sessions())
  const revokeMutation = useMutation(systemMutations.sessions.revoke(queryClient))
  const batchRevokeMutation = useMutation(systemMutations.sessions.revokeMany(queryClient))
  const providerOptions = useMemo(
    () =>
      Array.from(new Set(sessions.map((item: OnlineUser) => item.providerType).filter(Boolean)))
        .sort()
        .map((value) => ({
          value,
          label: value,
        })),
    [sessions],
  )
  const keywordFilteredSessions = useManagementTextFilter(
    sessions,
    searchKeyword,
    (item: OnlineUser) => [
      item.userId,
      item.userName,
      item.email,
      item.providerType,
      item.source,
      item.sourceIp,
      item.userAgent,
    ],
  )
  const filteredSessions = useMemo(() => {
    return keywordFilteredSessions.filter(
      (item: OnlineUser) => !providerFilter || item.providerType === providerFilter,
    )
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
    {
      title: '来源',
      dataIndex: 'source',
      width: 100,
      render: (value: string) => <SourceTag value={value} />,
    },
    {
      title: 'IP',
      dataIndex: 'sourceIp',
      width: 140,
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '设备',
      dataIndex: 'userAgent',
      width: 280,
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      ...tableColumnPresets.datetime,
      title: '登录时间',
      dataIndex: 'loginTime',
      render: (_: string, record: OnlineUser) => formatDateTime(record.loginTime),
    },
    {
      ...tableColumnPresets.datetime,
      title: '最近活跃',
      dataIndex: 'lastSeenAt',
      render: (_: string, record: OnlineUser) => formatDateTime(record.lastSeenAt),
    },
    {
      title: '活跃时长',
      dataIndex: 'lastSeenAt',
      width: 120,
      render: (_: string, record: OnlineUser) => formatRelativeTime(record.lastSeenAt),
    },
    {
      ...tableColumnPresets.datetime,
      title: '过期时间',
      dataIndex: 'expiry',
      render: (_: string, record: OnlineUser) => formatDateTime(record.expiry),
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      width: 88,
      dataIndex: 'id',
      render: (_: string, record: OnlineUser) =>
        canManageOnlineUsers ? (
          <Popconfirm
            title="确认下线该用户会话？"
            onConfirm={() =>
              revokeMutation.mutate(record.id, {
                onSuccess: () => {
                  void message.success('用户会话已下线')
                  setSelectedSessionIds((current) => current.filter((id) => id !== record.id))
                },
                onError: (error) => void message.error(error.message),
              })
            }
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label="下线用户"
              loading={revokeMutation.isPending}
            />
          </Popconfirm>
        ) : (
          '-'
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
              onClick={() =>
                batchRevokeMutation.mutate(
                  selectedSessions.map((item: OnlineUser) => item.id),
                  {
                    onSuccess: (results) => {
                      const successCount = results.filter(
                        (item) => item.status === 'fulfilled',
                      ).length
                      const failureCount = results.length - successCount
                      void message.success(
                        failureCount > 0
                          ? `批量下线完成，成功 ${successCount}，失败 ${failureCount}`
                          : `已批量下线 ${successCount} 个会话`,
                      )
                      setSelectedSessionIds([])
                    },
                    onError: (error) => void message.error(error.message),
                  },
                )
              }
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
        rowSelection: canManageOnlineUsers
          ? {
              selectedRowKeys: selectedSessionIds,
              onChange: (selectedRowKeys: React.Key[]) =>
                setSelectedSessionIds(selectedRowKeys.map(String)),
            }
          : undefined,
      }}
    />
  )
}
