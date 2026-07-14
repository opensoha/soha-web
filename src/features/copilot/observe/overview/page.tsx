import { useNavigate } from 'react-router-dom'
import {
  ApiOutlined,
  BookOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd'
import {
  ManagementDetailHeader,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { gatewayQueries } from '../../gateway/queries'
import { knowledgeQueries } from '../../knowledge/queries'
import { getAIWorkbenchPathForMode } from '../../workbench/navigation'
import { workbenchQueries } from '../../workbench/queries'
import '../../copilot-pages.css'

const { Text } = Typography

function DomainState({
  allowed,
  error,
  loading,
  children,
}: {
  allowed: boolean
  error: boolean
  loading: boolean
  children: ReactNode
}) {
  if (!allowed) {
    return <ManagementState bordered={false} compact kind="no-permission" />
  }
  if (loading) {
    return <ManagementState bordered={false} compact kind="loading" />
  }
  if (error) {
    return (
      <ManagementState
        bordered={false}
        compact
        kind="error"
        description="该领域服务暂时不可用，其他 AI 能力不受影响。"
      />
    )
  }
  return children
}

export function AIObserveOverviewPage() {
  const navigate = useNavigate()
  const permissionQuery = usePermissionSnapshot()
  const snapshot = permissionQuery.data?.data
  const canChat = hasPermission(snapshot, 'observe.ai.chat')
  const canObserve = hasPermission(snapshot, 'observe.ai.view')
  const canKnowledge = hasPermission(snapshot, 'ai.knowledge.view')
  const canGateway = hasPermission(snapshot, 'ai.gateway.view')
  const canRelay =
    hasPermission(snapshot, 'ai.gateway.relay.view') ||
    hasPermission(snapshot, 'ai.gateway.relay.manage')

  const sessionsQuery = useQuery({
    ...workbenchQueries.sessions.all(),
    enabled: canChat || canObserve,
  })
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

  return (
    <div className="soha-page soha-ai-unified-overview">
      <ManagementDetailHeader
        title="AI 工作台"
        description="统一查看交互、知识、Agent、模型接入与治理能力。所有摘要均按当前身份权限独立加载。"
        actions={
          <ManagementTableToolbar>
            {canKnowledge ? (
              <Button icon={<BookOutlined />} onClick={() => navigate('/ai-workbench/knowledge')}>
                Knowledge Center
              </Button>
            ) : null}
            {canGateway || canRelay ? (
              <Button
                icon={<ApiOutlined />}
                onClick={() => navigate(canRelay ? '/ai-gateway/relay' : '/ai-gateway/manifest')}
              >
                模型与接入
              </Button>
            ) : null}
            {canChat ? (
              <Button
                type="primary"
                icon={<RobotOutlined />}
                onClick={() => navigate(getAIWorkbenchPathForMode('general'))}
              >
                进入通用聊天
              </Button>
            ) : null}
          </ManagementTableToolbar>
        }
      />

      <Row gutter={[12, 12]}>
        <Col xs={24} xl={12}>
          <Card
            size="small"
            variant="outlined"
            title={
              <Space>
                <RobotOutlined />
                交互与运行
              </Space>
            }
            extra={
              canObserve ? (
                <Button type="link" onClick={() => navigate('/ai-workbench/agent-runs')}>
                  Agent Runs
                </Button>
              ) : null
            }
          >
            <DomainState
              allowed={canChat || canObserve}
              loading={sessionsQuery.isLoading || runsQuery.isLoading}
              error={sessionsQuery.isError || runsQuery.isError}
            >
              <div className="soha-ai-overview-metrics">
                <Statistic title="会话" value={sessions.length} />
                <Statistic title="Agent Runs" value={runs.length} />
                <Statistic
                  title="运行中"
                  value={
                    runs.filter((run) => ['queued', 'running', 'claimed'].includes(run.status))
                      .length
                  }
                />
              </div>
            </DomainState>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card
            size="small"
            variant="outlined"
            title={
              <Space>
                <BookOutlined />
                Knowledge
              </Space>
            }
            extra={
              canKnowledge ? (
                <Button type="link" onClick={() => navigate('/ai-workbench/knowledge')}>
                  打开
                </Button>
              ) : null
            }
          >
            <DomainState
              allowed={canKnowledge}
              loading={basesQuery.isLoading}
              error={basesQuery.isError}
            >
              <div className="soha-ai-overview-metrics">
                <Statistic title="知识库" value={bases.length} />
                <Statistic
                  title="可用"
                  value={bases.filter((base) => base.status === 'active').length}
                />
                <Statistic
                  title="异常"
                  value={
                    bases.filter(
                      (base) => base.status && !['active', 'ready'].includes(base.status),
                    ).length
                  }
                />
              </div>
            </DomainState>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card
            size="small"
            variant="outlined"
            title={
              <Space>
                <PlayCircleOutlined />
                Agent Providers
              </Space>
            }
            extra={
              canObserve ? (
                <Button type="link" onClick={() => navigate('/ai-workbench/agent-providers')}>
                  管理
                </Button>
              ) : null
            }
          >
            <DomainState
              allowed={canObserve}
              loading={catalogQuery.isLoading}
              error={catalogQuery.isError}
            >
              <div className="soha-ai-overview-metrics">
                <Statistic title="Providers" value={catalog?.agentProviders?.length ?? 0} />
                <Statistic title="Skills" value={catalog?.skillsRegistry?.length ?? 0} />
                <Statistic title="Capabilities" value={catalog?.capabilities?.length ?? 0} />
              </div>
              {!catalog?.agentProviders?.length ? (
                <Text type="secondary">
                  尚无已激活的 Agent Provider。插件已安装后仍需等待运行时 Catalog 同步。
                </Text>
              ) : null}
            </DomainState>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card
            size="small"
            variant="outlined"
            title={
              <Space>
                <SafetyCertificateOutlined />
                Gateway 与治理
              </Space>
            }
            extra={
              canGateway ? (
                <Button type="link" onClick={() => navigate('/ai-gateway/manifest')}>
                  能力清单
                </Button>
              ) : null
            }
          >
            <DomainState
              allowed={canGateway || canRelay}
              loading={manifestQuery.isLoading || relayQuery.isLoading}
              error={manifestQuery.isError || relayQuery.isError}
            >
              <div className="soha-ai-overview-metrics">
                <Statistic title="Tools" value={manifest?.summary.toolCount ?? '-'} />
                <Statistic title="Skills" value={manifest?.summary.skillCount ?? '-'} />
                <Statistic
                  title="今日模型调用"
                  value={relay?.requestsToday ?? relay?.totalCalls ?? '-'}
                />
              </div>
              <Space wrap>
                {manifest ? <Tag color="success">Manifest {manifest.version}</Tag> : null}
                {typeof relay?.successRate === 'number' ? (
                  <Tag>成功率 {(relay.successRate * 100).toFixed(1)}%</Tag>
                ) : null}
              </Space>
            </DomainState>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
import type { ReactNode } from 'react'
