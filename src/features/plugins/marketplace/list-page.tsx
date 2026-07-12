import { useMemo, useState } from 'react'
import { CloudDownloadOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import { Button, Input, Select, Space, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { usePermissionSnapshot } from '@/features/auth'
import type { MarketplacePlugin, PluginMarketplaceFilters } from '../plugin-model'
import {
  manifestAssetCount,
  manifestCapabilityCount,
  manifestExtensionCount,
  pluginTypeOptions,
  requestedPermissionValues,
} from '../plugin-model'
import { pluginQueries } from '../queries'
import { compactPluginTags, pluginRiskTag } from '../shared/formatters'
import { PluginNameCell } from '../shared/plugin-name-cell'
import { PluginPageShell } from '../shared/page-shell'
import { canInstallPlugin } from '../shared/permissions'
import { marketplaceDetailPath, useInstallPluginAction } from './install-action'

const { Text } = Typography

const initialFilters: Required<PluginMarketplaceFilters> = {
  query: '',
  type: '',
  publisher: '',
  sourceId: '',
  marketplaceUrl: '',
  version: '',
}

export function PluginMarketplacePage() {
  const [filters, setFilters] = useState(initialFilters)
  const navigate = useNavigate()
  const snapshot = usePermissionSnapshot().data?.data
  const installAction = useInstallPluginAction()
  const marketplaceQuery = useQuery(pluginQueries.marketplace(filters))

  const columns = useMemo<TableColumnsType<MarketplacePlugin>>(
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
            description={record.summary || record.manifest.description}
          />
        ),
      },
      {
        title: '来源',
        width: 170,
        render: (_, record) => (
          <Space orientation="vertical" size={2}>
            <Space size={4} wrap>
              <Tag>{record.sourceId || 'static'}</Tag>
              {record.verified ? <Tag color="green">verified</Tag> : null}
            </Space>
            <Text type="secondary">{record.latestVersion || record.version}</Text>
          </Space>
        ),
      },
      {
        title: '能力',
        width: 190,
        render: (_, record) => (
          <Space orientation="vertical" size={2}>
            <Text>{manifestAssetCount(record.manifest)} assets</Text>
            <Text type="secondary">{manifestCapabilityCount(record.manifest)} capabilities</Text>
            <Text type="secondary">{manifestExtensionCount(record.manifest)} extensions</Text>
          </Space>
        ),
      },
      {
        title: '权限声明',
        width: 260,
        render: (_, record) =>
          compactPluginTags(requestedPermissionValues(record.manifest.permissions), 3),
      },
      { title: '风险', dataIndex: 'riskLevel', width: 100, render: pluginRiskTag },
      {
        title: '状态',
        dataIndex: 'installed',
        width: 100,
        render: (installed) => (installed ? <Tag color="green">已安装</Tag> : <Tag>未安装</Tag>),
      },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 150,
        render: (_, record) => (
          <Space size={4}>
            <ManagementIconButton
              icon={<EyeOutlined />}
              tooltip="查看详情"
              onClick={() => navigate(marketplaceDetailPath(record))}
            />
            <Button
              disabled={record.installed || !canInstallPlugin(snapshot)}
              icon={<CloudDownloadOutlined />}
              loading={installAction.loading}
              size="small"
              onClick={() => installAction.confirmInstall(record)}
            >
              安装
            </Button>
          </Space>
        ),
      },
    ],
    [installAction, navigate, snapshot],
  )

  return (
    <PluginPageShell
      activeKey="marketplace"
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => marketplaceQuery.refetch()}>
          刷新
        </Button>
      }
    >
      <AdminTable
        rowKey={(record) => `${record.sourceId || 'static'}:${record.id}:${record.version}`}
        columns={columns}
        dataSource={marketplaceQuery.data ?? []}
        loading={marketplaceQuery.isLoading || marketplaceQuery.isFetching}
        title="插件市场"
        toolbar={
          <ManagementTableToolbar>
            <ManagementToolbarSearch
              placeholder="搜索 ID、名称、发布者"
              value={filters.query}
              onChange={(value) => setFilters((current) => ({ ...current, query: value }))}
            />
            <Select
              allowClear
              placeholder="类型"
              style={{ width: 180 }}
              options={[...pluginTypeOptions]}
              value={filters.type || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, type: value ?? '' }))}
            />
            <Input
              allowClear
              placeholder="Publisher"
              style={{ width: 180 }}
              value={filters.publisher}
              onChange={(event) =>
                setFilters((current) => ({ ...current, publisher: event.target.value }))
              }
            />
            <Input
              allowClear
              placeholder="Source ID"
              style={{ width: 160 }}
              value={filters.sourceId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, sourceId: event.target.value }))
              }
            />
            <Input
              allowClear
              placeholder="Marketplace URL"
              style={{ width: 260 }}
              value={filters.marketplaceUrl}
              onChange={(event) =>
                setFilters((current) => ({ ...current, marketplaceUrl: event.target.value }))
              }
            />
            <Input
              allowClear
              placeholder="Version"
              style={{ width: 140 }}
              value={filters.version}
              onChange={(event) =>
                setFilters((current) => ({ ...current, version: event.target.value }))
              }
            />
          </ManagementTableToolbar>
        }
        empty={
          <ManagementState kind="empty" title="没有匹配插件" description="调整筛选条件后重试。" />
        }
      />
    </PluginPageShell>
  )
}
