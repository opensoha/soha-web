import { Link } from 'react-router-dom'
import { ApiOutlined, BookOutlined, PlayCircleOutlined, RobotOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button } from 'antd'
import { ManagementState } from '@/components/management-list'
import { OverviewMetricCard, type OverviewMetricItem } from '@/components/overview-visuals'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { gatewayQueries } from '../../gateway/queries'
import { knowledgeQueries } from '../../knowledge/queries'
import { getAIWorkbenchPathForMode } from '../../workbench/navigation'
import { workbenchQueries } from '../../workbench/queries'
import '../../copilot-pages.css'

function domainHelper(allowed: boolean, error: boolean, detail: string) {
  if (!allowed) return '无查看权限'
  return error ? '服务暂时不可用，进入对应页面重试' : detail
}

export function AIObserveOverviewPage() {
  const permissionQuery = usePermissionSnapshot()
  const snapshot = permissionQuery.data?.data
  const canChat = hasPermission(snapshot, 'observe.ai.chat')
  const canObserve = hasPermission(snapshot, 'observe.ai.view')
  const canKnowledge = hasPermission(snapshot, 'ai.knowledge.view')
  const canGateway = hasPermission(snapshot, 'ai.gateway.view')
  const canRelay = hasPermission(snapshot, 'ai.gateway.relay.view')

  const sessionsQuery = useQuery(workbenchQueries.sessions.all(canChat))
  const catalogQuery = useQuery({ ...workbenchQueries.catalog(), enabled: canObserve })
  const runsQuery = useQuery({ ...workbenchQueries.agentRuns.all(), enabled: canObserve })
  const basesQuery = useQuery(knowledgeQueries.bases(canKnowledge))
  const manifestQuery = useQuery(
    gatewayQueries.manifest({ aiClientId: '', skillId: '', source: '' }, canGateway),
  )
  const relayQuery = useQuery(gatewayQueries.relay.metrics(canRelay))

  const sessions = sessionsQuery.data?.data ?? []
  const catalog = catalogQuery.data?.data
  const runs = runsQuery.data?.data ?? []
  const bases = basesQuery.data?.data ?? []
  const manifest = manifestQuery.data?.data
  const relay = relayQuery.data?.data
  const interactionAllowed = canChat || canObserve
  const interactionError = sessionsQuery.isError || runsQuery.isError
  const gatewayAllowed = canGateway || canRelay
  const gatewayError = manifestQuery.isError || relayQuery.isError

  const overviewStats: Array<
    OverviewMetricItem & { allowed: boolean; loading: boolean; path: string }
  > = [
    {
      key: 'interaction',
      label: '会话 / Agent Runs',
      value: interactionAllowed
        ? `${canChat ? sessions.length : '-'} / ${canObserve ? runs.length : '-'}`
        : '-',
      helper: domainHelper(
        interactionAllowed,
        interactionError,
        canObserve
          ? `运行中 ${runs.filter((run) => ['queued', 'running', 'claimed'].includes(run.status)).length}`
          : `当前会话 ${sessions.length}`,
      ),
      icon: <RobotOutlined />,
      tone: interactionError ? 'danger' : 'default',
      path: canChat ? getAIWorkbenchPathForMode('general') : '/ai-workbench/agent-runs',
      allowed: interactionAllowed,
      loading:
        permissionQuery.isLoading ||
        (canChat && sessionsQuery.isLoading) ||
        (canObserve && runsQuery.isLoading),
    },
    {
      key: 'knowledge',
      label: '知识库',
      value: canKnowledge ? bases.length : '-',
      helper: domainHelper(
        canKnowledge,
        basesQuery.isError,
        `可用 ${bases.filter((base) => ['active', 'ready'].includes(base.status || '')).length} · 异常 ${bases.filter((base) => base.status && !['active', 'ready'].includes(base.status)).length}`,
      ),
      icon: <BookOutlined />,
      tone: basesQuery.isError ? 'danger' : 'default',
      path: '/ai-workbench/knowledge',
      allowed: canKnowledge,
      loading: permissionQuery.isLoading || (canKnowledge && basesQuery.isLoading),
    },
    {
      key: 'providers',
      label: 'Agent Providers',
      value: canObserve ? (catalog?.agentProviders?.length ?? 0) : '-',
      helper: domainHelper(
        canObserve,
        catalogQuery.isError,
        `Skills ${catalog?.skillsRegistry?.length ?? 0} · Capabilities ${catalog?.capabilities?.length ?? 0}`,
      ),
      icon: <PlayCircleOutlined />,
      tone: catalogQuery.isError ? 'danger' : 'default',
      path: '/ai-workbench/agent-providers',
      allowed: canObserve,
      loading: permissionQuery.isLoading || (canObserve && catalogQuery.isLoading),
    },
    {
      key: 'gateway',
      label: 'Gateway Tools / 调用',
      value: gatewayAllowed
        ? `${canGateway ? (manifest?.summary.toolCount ?? '-') : '-'} / ${canRelay ? (relay?.requestsToday ?? relay?.totalCalls ?? '-') : '-'}`
        : '-',
      helper: domainHelper(
        gatewayAllowed,
        gatewayError,
        `Skills ${manifest?.summary.skillCount ?? '-'}${manifest?.version ? ` · Manifest ${manifest.version}` : ''}${typeof relay?.successRate === 'number' ? ` · 成功率 ${(relay.successRate * 100).toFixed(1)}%` : ''}`,
      ),
      icon: <ApiOutlined />,
      tone: gatewayError ? 'danger' : 'default',
      path: canRelay ? '/ai-gateway/relay' : '/ai-gateway/manifest',
      allowed: gatewayAllowed,
      loading:
        permissionQuery.isLoading ||
        (canGateway && manifestQuery.isLoading) ||
        (canRelay && relayQuery.isLoading),
    },
  ]

  if (permissionQuery.isError) {
    return (
      <div className="soha-page soha-overview-page soha-ai-unified-overview">
        <ManagementState
          kind="error"
          actions={<Button onClick={() => void permissionQuery.refetch()}>重试</Button>}
        />
      </div>
    )
  }

  return (
    <div className="soha-page soha-overview-page soha-ai-unified-overview">
      <div className="soha-overview-metric-grid">
        {overviewStats.map(({ key, path, allowed, loading, ...item }) => {
          const card = <OverviewMetricCard {...item} loading={loading} />
          return allowed ? (
            <Link
              aria-label={`查看${String(item.label)}`}
              className="soha-overview-card-link"
              key={key}
              to={path}
            >
              {card}
            </Link>
          ) : (
            <div key={key}>{card}</div>
          )
        })}
      </div>
    </div>
  )
}
