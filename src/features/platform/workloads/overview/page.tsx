import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  ScheduleOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import { Link } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementState, ManagementTableToolbar } from '@/components/management-list'
import { OverviewMetricCard, type OverviewMetricItem } from '@/components/overview-visuals'
import { StatusTag } from '@/components/status-tag'
import { TableCellText } from '@/components/table-cell-content'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { K8S_TABLE_PAGE_SIZE } from '@/features/platform/shared/table-config'
import { buildKubernetesEventResourcePath } from '@/features/platform/shared/resource-ref'
import { ResourceStreamStatus } from '@/features/platform/shared/resource-stream-status'
import { useKubernetesResourceStream } from '@/features/platform/shared/resource-stream'
import { SecurityPosturePanel } from '@/features/platform/shared/resource-insights/security-posture-panel'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { buildWorkloadListPagePath } from '@/features/platform/workloads-model'
import {
  useWorkloadTableDensity,
  WorkloadRefreshButton,
  WorkloadTableEmpty,
} from '../shared/list-controls'
import { workloadQueries } from '../shared/queries'
import type { WorkloadEvent } from '../shared/types'
import { workloadOverviewQueries } from './queries'
import '@/features/platform/workloads/styles.css'

type WorkloadOverviewMetricItem = OverviewMetricItem & { path: string }

