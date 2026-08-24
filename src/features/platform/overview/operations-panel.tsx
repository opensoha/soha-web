import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Progress, Space, Spin, Typography } from 'antd'
import { ArrowRightOutlined, RobotOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { ResourceStreamStatus } from '@/features/platform/shared/resource-stream-status'
import { useKubernetesResourceStream } from '@/features/platform/shared/resource-stream'
import { systemQueries } from '@/features/system'
import { useAIGlobalAssistant } from '@/features/copilot'
import { formatDateTime } from '@/utils/time'
import { clusterQueries } from '../clusters/queries'
import { nodeQueries } from '../cluster-resources/queries'
import { configurationQueries } from '../configuration/shared/queries'
import type { ConfigurationResourceRecord } from '../configuration/shared/types'
import { networkCoreQueries } from '../network/resources/queries'
import type { NetworkPolicy } from '../network/resources/types'
import {
  buildActivityTimeline,
  buildOperationsAIEvidence,
  formatPlatformOverviewCapability,
  formatPlatformOverviewText,
  summarizeCapabilityGovernance,
  summarizeNodeCapacity,
} from './model'
import { platformOverviewQueries } from './queries'

const { Text } = Typography

interface OperationsPermissions {
  audit: boolean
  events: boolean
  hpas: boolean
  mutatingWebhooks: boolean
  networkPolicies: boolean
  nodes: boolean
  operations: boolean
  podDisruptionBudgets: boolean
  validatingWebhooks: boolean
}

interface PlatformOperationsPanelProps {
  clusterId: string | null
  connectionMode?: string
  localeCode: 'zh_CN' | 'en_US'
  permissions: OperationsPermissions
}

function CapacityMetric({ label, value }: { label: string; value: number | undefined }) {
  const rounded = value == null ? undefined : Math.round(value)
  return (
    <div className="soha-platform-ops-capacity-item">
      <div className="soha-platform-ops-row-head">
        <Text>{label}</Text>
        <Text strong>{rounded == null ? '-' : `${rounded}%`}</Text>
      </div>
      <Progress
        percent={rounded == null ? 0 : Math.min(100, rounded)}
        showInfo={false}
        size="small"
        status={rounded != null && rounded >= 90 ? 'exception' : 'normal'}
      />
    </div>
  )
}

export function PlatformOperationsPanel({
  clusterId,
  connectionMode,
  localeCode,
  permissions,
}: PlatformOperationsPanelProps) {
  const navigate = useNavigate()
  const assistant = useAIGlobalAssistant()
  const scope = { clusterId, namespace: null }
  const nodesQuery = useQuery({
    ...nodeQueries.list(scope),
    enabled: permissions.nodes && Boolean(clusterId),
  })
  const eventsQuery = useQuery(platformOverviewQueries.events(clusterId, permissions.events, 12))
  const auditQuery = useQuery({
    ...systemQueries.audit('system', { clusterId: clusterId ?? undefined, limit: 8 }),
    enabled: permissions.audit && Boolean(clusterId),
  })
  const operationQuery = useQuery({
    ...systemQueries.operationLogs({ clusterId: clusterId ?? undefined, limit: 8 }),
    enabled: permissions.operations && Boolean(clusterId),
  })
  const capabilitiesQuery = useQuery({
    ...clusterQueries.capabilities(),
    enabled: Boolean(clusterId),
  })
  const networkPoliciesQuery = useQuery({
    ...networkCoreQueries.list<NetworkPolicy>('networkpolicies', scope),
    enabled: permissions.networkPolicies && Boolean(clusterId),
  })
  const hpasQuery = useQuery({
    ...configurationQueries.list<ConfigurationResourceRecord>('hpas', scope),
    enabled: permissions.hpas && Boolean(clusterId),
  })
  const pdbsQuery = useQuery({
    ...configurationQueries.list<ConfigurationResourceRecord>('poddisruptionbudgets', scope),
    enabled: permissions.podDisruptionBudgets && Boolean(clusterId),
  })
  const mutatingWebhooksQuery = useQuery({
    ...configurationQueries.list<ConfigurationResourceRecord>(
      'mutatingwebhookconfigurations',
      scope,
    ),
    enabled: permissions.mutatingWebhooks && Boolean(clusterId),
  })
  const validatingWebhooksQuery = useQuery({
    ...configurationQueries.list<ConfigurationResourceRecord>(
      'validatingwebhookconfigurations',
      scope,
    ),
    enabled: permissions.validatingWebhooks && Boolean(clusterId),
  })
  const streamKinds = useMemo(
    () => [permissions.nodes ? 'Node' : '', permissions.events ? 'Event' : ''].filter(Boolean),
    [permissions.events, permissions.nodes],
  )
  const refreshLiveEvidence = () => {
    if (permissions.nodes) void nodesQuery.refetch()
    if (permissions.events) void eventsQuery.refetch()
  }
  const evidenceStream = useKubernetesResourceStream({
    clusterId,
    kinds: streamKinds,
    enabled: Boolean(clusterId && streamKinds.length > 0),
    onEvent: refreshLiveEvidence,
    onFallback: refreshLiveEvidence,
    onResyncRequired: () =>
      Promise.all([
        permissions.nodes ? nodesQuery.refetch() : Promise.resolve(),
        permissions.events ? eventsQuery.refetch() : Promise.resolve(),
      ]),
  })

  const capacity = useMemo(() => summarizeNodeCapacity(nodesQuery.data ?? []), [nodesQuery.data])
  const governance = useMemo(
    () => summarizeCapabilityGovernance(capabilitiesQuery.data ?? [], connectionMode),
    [capabilitiesQuery.data, connectionMode],
  )
  const timeline = useMemo(
    () =>
      buildActivityTimeline(
        eventsQuery.data ?? [],
        auditQuery.data ?? [],
        operationQuery.data ?? [],
      ),
    [auditQuery.data, eventsQuery.data, operationQuery.data],
  )
  const canViewTimeline = permissions.events || permissions.audit || permissions.operations
  const admissionLoading =
    (permissions.mutatingWebhooks && mutatingWebhooksQuery.isLoading) ||
    (permissions.validatingWebhooks && validatingWebhooksQuery.isLoading)
  const admissionError =
    (permissions.mutatingWebhooks && mutatingWebhooksQuery.isError) ||
    (permissions.validatingWebhooks && validatingWebhooksQuery.isError)
  const governanceCoverage = [
    {
      key: 'network-policy',
      label: 'NetworkPolicy',
      count: permissions.networkPolicies ? networkPoliciesQuery.data?.length : undefined,
      path: '/network/networkpolicies',
    },
    {
      key: 'admission',
      label: 'Admission Webhook',
      count:
        (permissions.mutatingWebhooks || permissions.validatingWebhooks) &&
        !admissionLoading &&
        !admissionError
          ? (mutatingWebhooksQuery.data?.length ?? 0) + (validatingWebhooksQuery.data?.length ?? 0)
          : undefined,
      path: permissions.validatingWebhooks
        ? '/configuration/validatingwebhookconfigurations'
        : '/configuration/mutatingwebhookconfigurations',
    },
    {
      key: 'pdb',
      label: 'PodDisruptionBudget',
      count: permissions.podDisruptionBudgets ? pdbsQuery.data?.length : undefined,
      path: '/configuration/poddisruptionbudgets',
    },
    {
      key: 'hpa',
      label: 'HorizontalPodAutoscaler',
      count: permissions.hpas ? hpasQuery.data?.length : undefined,
      path: '/configuration/hpas',
    },
  ]

  if (!clusterId) {
    return (
      <Card
        className="soha-overview-runtime-card"
        title={localeCode === 'zh_CN' ? '运行证据与治理' : 'Operations Evidence'}
      >
        <ManagementState
          bordered={false}
          compact
          kind="select-scope"
          title={localeCode === 'zh_CN' ? '请选择集群' : 'Select a cluster'}
        />
      </Card>
    )
  }

  return (
    <div className="soha-overview-summary-grid soha-platform-operations-grid">
      <Card
        className="soha-overview-panel-card"
        title={localeCode === 'zh_CN' ? '容量与治理门禁' : 'Capacity & Governance'}
        extra={
          <Space size={8} wrap>
            {permissions.nodes ? (
              <Button
                type="text"
                icon={<ArrowRightOutlined />}
                onClick={() => navigate('/cluster-resources/nodes')}
              >
                {localeCode === 'zh_CN' ? '查看节点' : 'Open Nodes'}
              </Button>
            ) : null}
            {streamKinds.length > 0 ? (
              <ResourceStreamStatus
                lastEventAt={evidenceStream.lastEventAt}
                localeCode={localeCode}
                status={evidenceStream.status}
              />
            ) : null}
          </Space>
        }
      >
        <div className="soha-platform-ops-split">
          <section className="soha-platform-ops-section" aria-label="capacity">
            <div className="soha-platform-ops-row-head">
              <Text strong>{localeCode === 'zh_CN' ? '最高节点压力' : 'Peak Node Pressure'}</Text>
              <Text type="secondary" className="text-xs">
                {capacity.readyNodes}/{capacity.totalNodes}{' '}
                {localeCode === 'zh_CN' ? '就绪' : 'Ready'}
              </Text>
            </div>
            {!permissions.nodes ? (
              <ManagementState
                bordered={false}
                compact
                kind="no-permission"
                title={localeCode === 'zh_CN' ? '无权限查看节点容量' : 'No node capacity access'}
              />
            ) : nodesQuery.isLoading ? (
              <div className="soha-platform-ops-loading">
                <Spin size="small" />
              </div>
            ) : nodesQuery.isError ? (
              <ManagementState
                bordered={false}
                compact
                kind="error"
                title={localeCode === 'zh_CN' ? '节点容量加载失败' : 'Failed to load capacity'}
              />
            ) : (
              <div className="soha-platform-ops-capacity-list">
                <CapacityMetric label="CPU" value={capacity.cpuPercent} />
                <CapacityMetric
                  label={localeCode === 'zh_CN' ? '内存' : 'Memory'}
                  value={capacity.memoryPercent}
                />
                <CapacityMetric label="Pods" value={capacity.podPercent} />
                <div className="soha-platform-ops-inline-meta">
                  <span>
                    {localeCode === 'zh_CN' ? '资源信号' : 'Signals'}: {capacity.signalNodes}/
                    {capacity.totalNodes}
                  </span>
                  <span>
                    {localeCode === 'zh_CN' ? '不可调度' : 'Unschedulable'}:{' '}
                    {capacity.unschedulableNodes}
                  </span>
                </div>
              </div>
            )}
          </section>

          <section className="soha-platform-ops-section" aria-label="governance">
            <div className="soha-platform-ops-row-head">
              <Text strong>
                {localeCode === 'zh_CN' ? '高风险与审批能力' : 'Risk & Approval Capabilities'}
              </Text>
              <Text type="secondary" className="text-xs">
                {localeCode === 'zh_CN'
                  ? `共 ${governance.approvalRequired} 项能力需审批`
                  : `${governance.approvalRequired} approval-gated`}
              </Text>
            </div>
            {capabilitiesQuery.isLoading ? (
              <div className="soha-platform-ops-loading">
                <Spin size="small" />
              </div>
            ) : capabilitiesQuery.isError ? (
              <ManagementState
                bordered={false}
                compact
                kind="error"
                title={localeCode === 'zh_CN' ? '治理能力加载失败' : 'Failed to load governance'}
              />
            ) : (
              <div className="soha-platform-ops-risk-list">
                {governance.items.map((item) => (
                  <div key={item.key} className="soha-platform-ops-risk-row">
                    <div>
                      <Text>
                        {formatPlatformOverviewCapability(item.key, item.label, localeCode)}
                      </Text>
                      <div className="soha-overview-inline-caption">{item.key}</div>
                    </div>
                    <div className="soha-platform-ops-risk-tags">
                      {item.requiresApproval ? (
                        <StatusTag
                          label={formatPlatformOverviewText('approval', localeCode)}
                          value="approval"
                        />
                      ) : null}
                      <StatusTag
                        label={formatPlatformOverviewText(item.riskLevel, localeCode)}
                        value={item.riskLevel}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="soha-platform-governance-coverage">
          {governanceCoverage.map((item) => (
            <button
              key={item.key}
              type="button"
              className="soha-platform-governance-item"
              onClick={() => navigate(item.path)}
            >
              <span>{item.label}</span>
              <strong>{item.count ?? '-'}</strong>
            </button>
          ))}
        </div>
      </Card>

      <Card
        className="soha-overview-panel-card"
        title={localeCode === 'zh_CN' ? '最近运行证据' : 'Recent Operations Evidence'}
        extra={
          <Space size={4}>
            <Button
              type="text"
              icon={<RobotOutlined />}
              disabled={!assistant}
              onClick={() =>
                void assistant?.launchAssistant({
                  action: 'analyze-page',
                  contextOverride: {
                    sourceWorkbench: 'platform',
                    sourceTitle:
                      localeCode === 'zh_CN' ? 'K8s 工作台运行证据' : 'K8s operations evidence',
                    entityKind: 'kubernetes.cluster',
                    entityName: clusterId,
                    clusterId,
                    timeRangeMinutes: 60,
                    pinnedData: buildOperationsAIEvidence({
                      capacity,
                      connectionMode,
                      governance,
                      coverage: governanceCoverage,
                      timeline,
                    }),
                    promptHint:
                      localeCode === 'zh_CN'
                        ? '结合节点压力、治理覆盖和最近运行证据，按影响与证据强度排序排查。'
                        : 'Prioritize investigation by impact and evidence strength across capacity, governance, and recent operations.',
                  },
                })
              }
            >
              {localeCode === 'zh_CN' ? 'AI 排障' : 'AI troubleshoot'}
            </Button>
            {permissions.operations ? (
              <Button
                type="text"
                icon={<ArrowRightOutlined />}
                onClick={() => navigate('/system/operations')}
              >
                {localeCode === 'zh_CN' ? '操作日志' : 'Operation Logs'}
              </Button>
            ) : null}
          </Space>
        }
      >
        {!canViewTimeline ? (
          <ManagementState
            bordered={false}
            compact
            kind="no-permission"
            title={localeCode === 'zh_CN' ? '无权限查看运行证据' : 'No evidence access'}
          />
        ) : eventsQuery.isLoading || auditQuery.isLoading || operationQuery.isLoading ? (
          <div className="soha-platform-ops-loading">
            <Spin size="small" />
          </div>
        ) : timeline.length === 0 ? (
          <ManagementState
            bordered={false}
            compact
            title={localeCode === 'zh_CN' ? '当前没有运行记录' : 'No recent operations'}
          />
        ) : (
          <div className="soha-platform-activity-list">
            {timeline.map((item) => (
              <button
                key={item.id}
                type="button"
                className="soha-platform-activity-row"
                onClick={() => navigate(item.path)}
              >
                <span className={`soha-platform-activity-source is-${item.source}`}>
                  {item.source === 'kubernetes'
                    ? 'K8s'
                    : item.source === 'audit'
                      ? localeCode === 'zh_CN'
                        ? '审计'
                        : 'Audit'
                      : localeCode === 'zh_CN'
                        ? '操作'
                        : 'Operation'}
                </span>
                <span className="soha-platform-activity-copy">
                  <Text strong ellipsis>
                    {formatPlatformOverviewText(item.title, localeCode)}
                  </Text>
                  <span>
                    {item.description
                      ? formatPlatformOverviewText(item.description, localeCode)
                      : '-'}
                  </span>
                </span>
                <span className="soha-platform-activity-meta">
                  <StatusTag
                    label={formatPlatformOverviewText(item.status, localeCode)}
                    value={item.status}
                  />
                  <span>{formatDateTime(item.timestamp)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
