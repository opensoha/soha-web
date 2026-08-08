import type {
  ObservabilityDashboardPanel,
  ObservabilityDashboardPanelQueryInput,
  ObservabilityMetricSeries,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { LineChart } from '@visactor/react-vchart'
import { useQuery } from '@tanstack/react-query'
import { Card, Flex, Select, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ManagementDataPage } from '@/components/management-data-page'
import { ManagementState } from '@/components/management-list'
import {
  buildCompactChartSpec,
  compactMetricColors,
  formatMetricValue,
  type CompactChartLine,
} from '@/components/resource-metrics-panel'
import { MetadataTag } from '@/components/status-tag'
import { observabilityDashboardQueries } from './queries'
import './styles.css'

const { Paragraph, Text } = Typography
const rangeOptions = [
  { label: '最近 15 分钟', value: 15 },
  { label: '最近 1 小时', value: 60 },
  { label: '最近 6 小时', value: 360 },
  { label: '最近 24 小时', value: 1440 },
]
const lineColors = [
  compactMetricColors.default,
  compactMetricColors.cpu,
  compactMetricColors.memory,
  compactMetricColors.diskRead,
  compactMetricColors.diskWrite,
]

export function ObservabilityDashboardDetailPage() {
  const dashboardId = decodeURIComponent(useParams<{ dashboardId: string }>().dashboardId ?? '')
  const [rangeMinutes, setRangeMinutes] = useState(60)
  const dashboardQuery = useQuery(observabilityDashboardQueries.detail(dashboardId))
  const dataSourcesQuery = useQuery(observabilityDashboardQueries.metricDataSources())
  const panelQuery = useMemo(() => panelQueryInput(rangeMinutes), [rangeMinutes])

  if (dashboardQuery.isLoading) {
    return <ManagementState kind="loading" title="正在加载仪表盘" />
  }
  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <ManagementState
        kind="error"
        title="仪表盘加载失败"
        description={dashboardQuery.error?.message}
      />
    )
  }
  const dashboard = dashboardQuery.data
  const dataSourceName = dataSourcesQuery.data?.find(
    (item) => item.id === dashboard.dataSourceId,
  )?.name
  return (
    <ManagementDataPage
      className="soha-dashboard-detail-page"
      header={{
        title: dashboard.name,
        meta: (
          <Flex gap={4} wrap>
            <MetadataTag label="Grafana" tone="orange" />
            <MetadataTag
              label={
                dataSourceName ?? (dashboard.dataSourceId ? '数据源不可用' : '未绑定数据源')
              }
              tone={dataSourceName ? 'blue' : 'orange'}
            />
            {dashboard.tags.slice(0, 5).map((tag) => (
              <MetadataTag key={tag} label={tag} />
            ))}
          </Flex>
        ),
        actions: (
          <Select
            aria-label="时间范围"
            options={rangeOptions}
            value={rangeMinutes}
            onChange={setRangeMinutes}
          />
        ),
      }}
      tableNode={
        <div className="soha-dashboard-grid">
          {dashboard.panels.map((panel) => (
            <DashboardPanel
              key={panel.id}
              dashboardId={dashboard.id}
              input={panelQuery}
              panel={panel}
            />
          ))}
        </div>
      }
    />
  )
}

function DashboardPanel({
  dashboardId,
  input,
  panel,
}: {
  dashboardId: string
  input: ObservabilityDashboardPanelQueryInput
  panel: ObservabilityDashboardPanel
}) {
  const style = {
    gridColumn: `${panel.layout.x + 1} / span ${panel.layout.w}`,
    gridRow: `${panel.layout.y + 1} / span ${panel.layout.h}`,
  }
  if (panel.type === 'row') {
    return (
      <div className="soha-dashboard-row" style={style}>
        {panel.title}
      </div>
    )
  }
  return (
    <Card className="soha-dashboard-panel" size="small" style={style} title={panel.title}>
      {panel.type === 'text' ? (
        <Paragraph className="soha-dashboard-text-panel">{panel.markdown || '-'}</Paragraph>
      ) : panel.queryable ? (
        <DashboardMetricPanel dashboardId={dashboardId} input={input} panel={panel} />
      ) : (
        <ManagementState bordered={false} compact description="没有可执行的 Prometheus 查询" />
      )}
    </Card>
  )
}

function DashboardMetricPanel({
  dashboardId,
  input,
  panel,
}: {
  dashboardId: string
  input: ObservabilityDashboardPanelQueryInput
  panel: ObservabilityDashboardPanel
}) {
  const panelQuery = useQuery(observabilityDashboardQueries.panel(dashboardId, panel.id, input))
  if (panelQuery.isLoading) {
    return <ManagementState bordered={false} compact kind="loading" title="正在查询" />
  }
  if (panelQuery.isError) {
    return (
      <ManagementState
        bordered={false}
        compact
        kind="error"
        title="查询失败"
        description={panelQuery.error.message}
      />
    )
  }
  const series = panelQuery.data?.series ?? []
  if (series.length === 0) {
    return <ManagementState bordered={false} compact description="当前范围暂无指标数据" />
  }
  if (panel.type === 'stat') {
    return (
      <Flex className="soha-dashboard-stat-values" gap={16} wrap>
        {series.map((item) => (
          <div key={item.key}>
            <Text type="secondary">{item.label}</Text>
            <div className="soha-dashboard-stat-value">
              {formatMetricValue(item.latest, item.unit ?? '')}
            </div>
          </div>
        ))}
      </Flex>
    )
  }
  const lines = metricLines(series)
  return (
    <div className="soha-dashboard-chart">
      <LineChart spec={buildCompactChartSpec(lines, series[0]?.unit ?? '', 'zh_CN')} />
    </div>
  )
}

function metricLines(series: ObservabilityMetricSeries[]): CompactChartLine[] {
  return series.map((item, index) => ({
    color: lineColors[index % lineColors.length],
    fill: series.length === 1,
    key: item.key,
    label: item.label,
    points: item.points,
    unit: item.unit ?? '',
  }))
}

function panelQueryInput(rangeMinutes: number): ObservabilityDashboardPanelQueryInput {
  const timeTo = new Date()
  return {
    timeFrom: new Date(timeTo.getTime() - rangeMinutes * 60_000).toISOString(),
    timeTo: timeTo.toISOString(),
    stepSeconds: rangeMinutes <= 60 ? 60 : 300,
  }
}
