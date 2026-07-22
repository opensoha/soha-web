import { useState } from 'react'
import { App, Button, Popconfirm, Space, Switch, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementDensityButton,
  ManagementIconButton,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import { systemIntegrationMutations } from './mutations'
import { systemIntegrationQueries } from './queries'
import type { SystemIntegration } from './types'
import './styles.css'

const { Text } = Typography

export function SourceConnectionsPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const permissionQuery = usePermissionSnapshot()
  const canView = hasPermission(permissionQuery.data?.data, 'settings.system-integrations.view')
  const canManage = hasPermission(permissionQuery.data?.data, 'settings.system-integrations.manage')
  const listQuery = useQuery(systemIntegrationQueries.list({ category: 'source_control' }, canView))
  const updateMutation = useMutation(systemIntegrationMutations.update(queryClient))
  const testMutation = useMutation(systemIntegrationMutations.test(queryClient))
  const deleteMutation = useMutation(systemIntegrationMutations.remove(queryClient))

  if (!permissionQuery.isLoading && !canView) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有查看代码源连接的权限。" />
      </div>
    )
  }

  const columns: TableColumnsType<SystemIntegration> = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (value, row) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{row.description || row.providerType}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'providerType',
      width: 120,
      render: (value: string) => <MetadataTag label={value === 'gitlab' ? 'GitLab' : value} />,
    },
    {
      title: '健康状态',
      dataIndex: 'healthStatus',
      width: 120,
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: '最近检查',
      dataIndex: 'lastCheckedAt',
      width: 180,
      render: (value?: string) => (value ? formatDateTime(value) : '-'),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (enabled: boolean, row) => (
        <Switch
          aria-label={`启用 ${row.name}`}
          checked={enabled}
          disabled={!canManage || updateMutation.isPending}
          loading={updateMutation.isPending}
          size="small"
          onChange={(checked) =>
            updateMutation.mutate({
              id: row.id,
              values: { expectedVersion: row.version, enabled: checked },
            })
          }
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 152,
      className: 'soha-table-actions-column',
      align: 'right',
      render: (_, row) => (
        <Space className="soha-row-action-icons" size={4}>
          <ManagementIconButton
            aria-label={`测试 ${row.name}`}
            disabled={!canManage || !row.enabled}
            icon={<ThunderboltOutlined />}
            loading={testMutation.isPending && testMutation.variables === row.id}
            tooltip="测试连接"
            onClick={() => testMutation.mutate(row.id)}
          />
          <ManagementIconButton
            aria-label={`编辑 ${row.name}`}
            icon={<EditOutlined />}
            tooltip="编辑"
            onClick={() => navigate(`/settings/source-control/${row.id}`)}
          />
          {canManage ? (
            <Popconfirm
              title={`删除代码源连接 ${row.name}？`}
              description="删除后使用此连接的代码源访问将不可用。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() =>
                deleteMutation.mutate(row.id, {
                  onSuccess: () => void message.success('代码源连接已删除'),
                })
              }
            >
              <ManagementIconButton
                aria-label={`删除 ${row.name}`}
                danger
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending && deleteMutation.variables === row.id}
                tooltip="删除"
              />
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <ManagementDataPage
      className="soha-system-integrations-page"
      table={{
        columns,
        dataSource: listQuery.data ?? [],
        empty: (
          <ManagementState
            bordered={false}
            compact
            title="暂无代码源连接"
            description="新增 GitLab 连接后，交付、虚拟化等工作台可通过统一代码源接口访问仓库文件。"
          />
        ),
        columnSettingIconOnly: true,
        toolbarExtra: (
          <ManagementTableToolbar>
            {canManage ? (
              <Button
                icon={<PlusOutlined />}
                size="small"
                type="primary"
                onClick={() => navigate('/settings/source-control/new')}
              >
                新增 GitLab
              </Button>
            ) : null}
            <ManagementDensityButton
              aria-label="切换表格密度"
              tooltip={tableSize === 'small' ? '切换为舒展密度' : '切换为紧凑密度'}
              onClick={() => setTableSize((current) => (current === 'small' ? 'middle' : 'small'))}
            />
            <ManagementRefreshButton
              aria-label="刷新代码源连接"
              loading={listQuery.isFetching}
              tooltip="刷新"
              onClick={() => void listQuery.refetch()}
            />
          </ManagementTableToolbar>
        ),
        loading: listQuery.isLoading,
        paginationSummary: (total, range) => (
          <Text type="secondary">
            当前 {range[0]}-{range[1]} / {total} 条
          </Text>
        ),
        rowKey: 'id',
        tableSize,
      }}
    />
  )
}
