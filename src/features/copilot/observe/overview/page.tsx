import { Link, useNavigate } from 'react-router-dom'
import {
  AppstoreOutlined,
  PlayCircleOutlined,
  RadarChartOutlined,
  RobotOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { Button, Card, Col, List, Row, Space, Statistic, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import {
  ManagementDetailHeader,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import {
  getAIOperationsPath,
  getAIToolsPath,
  getAIWorkbenchPathForMode,
  getAIWorkbenchPathForSession,
} from '../../workbench/navigation'
import { displayWorkbenchSessionTitle } from '../../workbench/model'
import { observeQueries } from '../queries'
import '../../copilot-pages.css'

const AI_OVERVIEW_ACTIONS = [
  {
    key: 'root_cause',
    label: '根因调查',
    detail: '告警、事件、异常波动',
    href: getAIWorkbenchPathForMode('root_cause'),
    icon: <RobotOutlined />,
  },
  {
    key: 'performance',
    label: '性能分析',
    detail: '容量、时延、吞吐',
    href: getAIWorkbenchPathForMode('performance'),
    icon: <RadarChartOutlined />,
  },
  {
    key: 'trace',
    label: '链路分析',
    detail: '跨服务路径与热点',
    href: getAIWorkbenchPathForMode('trace'),
    icon: <AppstoreOutlined />,
  },
  {
    key: 'operations',
    label: '巡检与自动化',
    detail: '任务、运行、策略',
    href: getAIOperationsPath(),
    icon: <PlayCircleOutlined />,
  },
  {
    key: 'tools',
    label: '工具与技能',
    detail: 'MCP、数据源、Skills',
    href: getAIToolsPath(),
    icon: <ToolOutlined />,
  },
] as const

export function AIObserveOverviewPage() {
  const navigate = useNavigate()
  const sessionsQuery = useQuery(observeQueries.overview.sessions())
  const insightsQuery = useQuery(observeQueries.overview.insights())
  const runsQuery = useQuery(observeQueries.overview.analysisRuns())
  const inspectionRunsQuery = useQuery(observeQueries.overview.inspectionRuns())

  const sessions = sessionsQuery.data ?? []
  const insights = insightsQuery.data ?? []
  const runs = runsQuery.data ?? []
  const inspectionRuns = inspectionRunsQuery.data ?? []

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title="AI工作台"
        description="面向全员的 AI 会话入口，统一承接通用问答、巡检复盘、根因、性能与工具链能力。"
        actions={
          <ManagementTableToolbar>
            <Button icon={<ToolOutlined />} onClick={() => navigate(getAIToolsPath())}>
              工具与技能
            </Button>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={() => navigate(getAIWorkbenchPathForMode('general'))}
            >
              进入通用聊天
            </Button>
          </ManagementTableToolbar>
        }
      />

      <Card
        size="small"
        variant="outlined"
        className="soha-management-panel-card soha-ai-overview-console"
      >
        <div className="soha-ai-overview-actions">
          {AI_OVERVIEW_ACTIONS.map((item) => (
            <button
              key={item.key}
              className="soha-ai-overview-action"
              type="button"
              onClick={() => navigate(item.href)}
            >
              <span className="soha-ai-overview-action-icon">{item.icon}</span>
              <span className="soha-ai-overview-action-main">
                <span className="soha-ai-overview-action-label">{item.label}</span>
                <span className="soha-ai-overview-action-detail">{item.detail}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="soha-ai-overview-metrics">
          <Statistic title="AI 会话" value={sessions.length} prefix={<RobotOutlined />} />
          <Statistic title="根因运行" value={runs.length} prefix={<RadarChartOutlined />} />
          <Statistic title="巡检运行" value={inspectionRuns.length} prefix={<AppstoreOutlined />} />
          <Statistic title="AI 洞察" value={insights.length} prefix={<ToolOutlined />} />
        </div>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} xl={8}>
          <Card size="small" variant="outlined" className="soha-compact-note-card" title="最近会话">
            {sessions.length === 0 ? (
              <ManagementState
                bordered={false}
                compact
                title="暂无会话"
                description="创建或进入 AI 工作台后，这里会展示最近会话。"
              />
            ) : (
              <List
                dataSource={sessions.slice(0, 5)}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Link key="open" to={getAIWorkbenchPathForSession(item)}>
                        打开
                      </Link>,
                    ]}
                  >
                    <List.Item.Meta
                      title={displayWorkbenchSessionTitle(item.title)}
                      description={item.metadata?.summary || item.updatedAt}
                    />
                    {item.metadata?.mode ? <Tag>{item.metadata.mode}</Tag> : null}
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card size="small" variant="outlined" className="soha-compact-note-card" title="最近分析">
            {runs.length === 0 ? (
              <ManagementState
                bordered={false}
                compact
                title="暂无根因运行"
                description="运行根因分析后，这里会展示最近结果。"
              />
            ) : (
              <List
                dataSource={runs.slice(0, 5)}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta title={item.title} description={item.summary} />
                    <Space orientation="vertical" size={4}>
                      <StatusTag value={item.status} />
                      <StatusTag value={item.severity} />
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card size="small" variant="outlined" className="soha-compact-note-card" title="风险雷达">
            {insights.length === 0 ? (
              <ManagementState
                bordered={false}
                compact
                title="暂无风险信号"
                description="AI 洞察产生后，这里会展示需要关注的信号。"
              />
            ) : (
              <List
                dataSource={insights.slice(0, 5)}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta title={item.title} description={item.description} />
                    <StatusTag value={item.severity} />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
