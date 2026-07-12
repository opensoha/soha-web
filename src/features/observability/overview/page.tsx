import {
  AlertOutlined,
  BellOutlined,
  EyeOutlined,
  FireOutlined,
  LinkOutlined,
  NotificationOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  OverviewChip,
  OverviewMetricCard,
  OverviewSectionBar,
  type OverviewChipItem,
  type OverviewMetricItem,
} from '@/components/overview-visuals'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementState,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { formatDateTime } from '@/utils/time'
import { observabilityAlertQueries } from '../alerts/queries'
import { observabilityHealingQueries } from '../healing/queries'
import { observabilityIntegrationQueries } from '../integrations/queries'
import { observabilityNotificationQueries } from '../notifications/queries'
import { observabilityOncallQueries } from '../oncall/queries'
import { observabilityRuleQueries } from '../rules/queries'
import '../observability-pages.css'
import { observabilityOverviewQueries } from './queries'

const { Text } = Typography

function isTerminalStatus(status?: string) {
  return ['completed', 'resolved', 'rejected', 'failed', 'canceled', 'cancelled'].includes(
    String(status || '').toLowerCase(),
  )
}

export function MonitoringPage() {
  const navigate = useNavigate()
  const summaryQuery = useQuery(observabilityOverviewQueries.summary())
  const alertsQuery = useQuery(observabilityAlertQueries.recent(8))
  const rulesQuery = useQuery(observabilityRuleQueries.list())
  const integrationsQuery = useQuery(observabilityIntegrationQueries.list())
  const policiesQuery = useQuery(observabilityNotificationQueries.policies())
  const oncallQuery = useQuery(observabilityOncallQueries.schedules())
  const healingRunsQuery = useQuery(observabilityHealingQueries.recentRuns(6))

  const summary = summaryQuery.data
  const recentAlerts = alertsQuery.data ?? []
  const rules = rulesQuery.data ?? []
  const integrations = integrationsQuery.data ?? []
  const policies = policiesQuery.data ?? []
  const oncallSchedules = oncallQuery.data ?? []
  const healingRuns = healingRunsQuery.data ?? []
  const enabledRules = rules.filter((item) => item.enabled).length
  const enabledIntegrations = integrations.filter((item) => item.enabled).length
  const enabledPolicies = policies.filter((item) => item.enabled).length
  const enabledOncall = oncallSchedules.filter((item) => item.enabled).length
  const pendingHealing = healingRuns.filter((item) => !isTerminalStatus(item.status)).length

  const overviewStats = [
    {
      key: 'firing',
      label: '活跃告警',
      helper: '当前仍需处理的告警事件',
      value: summary?.firingCount ?? 0,
      icon: <AlertOutlined />,
      tone: (summary?.firingCount ?? 0) > 0 ? 'warning' : 'default',
    },
    {
      key: 'critical',
      label: '严重告警',
      helper: 'Critical 优先级信号',
      value: summary?.criticalCount ?? 0,
      icon: <FireOutlined />,
      tone: (summary?.criticalCount ?? 0) > 0 ? 'danger' : 'default',
    },
    {
      key: 'rules',
      label: '启用规则',
      helper: `共 ${rules.length} 条规则`,
      value: enabledRules,
      icon: <BellOutlined />,
      tone: 'default',
    },
    {
      key: 'channels',
      label: '通知渠道',
      helper: '可用于投递的渠道数',
      value: summary?.channelCount ?? 0,
      icon: <NotificationOutlined />,
      tone: 'default',
    },
  ] satisfies OverviewMetricItem[]

  const alertChips = [
    { key: 'total', label: '总数', value: summary?.totalCount ?? 0, tone: 'default' },
    { key: 'firing', label: '活跃', value: summary?.firingCount ?? 0, tone: 'warning' },
    {
      key: 'resolved',
      label: '已恢复',
      value: summary?.resolvedCount ?? 0,
      tone: 'success',
    },
    {
      key: 'critical',
      label: 'Critical',
      value: summary?.criticalCount ?? 0,
      tone: 'danger',
    },
    {
      key: 'warning',
      label: 'Warning',
      value: summary?.warningCount ?? 0,
      tone: 'warning',
    },
    { key: 'info', label: 'Info', value: summary?.infoCount ?? 0, tone: 'default' },
  ] satisfies OverviewChipItem[]

  const operationStats = [
    {
      key: 'integrations',
      label: '启用集成',
      value: enabledIntegrations,
      helper: `共 ${integrations.length} 个来源`,
      icon: <LinkOutlined />,
      tone: 'default',
    },
    {
      key: 'policies',
      label: '启用通知策略',
      value: enabledPolicies,
      helper: `共 ${policies.length} 条策略`,
      icon: <NotificationOutlined />,
      tone: 'default',
    },
    {
      key: 'oncall',
      label: '启用值班表',
      value: enabledOncall,
      helper: `共 ${oncallSchedules.length} 张值班表`,
      icon: <TeamOutlined />,
      tone: 'default',
    },
    {
      key: 'healing',
      label: '待处理自愈',
      value: pendingHealing,
      helper: `最近 ${healingRuns.length} 条运行`,
      icon: <ReloadOutlined />,
      tone: pendingHealing > 0 ? 'warning' : 'default',
    },
  ] satisfies OverviewChipItem[]

  return (
    <div className="soha-page soha-overview-page soha-monitoring-overview-page">
      <ManagementDetailHeader
        title="总览"
        description="告警任务、事件、通知和值班链路的统一运行视图。"
      />

      <div className="soha-overview-metric-grid">
        {overviewStats.map((item) => (
          <OverviewMetricCard
            key={item.key}
            label={item.label}
            value={item.value}
            helper={item.helper}
            icon={item.icon}
            tone={item.tone}
            loading={summaryQuery.isLoading}
          />
        ))}
      </div>

      <div className="soha-overview-summary-grid">
        <Card
          className="soha-overview-panel-card"
          title="告警态势"
          extra={
            <Text type="secondary" className="text-xs">
              最近接收: {formatDateTime(summary?.lastReceivedAt)}
            </Text>
          }
        >
          {summary ? (
            <div className="soha-overview-alert-stack">
              <OverviewSectionBar
                title="告警分布"
                description={
                  summary.firingCount > 0
                    ? '当前仍有活跃告警，优先处置 Critical 和 Warning。'
                    : '当前没有活跃告警，继续关注规则、通知和值班链路。'
                }
                extra={
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => navigate('/monitoring-workbench/alerts')}
                  >
                    查看活跃告警
                  </Button>
                }
              />
              <div className="soha-overview-chip-grid soha-monitoring-chip-grid">
                {alertChips.map((item) => (
                  <OverviewChip
                    key={item.key}
                    label={item.label}
                    value={item.value}
                    tone={item.tone}
                  />
                ))}
              </div>
            </div>
          ) : (
            <ManagementState bordered={false} compact description="暂无告警摘要" />
          )}
        </Card>

        <Card className="soha-overview-panel-card" title="运行链路">
          <div className="soha-monitoring-operation-grid">
            {operationStats.map((item) => (
              <OverviewChip
                key={item.key}
                label={item.label}
                value={item.value}
                helper={item.helper}
                icon={item.icon}
                tone={item.tone}
              />
            ))}
          </div>
        </Card>
      </div>

      <Card
        className="soha-overview-runtime-card"
        title="最近告警"
        extra={
          <ManagementIconButton
            aria-label="进入告警处理"
            icon={<EyeOutlined />}
            size="small"
            tooltip="进入告警处理"
            onClick={() => navigate('/monitoring-workbench/alerts')}
          />
        }
      >
        {alertsQuery.isLoading ? (
          <div className="soha-monitoring-alert-list">
            {[0, 1, 2].map((item) => (
              <Card key={item} loading size="small" />
            ))}
          </div>
        ) : recentAlerts.length === 0 ? (
          <ManagementState bordered={false} compact description="暂无最近告警" />
        ) : (
          <div className="soha-monitoring-alert-list">
            {recentAlerts.map((item) => (
              <div key={item.id} className="soha-overview-attention-row">
                <div className="soha-overview-attention-main">
                  <div className="soha-monitoring-alert-title-row">
                    <Text strong>{item.title || item.id}</Text>
                    <StatusTag value={item.severity} />
                    <StatusTag value={item.status} />
                  </div>
                  <div className="soha-overview-inline-caption">{item.summary || '-'}</div>
                </div>
                <div className="soha-overview-attention-meta">
                  <span>{[item.clusterId, item.namespace].filter(Boolean).join(' / ') || '-'}</span>
                  <span>{formatDateTime(item.lastSeenAt || item.startsAt)}</span>
                  <Button
                    size="small"
                    onClick={() => navigate(`/monitoring-workbench/alerts/${item.id}`)}
                  >
                    详情
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