export function WorkloadsOverviewPage() {
  const { t, localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const scope = toScopeKey(clusterId, namespace)
  const permissionSnapshot = usePermissionSnapshot().data?.data
  const workloadPermissions: Record<string, boolean> = {
    deployments: hasPermission(permissionSnapshot, 'platform.deployment.view'),
    pods: hasPermission(permissionSnapshot, 'platform.pods.view'),
    statefulsets: hasPermission(permissionSnapshot, 'platform.workloads.stateful-sets.view'),
    daemonsets: hasPermission(permissionSnapshot, 'platform.workloads.daemon-sets.view'),
    jobs: hasPermission(permissionSnapshot, 'platform.workloads.jobs.view'),
    cronjobs: hasPermission(permissionSnapshot, 'platform.workloads.cron-jobs.view'),
  }
  const deploymentsQuery = useQuery({
    ...workloadQueries.list<unknown>('deployments', scope),
    enabled: Boolean(clusterId) && workloadPermissions.deployments,
  })
  const podsQuery = useQuery({
    ...workloadQueries.list<unknown>('pods', scope),
    enabled: Boolean(clusterId) && workloadPermissions.pods,
  })
  const statefulSetsQuery = useQuery({
    ...workloadQueries.list<unknown>('statefulsets', scope),
    enabled: Boolean(clusterId) && workloadPermissions.statefulsets,
  })
  const daemonSetsQuery = useQuery({
    ...workloadQueries.list<unknown>('daemonsets', scope),
    enabled: Boolean(clusterId) && workloadPermissions.daemonsets,
  })
  const jobsQuery = useQuery({
    ...workloadQueries.list<unknown>('jobs', scope),
    enabled: Boolean(clusterId) && workloadPermissions.jobs,
  })
  const cronJobsQuery = useQuery({
    ...workloadQueries.list<unknown>('cronjobs', scope),
    enabled: Boolean(clusterId) && workloadPermissions.cronjobs,
  })
  const eventsQuery = useQuery({
    ...workloadOverviewQueries.events(scope),
    enabled:
      Boolean(clusterId) && hasPermission(permissionSnapshot, 'platform.workloads.overview.view'),
  })
  const refreshOverview = () => {
    void deploymentsQuery.refetch()
    void podsQuery.refetch()
    void statefulSetsQuery.refetch()
    void daemonSetsQuery.refetch()
    void jobsQuery.refetch()
    void cronJobsQuery.refetch()
    void eventsQuery.refetch()
  }
  const workloadStream = useKubernetesResourceStream({
    clusterId,
    namespace,
    kinds: ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'Pod', 'Event'],
    onEvent: refreshOverview,
    onFallback: refreshOverview,
    onResyncRequired: refreshOverview,
  })
  const { densityButton, tableSize } = useWorkloadTableDensity(localeCode)

  if (!clusterId) {
    return (
      <div className="soha-page soha-overview-page soha-workloads-overview-page">
        <ManagementState
          compact
          kind="select-scope"
          title={t('common.pleaseSelectClusterShort', 'Select a cluster')}
        />
      </div>
    )
  }

  const stats = (
    [
      {
        key: 'deployments',
        label: 'Deployments',
        helper:
          localeCode === 'zh_CN' ? '无状态应用副本控制面' : 'Stateless application controllers',
        value: deploymentsQuery.data?.length ?? 0,
        icon: <AppstoreOutlined />,
        tone: 'default',
        path: buildWorkloadListPagePath('deployments', namespace, clusterId),
      },
      {
        key: 'pods',
        label: 'Pods',
        helper: localeCode === 'zh_CN' ? '当前范围内运行实例' : 'Runtime instances in scope',
        value: podsQuery.data?.length ?? 0,
        icon: <ClusterOutlined />,
        tone: 'success',
        path: buildWorkloadListPagePath('pods', namespace, clusterId),
      },
      {
        key: 'statefulsets',
        label: 'StatefulSets',
        helper: localeCode === 'zh_CN' ? '有状态服务控制面' : 'Stateful service controllers',
        value: statefulSetsQuery.data?.length ?? 0,
        icon: <CheckCircleOutlined />,
        tone: 'default',
        path: buildWorkloadListPagePath('statefulsets', namespace, clusterId),
      },
      {
        key: 'daemonsets',
        label: 'DaemonSets',
        helper: localeCode === 'zh_CN' ? '节点级守护进程' : 'Node-level daemon workloads',
        value: daemonSetsQuery.data?.length ?? 0,
        icon: <ClusterOutlined />,
        tone: 'default',
        path: buildWorkloadListPagePath('daemonsets', namespace, clusterId),
      },
      {
        key: 'jobs',
        label: 'Jobs',
        helper: localeCode === 'zh_CN' ? '一次性任务资源' : 'One-off workload runs',
        value: jobsQuery.data?.length ?? 0,
        icon: <ClockCircleOutlined />,
        tone: 'default',
        path: buildWorkloadListPagePath('jobs', namespace, clusterId),
      },
      {
        key: 'cronjobs',
        label: 'CronJobs',
        helper: localeCode === 'zh_CN' ? '周期调度任务' : 'Scheduled workload runs',
        value: cronJobsQuery.data?.length ?? 0,
        icon: <ScheduleOutlined />,
        tone: 'default',
        path: buildWorkloadListPagePath('cronjobs', namespace, clusterId),
      },
    ] satisfies WorkloadOverviewMetricItem[]
  ).filter((item) => workloadPermissions[item.key])

  const eventColumns: TableColumnsType<WorkloadEvent> = [
    {
      title: t('common.namespace', 'Namespace'),
      dataIndex: 'namespace',
      render: (value: string) => value || '-',
    },
    {
      title: localeCode === 'zh_CN' ? '类型' : 'Type',
      dataIndex: 'type',
      render: (value: string) => <StatusTag value={value} />,
    },
    { title: localeCode === 'zh_CN' ? '原因' : 'Reason', dataIndex: 'reason' },
    {
      title: localeCode === 'zh_CN' ? '对象' : 'Object',
      dataIndex: 'involvedName',
      render: (_: string, record: WorkloadEvent) => {
        const label = `${record.involvedKind || '-'} / ${record.involvedName || '-'}`
        const path = buildKubernetesEventResourcePath(record, clusterId)
        return path ? (
          <Link className="soha-workload-overview-event-link" to={path}>
            {label}
          </Link>
        ) : (
          label
        )
      },
    },
    {
      title: localeCode === 'zh_CN' ? '消息' : 'Message',
      dataIndex: 'message',
      ellipsis: { showTitle: false },
      render: (value?: string) => <TableCellText value={value} />,
    },
    { title: localeCode === 'zh_CN' ? '次数' : 'Count', dataIndex: 'count' },
    {
      ...tableColumnPresets.datetime,
      title: localeCode === 'zh_CN' ? '时长' : 'Age',
      dataIndex: 'ageSeconds',
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  const events = eventsQuery.data ?? []

  return (
    <div className="soha-page soha-overview-page soha-workloads-overview-page">
      <div className="soha-overview-metric-grid soha-workload-overview-metric-grid">
        {stats.map((item) => (
          <Link
            key={item.key}
            aria-label={`${localeCode === 'zh_CN' ? '查看' : 'Open'} ${item.label}`}
            className="soha-workload-overview-metric-link"
            to={item.path}
          >
            <OverviewMetricCard
              label={item.label}
              value={item.value}
              helper={item.helper}
              icon={item.icon}
              tone={item.tone}
            />
          </Link>
        ))}
      </div>
      <SecurityPosturePanel scope={scope} />
      <AdminTable
        className="soha-workload-overview-events soha-platform-table"
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        headerExtra={
          <ManagementTableToolbar>
            <ResourceStreamStatus
              status={workloadStream.status}
              lastEventAt={workloadStream.lastEventAt}
              localeCode={localeCode}
            />
            {densityButton}
            <WorkloadRefreshButton
              disabled={!clusterId}
              label={t('common.refresh', 'Refresh')}
              loading={eventsQuery.isFetching}
              onRefresh={() => void eventsQuery.refetch()}
            />
          </ManagementTableToolbar>
        }
        columns={eventColumns}
        dataSource={events}
        localSorting
        rowKey={(record) => `${record.namespace || ''}/${record.name}`}
        loading={eventsQuery.isLoading}
        empty={
          <WorkloadTableEmpty
            clusterId={clusterId}
            filteredCount={events.length}
            localeCode={localeCode}
            resourceLabel={localeCode === 'zh_CN' ? '事件记录' : 'event records'}
            totalCount={events.length}
          />
        }
        pageSize={K8S_TABLE_PAGE_SIZE}
        tableSize={tableSize}
        scroll={{ x: 'max-content' }}
        viewportScroll
      />
    </div>
  )
}
