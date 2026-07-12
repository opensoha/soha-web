import { useMemo, useState } from 'react'
import { DeleteOutlined } from '@ant-design/icons'
import { Popconfirm, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import { AdminTable } from '@/components/admin-table'
import { ManagementIconButton, ManagementTableToolbar } from '@/components/management-list'
import { TABLE_ACTIONS_COLUMN_CLASS_NAME } from '@/components/resource-actions'
import { hasAllowedAction } from '@/features/auth'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { includesSearch, normalizeSearchKeyword } from '@/features/platform/workloads-model'
import { useClusterCapability } from '@/features/platform/cluster-capabilities'
import {
  useWorkloadTableDensity,
  WorkloadQueryPanel,
  WorkloadRefreshButton,
  WorkloadSearchInput,
  WorkloadTableEmpty,
  WorkloadTableSummary,
} from './list-controls'
import { workloadMutations } from './mutations'
import { workloadQueries } from './queries'
import type { WorkloadKind } from './types'

export interface ReplicaControllerRecord {
  ageSeconds: number
  allowedActions?: string[]
  name: string
  namespace: string
}

export function ReplicaControllerListPage<T extends ReplicaControllerRecord>({
  columns,
  kind,
  label,
}: {
  columns: TableColumnsType<T>
  kind: Extract<WorkloadKind, 'replicasets' | 'replicationcontrollers'>
  label: string
}) {
  const { localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const scope = toScopeKey(clusterId, namespace)
  const queryClient = useQueryClient()
  const listQuery = useQuery(workloadQueries.list<T>(kind, scope))
  const removeMutation = useMutation(workloadMutations.remove(kind, queryClient))
  const capability = useClusterCapability('workload.mutations', localeCode)
  const [searchKeyword, setSearchKeyword] = useState('')
  const normalizedKeyword = normalizeSearchKeyword(searchKeyword)
  const { densityButton, tableSize } = useWorkloadTableDensity(localeCode)
  const records = listQuery.data ?? []
  const filteredRecords = useMemo(
    () =>
      records.filter((record) =>
        includesSearch([record.name, record.namespace], normalizedKeyword),
      ),
    [normalizedKeyword, records],
  )
  const canShowActions = records.some((record) => hasAllowedAction(record.allowedActions, 'delete'))
  const actionColumn: TableColumnsType<T>[number] = {
    fixed: 'right',
    title: '',
    dataIndex: 'name',
    key: 'actions',
    width: 64,
    align: 'center',
    className: TABLE_ACTIONS_COLUMN_CLASS_NAME,
    render: (name: string, record: T) => {
      if (!hasAllowedAction(record.allowedActions, 'delete')) return '-'
      const target = { scope: toScopeKey(clusterId, record.namespace), name }
      const pending =
        removeMutation.isPending &&
        removeMutation.variables?.name === name &&
        removeMutation.variables.scope.namespace === record.namespace
      const deleteLabel = localeCode === 'zh_CN' ? '删除' : 'Delete'
      if (capability.disabled) {
        return (
          <ManagementIconButton
            danger
            disabled
            icon={<DeleteOutlined />}
            aria-label={deleteLabel}
            tooltip={capability.reason || deleteLabel}
          />
        )
      }
      return (
        <Popconfirm
          title={localeCode === 'zh_CN' ? `确认删除 ${name}？` : `Delete ${name}?`}
          okText={deleteLabel}
          cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
          okButtonProps={{ danger: true, loading: pending }}
          onConfirm={() =>
            removeMutation.mutate(target, {
              onSuccess: () => void message.success(localeCode === 'zh_CN' ? '已删除' : 'Deleted'),
              onError: (error) => void message.error(error.message),
            })
          }
        >
          <ManagementIconButton
            danger
            icon={<DeleteOutlined />}
            aria-label={deleteLabel}
            loading={pending}
            tooltip={deleteLabel}
          />
        </Popconfirm>
      )
    },
  }

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
            localeCode === 'zh_CN' ? `搜索 ${label} / Namespace` : `Search ${label} / namespace`
          }
        />
      </WorkloadQueryPanel>
      <AdminTable
        className="soha-workload-replica-table soha-platform-table"
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        columns={canShowActions ? [...columns, actionColumn] : columns}
        dataSource={clusterId ? filteredRecords : []}
        rowKey={(record) => `${record.namespace}/${record.name}`}
        loading={listQuery.isLoading}
        paginationSummary={
          <WorkloadTableSummary
            filteredCount={filteredRecords.length}
            localeCode={localeCode}
            totalCount={records.length}
          />
        }
        empty={
          <WorkloadTableEmpty
            clusterId={clusterId}
            filteredCount={filteredRecords.length}
            localeCode={localeCode}
            resourceLabel={label}
            totalCount={records.length}
          />
        }
        pageSize={10}
        tableSize={tableSize}
        scroll={{ x: 'max-content' }}
        headerExtra={
          <ManagementTableToolbar>
            {densityButton}
            <WorkloadRefreshButton
              disabled={!clusterId}
              label={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              loading={listQuery.isFetching}
              onRefresh={() => void listQuery.refetch()}
            />
          </ManagementTableToolbar>
        }
      />
    </div>
  )
}
