import { ArrowLeftOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Segmented, Space, Typography } from 'antd'
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { PlatformScopeToolbar } from '@/components/platform-scope-toolbar'
import { DashboardMetricSeries } from '../dashboards/detail-page'
import {
  dashboardPanelQueryInput,
  dashboardURLVariables,
  readDashboardPlayback,
} from '../dashboards/model'
import { observabilityDashboardQueries } from '../dashboards/queries'
import { LogExplorer } from '../logs/log-explorer'
import { readLogExplorerPreset } from '../logs/model'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { signalSearchParams } from './model'
import { ObservabilityMetricsPage } from './metrics-page'
import { ObservabilityTracesPage } from './traces-page'

type ExploreSignal = 'logs' | 'metrics' | 'traces'

export function ObservabilityExplorePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { clusterId, namespace } = usePlatformScopeStore()
  const signal = (
    ['logs', 'metrics', 'traces'].includes(searchParams.get('signal') ?? '')
      ? searchParams.get('signal')
      : 'metrics'
  ) as ExploreSignal
  const preset = useMemo(() => readLogExplorerPreset(searchParams), [searchParams])

  return (
    <div className="soha-page soha-signal-page">
      <Segmented<ExploreSignal>
        aria-label="信号类型"
        className="soha-explore-switcher"
        options={[
          { label: '指标', value: 'metrics' },
          { label: '链路', value: 'traces' },
          { label: '日志', value: 'logs' },
        ]}
        value={signal}
        onChange={(value) =>
          setSearchParams(signalSearchParams(searchParams, { signal: value }), { replace: true })
        }
      />
      {signal === 'metrics' ? (
        searchParams.get('dashboardId') && searchParams.get('panelId') ? (
          <DashboardPanelExplore
            dashboardId={searchParams.get('dashboardId')!}
            panelId={searchParams.get('panelId')!}
            searchParams={searchParams}
            onBack={(dashboardId) =>
              navigate(
                `/monitoring-workbench/dashboards/${encodeURIComponent(dashboardId)}?${searchParams.toString()}`,
              )
            }
          />
        ) : (
          <ObservabilityMetricsPage embedded />
        )
      ) : null}
      {signal === 'traces' ? <ObservabilityTracesPage embedded /> : null}
      {signal === 'logs' ? (
        <LogExplorer
          clusterId={preset.clusterId ?? clusterId}
          namespace={preset.namespace ?? namespace}
          preset={preset}
          scopeControl={
            <PlatformScopeToolbar
              clusterWidth={180}
              embedded
              namespaceWidth={180}
              showLabel={false}
            />
          }
          syncURL
        />
      ) : null}
    </div>
  )
}

function DashboardPanelExplore({
  dashboardId,
  onBack,
  panelId,
  searchParams,
}: {
  dashboardId: string
  onBack: (dashboardId: string) => void
  panelId: string
  searchParams: URLSearchParams
}) {
  const playback = readDashboardPlayback(searchParams)
  const input = dashboardPanelQueryInput(
    playback,
    dashboardURLVariables(searchParams),
    Number(searchParams.get('stepSeconds')),
  )
  const dashboard = useQuery(observabilityDashboardQueries.detail(dashboardId))
  const result = useQuery(observabilityDashboardQueries.panel(dashboardId, panelId, input))
  const panel = dashboard.data?.panels.find((item) => item.id === panelId)

  if (dashboard.isLoading || result.isLoading) {
    return <ManagementState kind="loading" title="正在查询 Dashboard 面板" />
  }
  if (dashboard.isError || result.isError || !panel) {
    return (
      <ManagementState
        kind="error"
        title="Dashboard 面板查询失败"
        description={dashboard.error?.message ?? result.error?.message ?? '面板不存在'}
      />
    )
  }
  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => onBack(dashboardId)}>
        返回 Dashboard
      </Button>
      <Card
        size="small"
        title={`${dashboard.data?.name ?? dashboardId} / ${panel.title}`}
        extra={
          <Typography.Text type="secondary">
            {new Date(playback.from).toLocaleString()} - {new Date(playback.to).toLocaleString()}
          </Typography.Text>
        }
      >
        {(result.data?.series ?? []).length > 0 ? (
          <DashboardMetricSeries panelType={panel.type} series={result.data?.series ?? []} />
        ) : (
          <ManagementState bordered={false} compact description="当前范围暂无指标数据" />
        )}
      </Card>
    </Space>
  )
}
