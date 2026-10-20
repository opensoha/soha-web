import { Button, Card, Empty, Typography } from 'antd'
import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { UseQueryResult } from '@tanstack/react-query'
import { localeText, useI18n } from '@/i18n'
import { StatusTag } from '@/components/status-tag'
import { formatMetricValue } from '@/components/resource-metrics-format'
import { formatDateTime } from '@/utils/time'
import { NodeStateTags } from '@/features/platform/shared/node-state-tags'
import { MonitoringHighlights } from './dashboard-highlights'
import { MonitoringSparkline } from './chart'
import { dashboardMetrics, monitoringSummary } from './dashboard-model'
import { monitoringViews, qualityLabels, qualityStatus } from './model'
import type { MonitoringNode, MonitoringView, MonitoringViewName } from './types'

export interface DashboardView {
  key: MonitoringViewName
  data?: MonitoringView
  query: Pick<UseQueryResult<MonitoringView>, 'isPending' | 'isError'>
}

interface DashboardProps {
  views: DashboardView[]
  names: string[]
  historical: boolean
  clusterId: string
  onFocus: (name: string) => void
}

export function MonitoringDashboard(props: DashboardProps) {
  const { localeCode } = useI18n()
  const nodes = props.views.find((view) => view.data)?.data?.nodes ?? []
  const selected = props.names.flatMap((name) => nodes.filter((node) => node.nodeRef.name === name))
  if (!selected.length) {
    return props.views.some((view) => view.data) ? (
      <Empty
        description={localeText(
          localeCode,
          '所选范围没有已加载节点',
          'No loaded nodes in this selection',
        )}
      />
    ) : props.views.some((view) => view.query.isPending) ? (
      <Card loading />
    ) : null
  }
  return (
    <section
      className="soha-monitoring-distribution"
      aria-label={localeText(localeCode, '节点资源监控', 'Node resource monitoring')}
    >
      <div className="soha-monitoring-distribution-heading">
        <h2>{localeText(localeCode, '节点资源监控', 'Node resource monitoring')}</h2>
        <Typography.Text className="soha-monitoring-supporting" type="secondary">
          {localeText(
            localeCode,
            '实际用量与容量 · 缺失点不连线',
            'Observed usage and capacity · Gaps are not connected',
          )}
        </Typography.Text>
      </div>
      {selected.length > 1 && <MonitoringResourceCard {...props} />}
      <div
        className="soha-monitoring-node-list"
        role="list"
        aria-label={localeText(localeCode, '节点监控列表', 'Node monitoring list')}
      >
        {selected.map((node) => (
          <div
            role="listitem"
            key={`${node.nodeRef.clusterId}:${node.nodeRef.name}:${node.nodeRef.uid || ''}`}
          >
            <MonitoringResourceCard {...props} names={[node.nodeRef.name]} node={node} />
          </div>
        ))}
      </div>
    </section>
  )
}

