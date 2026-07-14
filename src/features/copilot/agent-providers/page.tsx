import { useNavigate } from 'react-router-dom'
import { AppstoreAddOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Space, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { ManagementDataPage } from '@/components/management-data-page'
import { ManagementState, ManagementTableToolbar } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { workbenchQueries } from '../workbench/queries'
import type { WorkbenchAgentProvider } from '../workbench/types'

export function AgentProvidersPage() {
  const navigate = useNavigate()
  const catalogQuery = useQuery(workbenchQueries.catalog())
  const providers = catalogQuery.data?.data.agentProviders ?? []

  const columns: TableColumnsType<WorkbenchAgentProvider> = [
    { title: 'Provider', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'kind', key: 'kind', width: 150 },
    {
      title: '状态',
      key: 'status',
      width: 140,
      render: (_, record) => (
        <StatusTag
          value={record.runtimeStatus?.state || (record.enabled ? 'enabled' : 'disabled')}
        />
      ),
    },
    {
      title: '能力',
      dataIndex: 'capabilities',
      key: 'capabilities',
      render: (values: string[] | undefined) =>
        values?.length ? (
          <Space size={4} wrap>
            {values.map((value) => (
              <Tag key={value}>{value}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '运行',
      key: 'runs',
      width: 150,
      render: (_, record) =>
        `${record.runtimeStatus?.runningRuns ?? 0} 运行 / ${record.runtimeStatus?.queuedRuns ?? 0} 排队`,
    },
  ]

  return (
    <ManagementDataPage
      header={{
        title: 'Agent Providers',
        description:
          '展示运行时当前可用的 Provider 投影。插件已安装不代表所有 Agent 节点已经激活。',
        actions: (
          <ManagementTableToolbar>
            <Button
              icon={<ReloadOutlined />}
              loading={catalogQuery.isFetching}
              onClick={() => void catalogQuery.refetch()}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<AppstoreAddOutlined />}
              onClick={() => navigate('/plugins/marketplace')}
            >
              从插件市场安装
            </Button>
          </ManagementTableToolbar>
        ),
      }}
      table={{
        columns,
        dataSource: providers,
        loading: catalogQuery.isLoading,
        rowKey: 'id',
        empty: catalogQuery.isError ? (
          <ManagementState kind="error" title="Provider Catalog 加载失败" />
        ) : (
          <ManagementState
            title="暂无 Agent Provider"
            description="从插件市场安装并启用 Provider 后，待运行时完成同步会显示在这里。"
          />
        ),
      }}
    />
  )
}
