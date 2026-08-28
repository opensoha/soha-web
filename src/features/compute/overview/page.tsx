import {
  ApiOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  DesktopOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Space, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import type {
  ComputeHealthStatus,
  ComputeResourceRef,
  ComputeSectionStatus,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { useAIPageContext } from '@/features/copilot'
import {
  OverviewChip,
  OverviewMetricCard,
  type OverviewChipItem,
  type OverviewMetricItem,
  type OverviewTone,
} from '@/components/overview-visuals'
import { ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { localeText, useI18n } from '@/i18n'
import { formatDateTime } from '@/utils/time'
import { computeQueries } from '../queries'
import { ProviderInstancesPanel } from './provider-instances-panel'
import '../compute.css'

const { Text } = Typography

type NavigableMetricItem = OverviewMetricItem & { path: string }
type NavigableChipItem = OverviewChipItem & { path: string }

function statusTone(status?: ComputeSectionStatus): OverviewTone {
  if (status === 'ok') return 'success'
  if (status === 'degraded') return 'warning'
  if (status === 'unavailable') return 'danger'
  return 'default'
}

function providerDomainLabel(domain: string, localeCode: 'zh_CN' | 'en_US') {
  return domain === 'container_runtime'
    ? localeText(localeCode, '容器运行时', 'Container runtime')
    : localeText(localeCode, '虚拟化', 'Virtualization')
}

const ATTENTION_LABELS: Record<string, [string, string]> = {
  runtime_host_unavailable: ['运行时主机需要关注', 'Container runtime host needs attention'],
  virtualization_connection_unavailable: [
    '虚拟化连接不可用',
    'Virtualization connection unavailable',
  ],
}

function attentionLabel(code: string, summary: string, localeCode: 'zh_CN' | 'en_US') {
  return ATTENTION_LABELS[code]?.[localeCode === 'zh_CN' ? 0 : 1] ?? summary
}

function attentionTarget(code: string, resource?: ComputeResourceRef) {
  if (resource?.kind === 'runtime_host') {
    return `/compute/runtimes/hosts/${encodeURIComponent(resource.id)}`
  }
  if (resource?.kind === 'vm') {
    return `/compute/virtualization/vms/${encodeURIComponent(resource.id)}`
  }
  if (resource?.kind === 'project') {
    return `/compute/runtimes/projects/${encodeURIComponent(resource.id)}`
  }
  return code === 'virtualization_connection_unavailable'
    ? '/compute/virtualization/clusters'
    : '/compute/runtimes/hosts'
}

function resourceKindLabel(kind: string, localeCode: 'zh_CN' | 'en_US') {
  if (kind === 'runtime_host') return localeText(localeCode, '运行时主机', 'Runtime host')
  if (kind === 'connection')
    return localeText(localeCode, '虚拟化连接', 'Virtualization connection')
  if (kind === 'vm') return localeText(localeCode, '虚拟机', 'Virtual machine')
  return localeText(localeCode, '计算资源', 'Compute resource')
}

function providerHealthSummary(status: ComputeHealthStatus, localeCode: 'zh_CN' | 'en_US') {
  if (status === 'healthy') return localeText(localeCode, '健康检查通过', 'Health check passed')
  if (status === 'degraded') {
    return localeText(localeCode, '服务降级，请检查连接状态', 'Degraded; check connection status')
  }
  if (status === 'unavailable') {
    return localeText(
      localeCode,
      '当前不可用，请检查接入配置',
      'Unavailable; check access settings',
    )
  }
  if (status === 'pending') {
    return localeText(localeCode, '等待首次健康检查', 'Waiting for the first health check')
  }
  return localeText(localeCode, '尚未获得健康检查结果', 'Health check result unavailable')
}

export function ComputeOverviewPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const canViewVirtualization = [
    'virtualization.overview.view',
    'virtualization.vms.view',
    'virtualization.clusters.view',
    'virtualization.images.view',
    'virtualization.storage.view',
    'virtualization.flavors.view',
    'virtualization.operations.view',
    'virtualization.sync.view',
  ].some((permission) => hasPermission(snapshot, permission))
  const canViewDocker = [
    'docker.overview.view',
    'docker.hosts.view',
    'docker.projects.view',
    'docker.services.view',
    'docker.ports.view',
    'docker.templates.view',
  ].some((permission) => hasPermission(snapshot, permission))
  const canViewTasks =
    hasPermission(snapshot, 'virtualization.operations.view') ||
    hasPermission(snapshot, 'virtualization.sync.view') ||
    hasPermission(snapshot, 'docker.operations.view')
  const canTestProvider = hasPermission(snapshot, 'virtualization.clusters.test')
  const canDiscoverProvider = hasPermission(snapshot, 'virtualization.sync.sync')
  const overviewQuery = useQuery(
    computeQueries.overview(canViewVirtualization || canViewDocker || canViewTasks),
  )
  const overview = overviewQuery.data?.data
  const virtualization = overview?.virtualization
  const agents = overview?.agents
  const runtimes = overview?.runtimes
  const workloads = overview?.runtimeWorkloads
  const tasks = overview?.tasks

  useAIPageContext({
    sourceWorkbench: 'compute',
    sourceTitle: localeText(localeCode, '计算资源工作台', 'Compute Resources'),
    entityKind: 'compute.overview',
    entityName: localeText(localeCode, '计算资源总览', 'Compute overview'),
    pinnedData: overview
      ? {
          partial: overview.partial,
          attentionCount: overview.attention.length,
          resourceRefs: overview.attention
            .flatMap((item) => item.resources ?? [])
            .slice(0, 20)
            .map(({ domain, kind, id, displayName }) => ({ domain, kind, id, displayName })),
          toolRefs: [
            'compute.overview.read',
            'compute.resources.read',
            'compute.resource_relations.list',
            'compute.tasks.list',
          ],
        }
      : undefined,
  })

  const overviewStats = [
    {
      key: 'virtual-machines',
      label: localeText(localeCode, '虚拟机', 'Virtual machines'),
      value: virtualization?.summary?.vmsTotal ?? '-',
      helper: virtualization
        ? localeText(
            localeCode,
            `${virtualization.summary?.vmsRunning ?? 0} 台运行中 / ${virtualization.summary?.vmsStopped ?? 0} 台已停止`,
            `${virtualization.summary?.vmsRunning ?? 0} running / ${virtualization.summary?.vmsStopped ?? 0} stopped`,
          )
        : localeText(localeCode, '当前无虚拟化数据', 'No virtualization data'),
      icon: <DesktopOutlined />,
      tone: statusTone(virtualization?.status),
      path: '/compute/virtualization/vms',
    },
    {
      key: 'runtime-hosts',
      label: localeText(localeCode, '运行时主机', 'Runtime hosts'),
      value: runtimes?.summary?.total ?? '-',
      helper: runtimes
        ? localeText(
            localeCode,
            `${runtimes.summary?.available ?? 0} 台可用 / ${runtimes.summary?.error ?? 0} 台异常`,
            `${runtimes.summary?.available ?? 0} available / ${runtimes.summary?.error ?? 0} unhealthy`,
          )
        : localeText(localeCode, '当前无运行时主机数据', 'No runtime host data'),
      icon: <ClusterOutlined />,
      tone: statusTone(runtimes?.status),
      path: '/compute/runtimes/hosts',
    },
    {
      key: 'containers',
      label: localeText(localeCode, '容器', 'Containers'),
      value: workloads?.summary?.containers ?? '-',
      helper: workloads
        ? localeText(
            localeCode,
            `${workloads.summary?.projects ?? 0} 个项目 / ${workloads.summary?.services ?? 0} 个服务`,
            `${workloads.summary?.projects ?? 0} projects / ${workloads.summary?.services ?? 0} services`,
          )
        : localeText(localeCode, '当前无容器资源数据', 'No container data'),
      icon: <AppstoreOutlined />,
      tone: statusTone(workloads?.status),
      path: '/compute/runtimes/projects',
    },
    {
      key: 'active-tasks',
      label: localeText(localeCode, '活跃任务', 'Active tasks'),
      value: tasks ? (tasks.summary?.queued ?? 0) + (tasks.summary?.running ?? 0) : '-',
      helper: tasks
        ? localeText(
            localeCode,
            `${tasks.summary?.queued ?? 0} 个排队 / ${tasks.summary?.failed ?? 0} 个失败`,
            `${tasks.summary?.queued ?? 0} queued / ${tasks.summary?.failed ?? 0} failed`,
          )
        : localeText(localeCode, '当前无任务数据', 'No task data'),
      icon: <ClockCircleOutlined />,
      tone: statusTone(tasks?.status),
      path: '/compute/tasks/operations',
    },
  ] satisfies NavigableMetricItem[]
  const visibleOverviewStats = overviewStats.filter(({ key }) => {
    if (key === 'virtual-machines') return canViewVirtualization
    if (key === 'active-tasks') return canViewTasks
    return canViewDocker
  })

  const accessStats = [
    {
      key: 'connections',
      label: localeText(localeCode, '虚拟化连接', 'Virtualization connections'),
      value: virtualization?.summary?.connectionsTotal ?? '-',
      helper: virtualization
        ? localeText(
            localeCode,
            `${virtualization.summary?.connectionsHealthy ?? 0} 个健康`,
            `${virtualization.summary?.connectionsHealthy ?? 0} healthy`,
          )
        : localeText(localeCode, '暂无连接数据', 'No connection data'),
      icon: <ApiOutlined />,
      tone: statusTone(virtualization?.status),
      path: '/compute/virtualization/clusters',
    },
    {
      key: 'agents',
      label: localeText(localeCode, 'Agent 主机', 'Agent hosts'),
      value: agents?.summary?.total ?? '-',
      helper: agents
        ? localeText(
            localeCode,
            `${agents.summary?.online ?? 0} 台在线`,
            `${agents.summary?.online ?? 0} online`,
          )
        : localeText(localeCode, '暂无 Agent 数据', 'No Agent data'),
      icon: <ClusterOutlined />,
      tone: statusTone(agents?.status),
      path: '/compute/runtimes/hosts',
    },
    {
      key: 'runtime-hosts',
      label: localeText(localeCode, '运行时主机', 'Runtime hosts'),
      value: runtimes?.summary?.total ?? '-',
      helper: runtimes
        ? localeText(
            localeCode,
            `${runtimes.summary?.available ?? 0} 台可用`,
            `${runtimes.summary?.available ?? 0} available`,
          )
        : localeText(localeCode, '暂无运行时数据', 'No runtime data'),
      icon: <AppstoreOutlined />,
      tone: statusTone(runtimes?.status),
      path: '/compute/runtimes/hosts',
    },
  ] satisfies NavigableChipItem[]
  const visibleAccessStats = accessStats.filter(({ key }) =>
    key === 'connections' ? canViewVirtualization : canViewDocker,
  )

  const taskStats = [
    {
      key: 'queued',
      label: localeText(localeCode, '排队', 'Queued'),
      value: tasks?.summary?.queued ?? '-',
      tone: (tasks?.summary?.queued ?? 0) > 0 ? 'warning' : 'default',
      path: '/compute/tasks/operations?status=queued',
    },
    {
      key: 'running',
      label: localeText(localeCode, '执行中', 'Running'),
      value: tasks?.summary?.running ?? '-',
      tone: (tasks?.summary?.running ?? 0) > 0 ? 'success' : 'default',
      path: '/compute/tasks/operations?status=running',
    },
    {
      key: 'failed',
      label: localeText(localeCode, '失败', 'Failed'),
      value: tasks?.summary?.failed ?? '-',
      tone: (tasks?.summary?.failed ?? 0) > 0 ? 'danger' : 'default',
      path: '/compute/tasks/operations?status=failed',
    },
  ] satisfies NavigableChipItem[]

  return (
    <div className="soha-page soha-overview-page soha-compute-page soha-compute-overview-page">
      {overviewQuery.isError ? (
        <Alert
          action={
            <Button
              aria-label={localeText(localeCode, '重试加载计算资源总览', 'Retry compute overview')}
              size="small"
              onClick={() => void overviewQuery.refetch()}
            >
              {localeText(localeCode, '重试', 'Retry')}
            </Button>
          }
          showIcon
          type="error"
          title={localeText(localeCode, '计算资源总览加载失败', 'Failed to load compute overview')}
        />
      ) : null}
      {overview?.partial ? (
        <Alert
          showIcon
          type="warning"
          title={localeText(
            localeCode,
            '部分资源暂不可用，其余已授权数据仍可查看',
            'Some resources are unavailable. Other authorized data remains visible.',
          )}
        />
      ) : null}
      {overview?.warnings.map((warning) => (
        <Alert key={warning.code} showIcon type="warning" title={warning.message || warning.code} />
      ))}

      <div className="soha-overview-metric-grid">
        {visibleOverviewStats.map(({ key, path, ...item }) => (
          <Link
            aria-label={localeText(
              localeCode,
              `查看${String(item.label)}`,
              `View ${String(item.label)}`,
            )}
            className="soha-overview-card-link"
            key={key}
            to={path}
          >
            <OverviewMetricCard {...item} loading={overviewQuery.isLoading} />
          </Link>
        ))}
      </div>

      <div className="soha-overview-summary-grid">
        <Card
          className="soha-overview-panel-card"
          title={localeText(localeCode, '接入状态', 'Access status')}
        >
          {overviewQuery.isLoading ? (
            <ManagementState bordered={false} compact kind="loading" />
          ) : virtualization || agents || runtimes ? (
            <div className="soha-overview-chip-grid soha-compute-chip-grid">
              {visibleAccessStats.map(({ key, path, ...item }) => (
                <Link
                  aria-label={localeText(
                    localeCode,
                    `查看${String(item.label)}`,
                    `View ${String(item.label)}`,
                  )}
                  className="soha-overview-card-link"
                  key={key}
                  to={path}
                >
                  <OverviewChip {...item} />
                </Link>
              ))}
            </div>
          ) : (
            <ManagementState bordered={false} compact kind="not-configured" />
          )}
        </Card>

        {canViewTasks ? (
          <Card
            className="soha-overview-panel-card"
            title={localeText(localeCode, '任务运行', 'Task activity')}
            extra={
              <Button
                type="text"
                icon={<ArrowRightOutlined />}
                iconPlacement="end"
                onClick={() => navigate('/compute/tasks/operations')}
              >
                {localeText(localeCode, '查看任务', 'View tasks')}
              </Button>
            }
          >
            {overviewQuery.isLoading ? (
              <ManagementState bordered={false} compact kind="loading" />
            ) : tasks ? (
              <div className="soha-overview-chip-grid soha-compute-chip-grid">
                {taskStats.map(({ key, path, ...item }) => (
                  <Link
                    aria-label={localeText(
                      localeCode,
                      `查看${String(item.label)}任务`,
                      `View ${String(item.label)} tasks`,
                    )}
                    className="soha-overview-card-link"
                    key={key}
                    to={path}
                  >
                    <OverviewChip {...item} />
                  </Link>
                ))}
              </div>
            ) : (
              <ManagementState
                bordered={false}
                compact
                kind="empty"
                title={localeText(localeCode, '暂无任务摘要', 'No task summary')}
              />
            )}
          </Card>
        ) : null}
      </div>

      <ProviderInstancesPanel
        canDiscover={canDiscoverProvider}
        canTest={canTestProvider}
        enabled={canViewVirtualization || canViewDocker}
        localeCode={localeCode}
      />

      <div className="soha-overview-runtime-layout">
        <Card
          className="soha-overview-runtime-card"
          title={localeText(localeCode, '需要关注', 'Needs attention')}
        >
          {overviewQuery.isLoading ? (
            <ManagementState bordered={false} compact kind="loading" />
          ) : overview?.attention.length ? (
            <div className="soha-overview-attention-list">
              {overview.attention.map((item, index) => (
                <Link
                  aria-label={localeText(
                    localeCode,
                    `查看${item.resources?.[0]?.displayName || attentionLabel(item.code, item.summary, localeCode)}`,
                    `View ${item.resources?.[0]?.displayName || attentionLabel(item.code, item.summary, localeCode)}`,
                  )}
                  className={`soha-overview-attention-row soha-compute-attention-row soha-compute-overview-link-row is-${item.severity}`}
                  key={`${item.code}:${item.resources?.map((resource) => resource.id).join(',') || index}`}
                  to={attentionTarget(
                    item.code,
                    item.resources?.length === 1 ? item.resources[0] : undefined,
                  )}
                >
                  <div className="soha-overview-attention-main">
                    <Space size={6} wrap>
                      <StatusTag value={item.severity} />
                      <Text strong>
                        {item.resources?.[0]?.displayName ||
                          attentionLabel(item.code, item.summary, localeCode)}
                      </Text>
                    </Space>
                    <div className="soha-overview-inline-caption">
                      {item.resources?.length
                        ? attentionLabel(item.code, item.summary, localeCode)
                        : localeText(
                            localeCode,
                            '查看受影响资源并处理',
                            'Review and resolve the affected resources',
                          )}
                    </div>
                  </div>
                  <div className="soha-overview-attention-meta">
                    {item.resources?.[0] ? (
                      <span>{resourceKindLabel(item.resources[0].kind, localeCode)}</span>
                    ) : null}
                    {item.resources && item.resources.length > 1 ? (
                      <span>
                        {localeText(
                          localeCode,
                          `共 ${item.resources.length} 个资源`,
                          `${item.resources.length} resources`,
                        )}
                      </span>
                    ) : null}
                    <span className="soha-compute-overview-row-action">
                      {localeText(localeCode, '查看详情', 'View details')}
                      <ArrowRightOutlined />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <ManagementState
              bordered={false}
              compact
              kind="empty"
              title={localeText(localeCode, '当前没有待处置风险', 'No risks require action')}
            />
          )}
        </Card>

        <Card
          className="soha-overview-runtime-card"
          title={localeText(localeCode, '提供方健康', 'Provider health')}
        >
          {overviewQuery.isLoading ? (
            <ManagementState bordered={false} compact kind="loading" />
          ) : overview?.providerHealth.length ? (
            <div className="soha-overview-attention-list">
              {overview.providerHealth.map((provider) => (
                <Link
                  aria-label={localeText(
                    localeCode,
                    `查看 ${provider.providerKey} 提供方`,
                    `View ${provider.providerKey} provider`,
                  )}
                  className="soha-overview-attention-row soha-compute-overview-link-row"
                  key={`${provider.domain}:${provider.providerKey}`}
                  to={
                    provider.domain === 'container_runtime'
                      ? '/compute/runtimes/hosts'
                      : '/compute/virtualization/clusters'
                  }
                >
                  <div className="soha-overview-attention-main">
                    <Space size={6} wrap>
                      <Text strong>{provider.providerKey}</Text>
                      <StatusTag value={provider.status} />
                    </Space>
                    <div className="soha-overview-inline-caption">
                      {providerHealthSummary(provider.status, localeCode)}
                    </div>
                  </div>
                  <div className="soha-overview-attention-meta">
                    <span>{providerDomainLabel(provider.domain, localeCode)}</span>
                    {provider.checkedAt ? (
                      <span>
                        {localeText(localeCode, '最近检查', 'Last checked')}{' '}
                        {formatDateTime(provider.checkedAt)}
                      </span>
                    ) : null}
                    <span className="soha-compute-overview-row-action">
                      {provider.domain === 'container_runtime'
                        ? localeText(localeCode, '查看主机', 'View hosts')
                        : localeText(localeCode, '查看连接', 'View connections')}
                      <ArrowRightOutlined />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <ManagementState
              bordered={false}
              compact
              kind="empty"
              title={localeText(localeCode, '暂无提供方状态', 'No provider status')}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
