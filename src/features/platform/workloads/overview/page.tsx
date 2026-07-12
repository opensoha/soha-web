import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  ScheduleOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import { AdminTable } from '@/components/admin-table'
import { ManagementState, ManagementTableToolbar } from '@/components/management-list'
import { OverviewMetricCard, type OverviewMetricItem } from '@/components/overview-visuals'
import { StatusTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import {
  useWorkloadTableDensity,
  WorkloadRefreshButton,
  WorkloadTableEmpty,
  WorkloadTableSummary,
} from '../shared/list-controls'
import { workloadQueries } from '../shared/queries'
import type { WorkloadEvent } from '../shared/types'
import { workloadOverviewQueries } from './queries'
import '@/features/platform/workloads/styles.css'

export function WorkloadsOverviewPage() {
  const { t, localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const scope = toScopeKey(clusterId, namespace)
  const deploymentsQuery = useQuery(workloadQueries.list<unknown>('deployments', scope))
  const podsQuery = useQuery(workloadQueries.list<unknown>('pods', scope))
  const statefulSetsQuery = useQuery(workloadQueries.list<unknown>('statefulsets', scope))
  const daemonSetsQuery = useQuery(workloadQueries.list<unknown>('daemonsets', scope))
  const jobsQuery = useQuery(workloadQueries.list<unknown>('jobs', scope))
  const cronJobsQuery = useQuery(workloadQueries.list<unknown>('cronjobs', scope))
  const eventsQuery = useQuery(workloadOverviewQueries.events(scope))
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

  const stats = [
    {
      key: 'deployments',
      label: 'Deployments',
      helper: localeCode === 'zh_CN' ? '无状态应用副本控制面' : 'Stateless application controllers',
      value: deploymentsQuery.data?.length ?? 0,
      icon: <AppstoreOutlined />,
      tone: 'default',
    },
    {
      key: 'pods',
      label: 'Pods',
      helper: localeCode === 'zh_CN' ? '当前范围内运行实例' : 'Runtime instances in scope',
      value: podsQuery.data?.length ?? 0,
      icon: <ClusterOutlined />,
      tone: 'success',
    },
    {
      key: 'statefulsets',
      label: 'StatefulSets',
      helper: localeCode === 'zh_CN' ? '有状态服务控制面' : 'Stateful service controllers',
      value: statefulSetsQuery.data?.length ?? 0,
      icon: <CheckCircleOutlined />,
      tone: 'default',
    },
    {
      key: 'daemonsets',
      label: 'DaemonSets',
      helper: localeCode === 'zh_CN' ? '节点级守护进程' : 'Node-level daemon workloads',
      value: daemonSetsQuery.data?.length ?? 0,
      icon: <ClusterOutlined />,
      tone: 'default',
    },
    {
      key: 'jobs',
      label: 'Jobs',
      helper: localeCode === 'zh_CN' ? '一次性任务资源' : 'One-off workload runs',
      value: jobsQuery.data?.length ?? 0,
      icon: <ClockCircleOutlined />,
      tone: 'default',
    },
    {
      key: 'cronjobs',
      label: 'CronJobs',
      helper: localeCode === 'zh_CN' ? '周期调度任务' : 'Scheduled workload runs',
      value: cronJobsQuery.data?.length ?? 0,
      icon: <ScheduleOutlined />,
      tone: 'default',
    },
  ] satisfies OverviewMetricItem[]

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
      render: (_: string, record: WorkloadEvent) =>
        `${record.involvedKind || '-'} / ${record.involvedName || '-'}`,
    },
    { title: localeCode === 'zh_CN' ? '消息' : 'Message', dataIndex: 'message', ellipsis: true },
    { title: localeCode === 'zh_CN' ? '次数' : 'Count', dataIndex: 'count' },
    {
      ...tableColumnPresets.datetime,
      title: 'Age',
      dataIndex: 'ageSeconds',
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  const events = eventsQuery.data ?? []

  return (
    <div className="soha-page soha-overview-page soha-workloads-overview-page">
      <div className="soha-overview-metric-grid soha-workload-overview-metric-grid">
        {stats.map((item) => (
          <OverviewMetricCard
            key={item.key}
            label={item.label}
            value={item.value}
            helper={item.helper}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </div>
      <AdminTable
        className="soha-workload-overview-events soha-platform-table"
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        headerExtra={
          <ManagementTableToolbar>
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
        rowKey={(record) => `${record.namespace || ''}/${record.name}`}
        loading={eventsQuery.isLoading}
        paginationSummary={
          <WorkloadTableSummary
            filteredCount={events.length}
            localeCode={localeCode}
            totalCount={events.length}
          />
        }
        empty={
          <WorkloadTableEmpty
            clusterId={clusterId}
            filteredCount={events.length}
            localeCode={localeCode}
            resourceLabel={localeCode === 'zh_CN' ? '事件记录' : 'event records'}
            totalCount={events.length}
          />
        }
        pageSize={10}
        tableSize={tableSize}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}
