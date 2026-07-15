import {
  ApiOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  DesktopOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Space, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { ComputeSectionStatus } from '@opensoha/contracts/gen/ts/sohaapi'
import { useAIPageContext } from '@/features/copilot'
import {
  OverviewChip,
  OverviewMetricCard,
  OverviewSectionBar,
  type OverviewChipItem,
  type OverviewMetricItem,
  type OverviewTone,
} from '@/components/overview-visuals'
import { ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { computeQueries } from '../queries'
import '../compute.css'

const { Text } = Typography

function statusTone(status?: ComputeSectionStatus): OverviewTone {
  if (status === 'ok') return 'success'
  if (status === 'degraded') return 'warning'
  if (status === 'unavailable') return 'danger'
  return 'default'
}

function providerDomainLabel(domain: string) {
  return domain === 'container_runtime' ? '容器运行时' : '虚拟化'
}

export function ComputeOverviewPage() {
  const navigate = useNavigate()
  const overviewQuery = useQuery(computeQueries.overview())
  const overview = overviewQuery.data?.data
  const virtualization = overview?.virtualization
  const agents = overview?.agents
  const runtimes = overview?.runtimes
  const workloads = overview?.runtimeWorkloads
  const tasks = overview?.tasks

  useAIPageContext({
    sourceWorkbench: 'compute',
    sourceTitle: '计算资源工作台',
    entityKind: 'compute.overview',
    entityName: '计算资源总览',
    pinnedData: overview
      ? { partial: overview.partial, attentionCount: overview.attention.length }
      : undefined,
  })

  const overviewStats = [
    {
      key: 'virtual-machines',
      label: '虚拟机',
      value: virtualization?.summary?.vmsTotal ?? '-',
      helper: virtualization
        ? `${virtualization.summary?.vmsRunning ?? 0} 台运行中 / ${virtualization.summary?.vmsStopped ?? 0} 台已停止`
        : '当前无虚拟化数据',
      icon: <DesktopOutlined />,
      tone: statusTone(virtualization?.status),
    },
    {
      key: 'runtime-hosts',
      label: '运行时主机',
      value: runtimes?.summary?.total ?? '-',
      helper: runtimes
        ? `${runtimes.summary?.available ?? 0} 台可用 / ${runtimes.summary?.error ?? 0} 台异常`
        : '当前无运行时主机数据',
      icon: <ClusterOutlined />,
      tone: statusTone(runtimes?.status),
    },
    {
      key: 'containers',
      label: '容器',
      value: workloads?.summary?.containers ?? '-',
      helper: workloads
        ? `${workloads.summary?.projects ?? 0} 个项目 / ${workloads.summary?.services ?? 0} 个服务`
        : '当前无容器资源数据',
      icon: <AppstoreOutlined />,
      tone: statusTone(workloads?.status),
    },
    {
      key: 'active-tasks',
      label: '活跃任务',
      value: tasks ? (tasks.summary?.queued ?? 0) + (tasks.summary?.running ?? 0) : '-',
      helper: tasks
        ? `${tasks.summary?.queued ?? 0} 个排队 / ${tasks.summary?.failed ?? 0} 个失败`
        : '当前无任务数据',
      icon: <ClockCircleOutlined />,
      tone: statusTone(tasks?.status),
    },
  ] satisfies OverviewMetricItem[]

  const accessStats = [
    {
      key: 'connections',
      label: '虚拟化连接',
      value: virtualization?.summary?.connectionsTotal ?? '-',
      helper: virtualization
        ? `${virtualization.summary?.connectionsHealthy ?? 0} 个健康`
        : '暂无连接数据',
      icon: <ApiOutlined />,
      tone: statusTone(virtualization?.status),
    },
    {
      key: 'agents',
      label: 'Agent 主机',
      value: agents?.summary?.total ?? '-',
      helper: agents ? `${agents.summary?.online ?? 0} 台在线` : '暂无 Agent 数据',
      icon: <ClusterOutlined />,
      tone: statusTone(agents?.status),
    },
    {
      key: 'runtime-hosts',
      label: '运行时主机',
      value: runtimes?.summary?.total ?? '-',
      helper: runtimes ? `${runtimes.summary?.available ?? 0} 台可用` : '暂无运行时数据',
      icon: <AppstoreOutlined />,
      tone: statusTone(runtimes?.status),
    },
  ] satisfies OverviewChipItem[]

  const taskStats = [
    {
      key: 'queued',
      label: '排队',
      value: tasks?.summary?.queued ?? '-',
      tone: (tasks?.summary?.queued ?? 0) > 0 ? 'warning' : 'default',
    },
    {
      key: 'running',
      label: '执行中',
      value: tasks?.summary?.running ?? '-',
      tone: (tasks?.summary?.running ?? 0) > 0 ? 'success' : 'default',
    },
    {
      key: 'failed',
      label: '失败',
      value: tasks?.summary?.failed ?? '-',
      tone: (tasks?.summary?.failed ?? 0) > 0 ? 'danger' : 'default',
    },
  ] satisfies OverviewChipItem[]

  return (
    <div className="soha-page soha-overview-page soha-compute-page soha-compute-overview-page">
      {overviewQuery.isError ? <Alert showIcon type="error" title="计算资源总览加载失败" /> : null}
      {overview?.partial ? (
        <Alert showIcon type="warning" title="部分资源暂不可用，其余已授权数据仍可查看" />
      ) : null}
      {overview?.warnings.map((warning) => (
        <Alert key={warning.code} showIcon type="warning" title={warning.message || warning.code} />
      ))}

      <div className="soha-overview-metric-grid">
        {overviewStats.map((item) => (
          <OverviewMetricCard
            key={item.key}
            label={item.label}
            value={item.value}
            helper={item.helper}
            icon={item.icon}
            tone={item.tone}
            loading={overviewQuery.isLoading}
          />
        ))}
      </div>

      <div className="soha-overview-summary-grid">
        <Card
          className="soha-overview-panel-card"
          title="资源接入"
          extra={
            <Button
              type="text"
              icon={<ArrowRightOutlined />}
              iconPlacement="end"
              onClick={() => navigate('/compute/access')}
            >
              管理接入
            </Button>
          }
        >
          {overviewQuery.isLoading ? (
            <ManagementState bordered={false} compact kind="loading" />
          ) : virtualization || agents || runtimes ? (
            <div className="soha-overview-alert-stack">
              <OverviewSectionBar
                title="接入状态"
                description="统一查看虚拟化连接、Agent 主机与运行时主机。"
              />
              <div className="soha-overview-chip-grid soha-compute-chip-grid">
                {accessStats.map(({ key, ...item }) => (
                  <OverviewChip key={key} {...item} />
                ))}
              </div>
            </div>
          ) : (
            <ManagementState bordered={false} compact kind="not-configured" />
          )}
        </Card>

        <Card
          className="soha-overview-panel-card"
          title="任务运行"
          extra={
            <Button
              type="text"
              icon={<ArrowRightOutlined />}
              iconPlacement="end"
              onClick={() => navigate('/compute/tasks/operations')}
            >
              查看任务
            </Button>
          }
        >
          {overviewQuery.isLoading ? (
            <ManagementState bordered={false} compact kind="loading" />
          ) : tasks ? (
            <div className="soha-overview-alert-stack">
              <OverviewSectionBar
                title="任务队列"
                description="集中查看同步、构建与资源操作的执行状态。"
              />
              <div className="soha-overview-chip-grid soha-compute-chip-grid">
                {taskStats.map(({ key, ...item }) => (
                  <OverviewChip key={key} {...item} />
                ))}
              </div>
            </div>
          ) : (
            <ManagementState bordered={false} compact kind="empty" title="暂无任务摘要" />
          )}
        </Card>
      </div>

      <Card className="soha-overview-runtime-card" title="运行健康">
        <div className="soha-overview-runtime-layout">
          <section className="soha-overview-runtime-main">
            <OverviewSectionBar
              title="需要关注"
              description="优先处理不可用资源、接入异常与失败任务。"
            />
            {overviewQuery.isLoading ? (
              <ManagementState bordered={false} compact kind="loading" />
            ) : overview?.attention.length ? (
              <div className="soha-overview-attention-list">
                {overview.attention.map((item) => (
                  <div
                    className={`soha-overview-attention-row soha-compute-attention-row is-${item.severity}`}
                    key={`${item.code}:${item.summary}`}
                  >
                    <div className="soha-overview-attention-main">
                      <Space size={6} wrap>
                        <Tag
                          color={
                            item.severity === 'critical'
                              ? 'error'
                              : item.severity === 'warning'
                                ? 'warning'
                                : 'processing'
                          }
                        >
                          {item.severity}
                        </Tag>
                        <Text strong>{item.summary}</Text>
                      </Space>
                      {item.resources?.length ? (
                        <div className="soha-overview-inline-caption">
                          影响 {item.resources.length} 个资源
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ManagementState bordered={false} compact kind="empty" title="当前没有待处置风险" />
            )}
          </section>

          <section className="soha-overview-runtime-side">
            <OverviewSectionBar
              title="Provider 健康"
              description="查看已加载计算 Provider 的激活代际与健康状态。"
            />
            {overviewQuery.isLoading ? (
              <ManagementState bordered={false} compact kind="loading" />
            ) : overview?.providerHealth.length ? (
              <div className="soha-overview-attention-list">
                {overview.providerHealth.map((provider) => (
                  <div
                    className="soha-overview-attention-row"
                    key={`${provider.domain}:${provider.providerKey}`}
                  >
                    <div className="soha-overview-attention-main">
                      <Space size={6} wrap>
                        <Text strong>{provider.providerKey}</Text>
                        <StatusTag value={provider.status} />
                      </Space>
                      <div className="soha-overview-inline-caption">
                        {provider.message || provider.code || 'Provider 已注册'}
                      </div>
                    </div>
                    <div className="soha-overview-attention-meta">
                      <span>{providerDomainLabel(provider.domain)}</span>
                      <span>generation {provider.generation}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ManagementState bordered={false} compact kind="empty" title="暂无 Provider 状态" />
            )}
          </section>
        </div>
      </Card>
    </div>
  )
}
