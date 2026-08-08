import type { ObservabilityDashboard } from '@opensoha/contracts/gen/ts/sohaapi'
import { DeleteOutlined, EyeOutlined, ImportOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Flex, Popconfirm, Space } from 'antd'
import type { TableProps } from 'antd'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { MetadataTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { formatDateTime } from '@/utils/time'
import { ImportDashboardModal } from './import-modal'
import { observabilityDashboardMutations } from './mutations'
import { observabilityDashboardQueries } from './queries'
import './styles.css'

export function ObservabilityDashboardsPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionQuery = usePermissionSnapshot()
  const snapshot = permissionQuery.data?.data
  const canImport = hasPermission(snapshot, 'observe.dashboards.create')
  const canDelete = hasPermission(snapshot, 'observe.dashboards.delete')
  const [importOpen, setImportOpen] = useState(false)
  const dashboardsQuery = useQuery(observabilityDashboardQueries.list())
  const dataSourcesQuery = useQuery(observabilityDashboardQueries.metricDataSources())
  const dataSourceNames = useMemo(
    () => new Map((dataSourcesQuery.data ?? []).map((item) => [item.id, item.name])),
    [dataSourcesQuery.data],
  )
  const deleteMutation = useMutation({
    ...observabilityDashboardMutations.delete(queryClient),
    onError: (error) => message.error(error.message),
    onSuccess: () => message.success('仪表盘已删除'),
  })
  const columns: TableProps<ObservabilityDashboard>['columns'] = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (name: string, record) => (
        <Button
          type="link"
          onClick={() =>
            navigate(`/monitoring-workbench/dashboards/${encodeURIComponent(record.id)}`)
          }
        >
          {name}
        </Button>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 110,
      render: () => <MetadataTag label="Grafana" tone="orange" />,
    },
    {
      title: '数据源',
      dataIndex: 'dataSourceId',
      width: 180,
      render: (dataSourceId?: string) => {
        const name = dataSourceId ? dataSourceNames.get(dataSourceId) : undefined
        return (
          <MetadataTag
            label={name ?? (dataSourceId ? '数据源不可用' : '未绑定')}
            tone={name ? 'blue' : 'orange'}
          />
        )
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (tags: string[]) =>
        tags.length > 0 ? (
          <Flex gap={4} wrap>
            {tags.slice(0, 4).map((tag) => (
              <MetadataTag key={tag} label={tag} />
            ))}
            {tags.length > 4 ? <MetadataTag label={`+${tags.length - 4}`} /> : null}
          </Flex>
        ) : (
          '-'
        ),
    },
    {
      title: '面板',
      dataIndex: 'panels',
      width: 90,
      render: (panels: ObservabilityDashboard['panels']) => panels.length,
    },
    {
      ...tableColumnPresets.datetime,
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: formatDateTime,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      render: (_: unknown, record) => (
        <Space className="soha-row-action-icons" size={2}>
          <ManagementIconButton
            aria-label="打开仪表盘"
            icon={<EyeOutlined />}
            size="small"
            tooltip="打开"
            onClick={() =>
              navigate(`/monitoring-workbench/dashboards/${encodeURIComponent(record.id)}`)
            }
          />
          {canDelete ? (
            <Popconfirm
              title="删除仪表盘"
              description={record.name}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <ManagementIconButton
                aria-label="删除仪表盘"
                danger
                icon={<DeleteOutlined />}
                size="small"
                tooltip="删除"
              />
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <>
      <ManagementDataPage
        table={{
          title: '仪表盘',
          headerExtra: canImport ? (
            <ManagementTableToolbar>
              <Button icon={<ImportOutlined />} type="primary" onClick={() => setImportOpen(true)}>
                导入
              </Button>
            </ManagementTableToolbar>
          ) : undefined,
          columns,
          dataSource: dashboardsQuery.data ?? [],
          empty: <ManagementState bordered={false} compact description="暂无仪表盘" />,
          loading: dashboardsQuery.isLoading,
          pageSize: 20,
          rowKey: 'id',
          scroll: { x: 'max-content' },
        }}
      />
      <ImportDashboardModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(result) =>
          navigate(`/monitoring-workbench/dashboards/${encodeURIComponent(result.dashboard.id)}`)
        }
      />
    </>
  )
}
