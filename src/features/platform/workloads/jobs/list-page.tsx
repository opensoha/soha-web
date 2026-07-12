import { useMemo, useState } from 'react'
import { DeleteOutlined } from '@ant-design/icons'
import { App, Popconfirm } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { TableColumnsType } from 'antd'
import { AdminTable } from '@/components/admin-table'
import { ManagementIconButton, ManagementTableToolbar } from '@/components/management-list'
import { hasAllowedAction } from '@/features/auth'
import { useI18n } from '@/i18n'
import {
  capabilityActionTooltip,
  useClusterCapability,
} from '@/features/platform/cluster-capabilities'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
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
import { jobMutations } from './mutations'
import { jobQueries } from './queries'
import type { Job, JobTarget } from './types'
import '@/features/platform/workloads/styles.css'

export function WorkloadsJobsPage() {
  const { t, localeCode } = useI18n()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clusterId, namespace } = usePlatformScopeStore()
  const jobsQuery = useQuery(jobQueries.list(toScopeKey(clusterId, namespace)))
  const removeMutation = useMutation(jobMutations.remove(queryClient))
  const [searchKeyword, setSearchKeyword] = useState('')
  const { densityButton, tableSize } = useWorkloadTableDensity(localeCode)
  const workloadMutationCapability = useClusterCapability('workload.mutations', localeCode)

  const jobs = jobsQuery.data ?? []
  const filteredJobs = useMemo(
    () =>
      jobs.filter((item) =>
        includesSearch(
          [item.name, item.namespace, item.completionMode],
          normalizeSearchKeyword(searchKeyword),
        ),
      ),
    [jobs, searchKeyword],
  )

  const remove = (target: JobTarget) =>
    removeMutation.mutate(target, {
      onSuccess: () => void message.success(localeCode === 'zh_CN' ? '已删除' : 'Deleted'),
      onError: (error) => void message.error(error.message),
    })

  const columns: TableColumnsType<Job> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      width: 260,
      ellipsis: { showTitle: false },
      render: (name: string, record: Job) =>
        renderWorkloadNameLink(name, () =>
          navigate(buildWorkloadDetailPath('jobs', name, namespace, record.namespace)),
        ),
    },
    { title: t('common.namespace', 'Namespace'), dataIndex: 'namespace', width: 160 },
    { title: 'Completions', dataIndex: 'completions', width: 120 },
    { title: 'Succeeded', dataIndex: 'succeeded', width: 104 },
    { title: 'Failed', dataIndex: 'failed', width: 88 },
    { title: 'Active', dataIndex: 'active', width: 88 },
    {
      title: 'Mode',
      dataIndex: 'completionMode',
      width: 140,
      render: (value: string) => value || '-',
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
      width: 52,
      render: (name: string, record: Job) => {
        if (!hasAllowedAction(record.allowedActions, 'delete')) return null
        const target = { scope: toScopeKey(clusterId, record.namespace), name }
        const pending =
          removeMutation.isPending &&
          removeMutation.variables?.name === name &&
          removeMutation.variables.scope.namespace === record.namespace
        const label = localeCode === 'zh_CN' ? '删除' : 'Delete'
        if (workloadMutationCapability.disabled) {
          return (
            <ManagementIconButton
              danger
              disabled
              icon={<DeleteOutlined />}
              aria-label={label}
              tooltip={capabilityActionTooltip(label, workloadMutationCapability)}
            />
          )
        }
        return (
          <Popconfirm
            title={localeCode === 'zh_CN' ? `确认删除 ${name}？` : `Delete ${name}?`}
            description={
              localeCode === 'zh_CN'
                ? '此操作不可恢复，删除后集群资源立即消失。'
                : 'This deletes the resource immediately and cannot be undone.'
            }
            okText={label}
            cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
            okButtonProps={{ danger: true, loading: pending }}
            placement="topRight"
            onConfirm={() => remove(target)}
          >
            <ManagementIconButton
              danger
              icon={<DeleteOutlined />}
              aria-label={label}
              loading={pending}
              tooltip={label}
            />
          </Popconfirm>
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
            localeCode === 'zh_CN' ? '搜索 Job / Namespace / Mode' : 'Search job / namespace / mode'
          }
        />
      </WorkloadQueryPanel>
      <AdminTable
        className="soha-jobs-table soha-platform-table"
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        headerExtra={
          <ManagementTableToolbar>
            {densityButton}
            <WorkloadRefreshButton
              disabled={!clusterId}
              label={t('common.refresh', 'Refresh')}
              loading={jobsQuery.isFetching}
              onRefresh={() => void jobsQuery.refetch()}
            />
          </ManagementTableToolbar>
        }
        columns={columns}
        dataSource={filteredJobs}
        rowKey={(record) => `${record.namespace}/${record.name}`}
        loading={jobsQuery.isLoading}
        paginationSummary={
          <WorkloadTableSummary
            filteredCount={filteredJobs.length}
            localeCode={localeCode}
            totalCount={jobs.length}
          />
        }
        empty={
          <WorkloadTableEmpty
            clusterId={clusterId}
            filteredCount={filteredJobs.length}
            localeCode={localeCode}
            resourceLabel="Jobs"
            totalCount={jobs.length}
          />
        }
        tableSize={tableSize}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}
