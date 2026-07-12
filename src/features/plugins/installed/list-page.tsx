import { useMemo } from 'react'
import {
  DeleteOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import { Button, Space, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementIconButton, ManagementState } from '@/components/management-list'
import { usePermissionSnapshot } from '@/features/auth'
import type { InstalledPlugin } from '../plugin-model'
import { requestedPermissionValues } from '../plugin-model'
import { pluginQueries } from '../queries'
import { compactPluginTags, formatPluginDateTime, pluginStatusBadge } from '../shared/formatters'
import { PluginNameCell } from '../shared/plugin-name-cell'
import { PluginPageShell } from '../shared/page-shell'
import { canManagePlugins } from '../shared/permissions'
import { useInstalledPluginActions } from './actions'

const { Text } = Typography

export function InstalledPluginsPage() {
  const navigate = useNavigate()
  const snapshot = usePermissionSnapshot().data?.data
  const actions = useInstalledPluginActions()
  const installedQuery = useQuery(pluginQueries.installed())

  const columns = useMemo<TableColumnsType<InstalledPlugin>>(
    () => [
      {
        title: '插件',
        dataIndex: 'name',
        width: 360,
        render: (_, record) => (
          <PluginNameCell
            id={record.id}
            name={record.name}
            publisher={record.publisher}
            type={record.type}
            version={record.version}
            description={record.manifest.description}
          />
        ),
      },
      { title: '状态', dataIndex: 'status', width: 120, render: pluginStatusBadge },
      {
        title: '完整性',
        width: 170,
        render: (_, record) => (
          <Space orientation="vertical" size={2}>
            <Tag color={record.checksumStatus === 'verified' ? 'green' : 'default'}>
              {record.checksumStatus}
            </Tag>
            <Text type="secondary">{record.signatureStatus || '-'}</Text>
          </Space>
        ),
      },
      {
        title: '权限声明',
        width: 260,
        render: (_, record) =>
          compactPluginTags(requestedPermissionValues(record.requestedPermissions), 3),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        width: 140,
        render: formatPluginDateTime,
      },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 190,
        render: (_, record) => (
          <Space size={4}>
            <ManagementIconButton
              icon={<EyeOutlined />}
              tooltip="查看详情"
              onClick={() => navigate(`/plugins/installed/${encodeURIComponent(record.id)}`)}
            />
            {record.status === 'enabled' ? (
              <ManagementIconButton
                disabled={!canManagePlugins(snapshot)}
                icon={<PauseCircleOutlined />}
                loading={actions.loading}
                tooltip="停用"
                onClick={() => actions.disable(record.id)}
              />
            ) : (
              <ManagementIconButton
                disabled={!canManagePlugins(snapshot)}
                icon={<PlayCircleOutlined />}
                loading={actions.loading}
                tooltip="启用"
                onClick={() => actions.enable(record.id)}
              />
            )}
            <ManagementIconButton
              disabled={!canManagePlugins(snapshot)}
              icon={<ReloadOutlined />}
              loading={actions.loading}
              tooltip="从市场升级"
              onClick={() => actions.upgrade(record.id)}
            />
            <ManagementIconButton
              disabled={!canManagePlugins(snapshot)}
              icon={<DeleteOutlined />}
              loading={actions.loading}
              tooltip="移除"
              onClick={() => actions.confirmRemove(record)}
            />
          </Space>
        ),
      },
    ],
    [actions, navigate, snapshot],
  )

  return (
    <PluginPageShell
      activeKey="installed"
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => installedQuery.refetch()}>
          刷新
        </Button>
      }
    >
      <AdminTable
        rowKey="id"
        columns={columns}
        dataSource={installedQuery.data ?? []}
        loading={installedQuery.isLoading || installedQuery.isFetching}
        title="已安装插件"
        empty={
          <ManagementState
            kind="empty"
            title="尚未安装插件"
            description="从插件市场安装后会在这里显示 manifest 快照和运行状态。"
          />
        }
      />
    </PluginPageShell>
  )
}