function MonitoringResourceCard({
  views,
  names,
  historical,
  clusterId,
  onFocus,
  node,
}: DashboardProps & { node?: MonitoringNode }) {
  const { localeCode, t } = useI18n()
  const location = useLocation()
  const title = node?.nodeRef.name || localeText(localeCode, '已选节点合计', 'Selected nodes total')
  const metrics = dashboardMetrics.filter((metric) =>
    views.some((view) => view.key === metric.view),
  )
  const detailsLink = (view: MonitoringViewName) => {
    const params = new URLSearchParams(location.search)
    if (node) params.set('node', node.nodeRef.name)
    return `${location.pathname}?${params}#monitoring-${view}`
  }
  return (
    <Card
      className={`soha-monitoring-resource-card${node ? ' soha-monitoring-node-card' : ' soha-monitoring-total-card'}`}
      style={{ '--soha-monitoring-metric-count': metrics.length } as CSSProperties}
      styles={{ body: { padding: 16 } }}
    >
      <div className="soha-monitoring-resource-row">
        <div className="soha-monitoring-node-heading">
          {node ? (
            <>
              <Link
                to={`/cluster-resources/nodes/${encodeURIComponent(node.nodeRef.name)}?clusterId=${encodeURIComponent(clusterId)}`}
              >
                {title}
              </Link>
              <NodeStateTags
                status={node.ready}
                cordoned={node.cordoned}
                conditions={[
                  { type: 'MemoryPressure', status: node.memoryPressure },
                  { type: 'DiskPressure', status: node.diskPressure },
                  { type: 'PIDPressure', status: node.pidPressure },
                ]}
              />
              <Button
                size="small"
                onClick={() => onFocus(node.nodeRef.name)}
                aria-label={`${localeText(localeCode, '聚焦节点', 'Focus node')} ${title}`}
              >
                {localeText(localeCode, '聚焦', 'Focus')}
              </Button>
            </>
          ) : (
            <>
              <Typography.Text strong>{title}</Typography.Text>
              <Typography.Text className="soha-monitoring-supporting" type="secondary">
                {localeText(
                  localeCode,
                  `已选 ${names.length} 节点`,
                  `${names.length} selected nodes`,
                )}
              </Typography.Text>
            </>
          )}
          <Typography.Text className="soha-monitoring-supporting" type="secondary">
            {historical
              ? localeText(localeCode, '历史窗口末值', 'End of historical window')
              : localeText(
                  localeCode,
                  '最近观测 · Pod 为当前快照',
                  'Latest observation · Pods are current',
                )}
          </Typography.Text>
        </div>
        {metrics.map((metric) => {
          const view = views.find((view) => view.key === metric.view)!
          const summary = view.data && monitoringSummary(view.data, metric, names, historical)
          const label = monitoringViews.find((item) => item.key === metric.view)![
            localeCode === 'zh_CN' ? 'label' : 'englishLabel'
          ]
          return (
            <div key={metric.view} className={`soha-monitoring-node-meter is-${metric.tone}`}>
              <div className="soha-monitoring-metric-heading">
                <Link
                  to={detailsLink(metric.view)}
                  aria-label={`${title} ${label} ${localeText(localeCode, '明细与采样', 'details and samples')}`}
                >
                  {label}
                </Link>
                <strong>{summary?.ratio == null ? '—' : `${summary.ratio.toFixed(1)}%`}</strong>
              </div>
              <div className="soha-monitoring-metric-value">
                {summary?.value == null ? '—' : formatMetricValue(summary.value, metric.unit)}
              </div>
              {summary?.points.some((point) => point.value != null) ? (
                <MonitoringSparkline
                  key={`${clusterId}:${location.search}:${names.join(',')}`}
                  points={summary.points}
                  animated={!historical}
                  label={`${title} ${label} ${localeText(localeCode, '趋势；缺失点不连线', 'trend; gaps are not connected')}`}
                  tone={metric.tone}
                  unit={metric.unit}
                />
              ) : (
                <div className="soha-monitoring-sparkline soha-monitoring-no-trend">
                  {view.query.isPending
                    ? localeText(localeCode, '读取中', 'Loading')
                    : localeText(localeCode, '历史样本不足', 'Historical samples unavailable')}
                </div>
              )}
              <Typography.Text
                className="soha-monitoring-supporting"
                type={summary?.ratio != null && summary.ratio > 100 ? 'danger' : 'secondary'}
              >
                {summary?.ratio != null && summary.ratio > 100
                  ? localeText(localeCode, '超出容量 · ', 'Over capacity · ')
                  : ''}
                {summary?.denominator == null
                  ? localeText(localeCode, '采样或分母不足', 'Samples or denominator unavailable')
                  : `${localeText(localeCode, metric.view === 'pods' ? '可分配' : '容量', metric.view === 'pods' ? 'Allocatable' : 'Capacity')} ${formatMetricValue(summary.denominator, metric.unit)}`}
              </Typography.Text>
              {summary && summary.quality !== 'valid' && (
                <span className="soha-monitoring-metric-quality">
                  <StatusTag
                    value={qualityStatus[summary.quality] || 'unknown'}
                    label={t(
                      `resourceMonitoring.quality.${summary.quality}`,
                      qualityLabels[summary.quality] || summary.quality,
                    )}
                  />
                </span>
              )}
              {view.query.isError && (
                <Typography.Text className="soha-monitoring-supporting" type="warning">
                  {localeText(
                    localeCode,
                    '刷新失败 · 上次结果',
                    'Refresh failed · Previous result',
                  )}
                </Typography.Text>
              )}
            </div>
          )
        })}
      </div>
      <details className="soha-monitoring-row-details">
        <summary aria-label={`${title} ${localeText(localeCode, '更多指标', 'more metrics')}`}>
          {localeText(localeCode, '更多指标', 'More metrics')}
        </summary>
        <div className="soha-monitoring-row-details-grid">
          {metrics.map((metric) => {
            const data = views.find((view) => view.key === metric.view)?.data
            const summary = data && monitoringSummary(data, metric, names, historical)
            const label = monitoringViews.find((item) => item.key === metric.view)![
              localeCode === 'zh_CN' ? 'label' : 'englishLabel'
            ]
            return (
              <div key={metric.view}>
                <h3>{label}</h3>
                {data && <MonitoringHighlights data={data} view={metric.view} names={names} />}
                <Typography.Text className="soha-monitoring-supporting" type="secondary">
                  {summary?.observedAt
                    ? formatDateTime(summary.observedAt)
                    : localeText(localeCode, '采样时间未确认', 'Sample time unverified')}
                </Typography.Text>
                <Link to={detailsLink(metric.view)}>
                  {localeText(localeCode, '明细与采样', 'Details and samples')}
                </Link>
              </div>
            )
          })}
        </div>
      </details>
    </Card>
  )
}
