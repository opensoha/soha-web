import type { ObservabilityProviderDefinition } from '@opensoha/contracts/gen/ts/sohaapi'
import type { ReactNode } from 'react'
import {
  AlertOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  LineChartOutlined,
  ShareAltOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import { Button, Flex, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementState, ManagementTableToolbar } from '@/components/management-list'
import { OverviewMetricCard, type OverviewMetricItem } from '@/components/overview-visuals'
import '../observability-pages.css'
import { observabilityProviderQueries } from '../provider-queries'

type SignalKey = 'logs' | 'metrics' | 'traces'

const signalMeta: Array<{ key: SignalKey; label: string; icon: ReactNode }> = [
  { key: 'logs', label: 'Logs', icon: <FileSearchOutlined /> },
  { key: 'metrics', label: 'Metrics', icon: <LineChartOutlined /> },
  { key: 'traces', label: 'Traces', icon: <ShareAltOutlined /> },
]

interface SignalRow {
  key: SignalKey
  label: string
  providers: string[]
  capabilities: string[]
}

export function buildSignalRows(providers: ObservabilityProviderDefinition[]): SignalRow[] {
  return signalMeta.map((signal) => {
    const matched = providers.filter((provider) => provider.signals.includes(signal.key))
    return {
      key: signal.key,
      label: signal.label,
      providers: matched.map((provider) => provider.displayName),
      capabilities: [...new Set(matched.flatMap((provider) => provider.capabilities))],
    }
  })
}

export function ObservabilityWorkbenchPage() {
  const navigate = useNavigate()
  const providersQuery = useQuery(observabilityProviderQueries.providers())
  const rows = buildSignalRows(providersQuery.data ?? [])
  const metrics = signalMeta.map((signal, index) => ({
    key: signal.key,
    label: signal.label,
    value: rows[index].providers.length,
    helper: '已注册 Provider',
    icon: signal.icon,
    tone: 'default',
  })) satisfies OverviewMetricItem[]
  const columns: TableColumnsType<SignalRow> = [
    { title: '信号', dataIndex: 'label', key: 'label', width: 140 },
    {
      title: 'Provider',
      dataIndex: 'providers',
      key: 'providers',
      render: (providers: string[]) =>
        providers.length > 0 ? (
          <Flex gap={4} wrap>
            {providers.map((provider) => (
              <Tag key={provider}>{provider}</Tag>
            ))}
          </Flex>
        ) : (
          <Tag>未接入</Tag>
        ),
    },
    {
      title: '能力',
      dataIndex: 'capabilities',
      key: 'capabilities',
      render: (capabilities: string[]) => capabilities.join(' / ') || '-',
    },
  ]

  return (
    <div className="soha-page soha-overview-page soha-monitoring-overview-page">
      <div className="soha-overview-metric-grid">
        {metrics.map(({ key, ...item }) => (
          <OverviewMetricCard key={key} {...item} loading={providersQuery.isLoading} />
        ))}
      </div>

      {providersQuery.isError ? (
        <ManagementState
          kind="error"
          title="可观测能力加载失败"
          description={providersQuery.error.message}
        />
      ) : (
        <AdminTable
          title="信号能力"
          headerExtra={
            <ManagementTableToolbar>
              <Button onClick={() => navigate('/monitoring-workbench/services')}>服务</Button>
              <Button
                icon={<LineChartOutlined />}
                onClick={() => navigate('/monitoring-workbench/metrics')}
              >
                指标
              </Button>
              <Button
                icon={<ShareAltOutlined />}
                onClick={() => navigate('/monitoring-workbench/traces')}
              >
                链路
              </Button>
              <Button
                icon={<FileSearchOutlined />}
                onClick={() => navigate('/monitoring-workbench/logs')}
              >
                查询日志
              </Button>
              <Button
                icon={<DatabaseOutlined />}
                onClick={() => navigate('/monitoring-workbench/providers')}
              >
                Provider
              </Button>
              <Button
                icon={<AlertOutlined />}
                onClick={() => navigate('/monitoring-workbench/alerting')}
              >
                告警响应
              </Button>
            </ManagementTableToolbar>
          }
          columnSettingPlacement="hidden"
          columns={columns}
          dataSource={rows}
          empty={<ManagementState bordered={false} compact description="暂无信号能力" />}
          loading={providersQuery.isLoading}
          pagination={false}
          rowKey="key"
          shellClassName="soha-management-table-shell"
          tableSize="small"
        />
      )}
    </div>
  )
}
