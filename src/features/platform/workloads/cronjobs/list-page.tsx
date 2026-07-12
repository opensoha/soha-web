import { useMemo, useState } from 'react'
import { DeleteOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { App, Popconfirm, Space } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { TableColumnsType } from 'antd'
import { AdminTable } from '@/components/admin-table'
import { ManagementIconButton, ManagementTableToolbar } from '@/components/management-list'
import { BooleanTag } from '@/components/status-tag'
import { hasAllowedAction } from '@/features/auth'
import { useI18n } from '@/i18n'
import {
  capabilityActionTooltip,
  useClusterCapability,
} from '@/features/platform/cluster-capabilities'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds, formatRelativeTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import {
  buildWorkloadDetailPath,
  includesSearch,
  normalizeSearchKeyword,
} from '@/features/platform/workloads-model'
import {
  renderWorkloadNameLink,
  useWorkloadTableDensity,
  WorkloadQueryPanel,
  WorkloadRefreshButton,
  WorkloadSearchInput,
  WorkloadTableEmpty,
  WorkloadTableSummary,
} from '@/features/platform/workloads/shared/list-controls'
import { cronJobMutations } from './mutations'
import { cronJobQueries } from './queries'
import type { CronJob, CronJobTarget } from './types'
import '@/features/platform/workloads/styles.css'

export function WorkloadsCronJobsPage() {
  const { t, localeCode } = useI18n()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clusterId, namespace } = usePlatformScopeStore()
  const cronJobsQuery = useQuery(cronJobQueries.list(toScopeKey(clusterId, namespace)))
  const suspendMutation = useMutation(cronJobMutations.suspend(queryClient))
  const removeMutation = useMutation(cronJobMutations.remove(queryClient))
  const [searchKeyword, setSearchKeyword] = useState('')
  const { densityButton, tableSize } = useWorkloadTableDensity(localeCode)
  const workloadMutationCapability = useClusterCapability('workload.mutations', localeCode)

  const cronJobs = cronJobsQuery.data ?? []
  const filteredCronJobs = useMemo(
    () =>
      cronJobs.filter((item) =>
        includesSearch(
          [item.name, item.namespace, item.schedule],
          normalizeSearchKeyword(searchKeyword),
        ),
      ),
    [cronJobs, searchKeyword],
  )

  const targetFor = (name: string, targetNamespace: string): CronJobTarget => ({
    scope: toScopeKey(clusterId, targetNamespace),
    name,
  })

  const columns: TableColumnsType<CronJob> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      width: 260,
      ellipsis: { showTitle: false },
      render: (name: string, record: CronJob) =>
        renderWorkloadNameLink(name, () =>
          navigate(buildWorkloadDetailPath('cronjobs', name, namespace, record.namespace)),
        ),
    },
    { title: t('common.namespace', 'Namespace'), dataIndex: 'namespace', width: 160 },
    { title: 'Schedule', dataIndex: 'schedule', width: 180 },
    {
      ...tableColumnPresets.status,
      title: localeCode === 'zh_CN' ? '暂停' : 'Suspend',
      dataIndex: 'suspend',
      width: 96,
      render: (suspend: boolean) => (
        <BooleanTag
          value={suspend}
          trueLabel="Yes"
          falseLabel="No"
          trueColor="orange"
          falseColor="green"
        />
      ),
    },
    { title: 'Active', dataIndex: 'activeJobs', width: 88 },
    {
      ...tableColumnPresets.datetime,
      title: localeCode === 'zh_CN' ? '上次调度' : 'Last Schedule',
      dataIndex: 'lastScheduleTime',
      width: 140,
      render: (value: string) => (value ? formatRelativeTime(value) : '-'),
    },
    {
      ...tableColumnPresets.datetime,
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
    {
      title: '',
      dataIndex: 'name',
      key: 'actions',
      fixed: 'right',
      align: 'center',
      width: 96,
      render: (name: string, record: CronJob) => {
        const target = targetFor(name, record.namespace)
        const actionLabel = record.suspend
          ? localeCode === 'zh_CN'
            ? '恢复'
            : 'Resume'
          : localeCode === 'zh_CN'
            ? '暂停'
            : 'Suspend'
        const suspendDisabled =
          workloadMutationCapability.disabled || !hasAllowedAction(record.allowedActions, 'update')
        const suspendPending =
          suspendMutation.isPending &&
          suspendMutation.variables?.name === name &&
          suspendMutation.variables.scope.namespace === record.namespace
        const removePending =
          removeMutation.isPending &&
          removeMutation.variables?.name === name &&
          removeMutation.variables.scope.namespace === record.namespace
        const canDelete = hasAllowedAction(record.allowedActions, 'delete')
        const deleteLabel = localeCode === 'zh_CN' ? '删除' : 'Delete'

        return (
          <Space size={4} className="soha-deployment-action-cell">
            <Popconfirm
              title={
                record.suspend
                  ? localeCode === 'zh_CN'
                    ? `恢复 ${name}？`
                    : `Resume ${name}?`
                  : localeCode === 'zh_CN'
                    ? `暂停 ${name}？`
                    : `Suspend ${name}?`
              }
              okText={localeCode === 'zh_CN' ? '确认' : 'OK'}
              cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
              disabled={suspendDisabled}
              onConfirm={() =>
                suspendMutation.mutate(
                  { ...target, suspend: !record.suspend },
                  {
                    onSuccess: () =>
                      void message.success(
                        localeCode === 'zh_CN' ? '已更新定时任务状态' : 'CronJob updated',
                      ),
                    onError: (error) => void message.error(error.message),
                  },
                )
              }
            >
              <ManagementIconButton
                disabled={suspendDisabled}
                icon={record.suspend ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                aria-label={actionLabel}
                loading={suspendPending}
                tooltip={
                  suspendDisabled
                    ? capabilityActionTooltip(actionLabel, workloadMutationCapability)
                    : actionLabel
                }
              />
            </Popconfirm>
            {canDelete && workloadMutationCapability.disabled ? (
              <ManagementIconButton
                danger
                disabled
                icon={<DeleteOutlined />}
                aria-label={deleteLabel}
                tooltip={capabilityActionTooltip(deleteLabel, workloadMutationCapability)}
              />
            ) : null}
            {canDelete && !workloadMutationCapability.disabled ? (
              <Popconfirm
                title={localeCode === 'zh_CN' ? `确认删除 ${name}？` : `Delete ${name}?`}
                description={
                  localeCode === 'zh_CN'
                    ? '此操作不可恢复，删除后集群资源立即消失。'
                    : 'This deletes the resource immediately and cannot be undone.'
                }
                okText={deleteLabel}
                cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
                okButtonProps={{ danger: true, loading: removePending }}
                placement="topRight"
                onConfirm={() =>
                  removeMutation.mutate(target, {
                    onSuccess: () =>
                      void message.success(localeCode === 'zh_CN' ? '已删除' : 'Deleted'),
                    onError: (error) => void message.error(error.message),
                  })
                }
              >
                <ManagementIconButton
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={deleteLabel}
                  loading={removePending}
                  tooltip={deleteLabel}
                />
              </Popconfirm>
            ) : null}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="soha-page">
      <WorkloadQueryPanel
        hasActiveFilters={Boolean(searchKeyword.trim())}
        localeCode={localeCode}
        onReset={() => setSearchKeyword('')}
      >
        <WorkloadSearchInput
          label={localeCode === 'zh_CN' ? '关键词' : 'Keyword'}
          value={searchKeyword}
          onChange={setSearchKeyword}
          placeholder={
            localeCode === 'zh_CN'
              ? '搜索 CronJob / Namespace / Schedule'
              : 'Search cron job / namespace / schedule'
          }
        />
      </WorkloadQueryPanel>
      <AdminTable
        className="soha-cronjobs-table soha-platform-table"
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        headerExtra={
          <ManagementTableToolbar>
            {densityButton}
            <WorkloadRefreshButton
              disabled={!clusterId}
              label={t('common.refresh', 'Refresh')}
              loading={cronJobsQuery.isFetching}
              onRefresh={() => void cronJobsQuery.refetch()}
            />
          </ManagementTableToolbar>
        }
        columns={columns}
        dataSource={filteredCronJobs}
        rowKey={(record) => `${record.namespace}/${record.name}`}
        loading={cronJobsQuery.isLoading}
        paginationSummary={
          <WorkloadTableSummary
            filteredCount={filteredCronJobs.length}
            localeCode={localeCode}
            totalCount={cronJobs.length}
          />
        }
        empty={
          <WorkloadTableEmpty
            clusterId={clusterId}
            filteredCount={filteredCronJobs.length}
            localeCode={localeCode}
            resourceLabel="CronJobs"
            totalCount={cronJobs.length}
          />
        }
        tableSize={tableSize}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}
