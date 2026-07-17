import { useMemo, useState } from 'react'
import { Popconfirm, Space, message } from 'antd'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { TableColumnsType } from 'antd'
import { AdminTable } from '@/components/admin-table'
import { ManagementIconButton, ManagementTableToolbar } from '@/components/management-list'
import { WorkloadCreateEntry } from '../shared/create-entry'
import { TABLE_ACTIONS_COLUMN_CLASS_NAME } from '@/components/resource-actions'
import { hasAllowedAction } from '@/features/auth'
import {
  capabilityActionTooltip,
  useClusterCapability,
} from '@/features/platform/cluster-capabilities'
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
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { daemonSetMutations } from './mutations'
import { daemonSetQueries } from './queries'
import type { DaemonSet, DaemonSetTarget } from './types'
import '@/features/platform/workloads/styles.css'

const WORKLOAD_ACTIONS_COLUMN_CLASS_NAME = `${TABLE_ACTIONS_COLUMN_CLASS_NAME} soha-workload-actions-column`

function isTargetMutationPending(
  mutation: { isPending: boolean; variables?: DaemonSetTarget },
  name: string,
  namespace: string,
) {
  return (
    mutation.isPending &&
    mutation.variables?.name === name &&
    mutation.variables.scope.namespace === namespace
  )
}

export function WorkloadsDaemonSetsPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clusterId, namespace } = usePlatformScopeStore()
  const listScope = toScopeKey(clusterId, namespace)
  const daemonSetsQuery = useQuery(daemonSetQueries.list(listScope))
  const restartMutation = useMutation(daemonSetMutations.restart(queryClient))
  const deleteMutation = useMutation(daemonSetMutations.remove(queryClient))
  const [searchKeyword, setSearchKeyword] = useState('')
  const { densityButton, tableSize } = useWorkloadTableDensity(localeCode)
  const workloadMutationCapability = useClusterCapability('workload.mutations', localeCode)

  const daemonSets = daemonSetsQuery.data ?? []
  const targetFor = (name: string, targetNamespace: string): DaemonSetTarget => ({
    name,
    scope: toScopeKey(clusterId, targetNamespace),
  })
  const filteredDaemonSets = useMemo(
    () =>
      daemonSets.filter((item) =>
        includesSearch([item.name, item.namespace], normalizeSearchKeyword(searchKeyword)),
      ),
    [daemonSets, searchKeyword],
  )

  const columns: TableColumnsType<DaemonSet> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      width: 260,
      ellipsis: { showTitle: false },
      render: (name: string, record) =>
        renderWorkloadNameLink(name, () =>
          navigate(buildWorkloadDetailPath('daemonsets', name, namespace, record.namespace)),
        ),
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
    },
    { title: 'Desired', dataIndex: 'desiredNumber', width: 96 },
    { title: 'Current', dataIndex: 'currentNumber', width: 96 },
    { title: 'Ready', dataIndex: 'readyNumber', width: 96 },
    { title: 'Available', dataIndex: 'availableNumber', width: 110 },
    { title: 'Updated', dataIndex: 'updatedNumber', width: 96 },
    {
      ...tableColumnPresets.datetime,
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
    {
      fixed: 'right',
      title: '',
      dataIndex: 'name',
      key: 'actions',
      width: 84,
      align: 'center',
      onHeaderCell: () => ({ className: WORKLOAD_ACTIONS_COLUMN_CLASS_NAME }),
      onCell: () => ({ className: WORKLOAD_ACTIONS_COLUMN_CLASS_NAME }),
      render: (name: string, record) => {
        const canRestart = hasAllowedAction(record.allowedActions, 'restart')
        const canDelete = hasAllowedAction(record.allowedActions, 'delete')
        if (!canRestart && !canDelete) return '-'

        const restartLabel = localeCode === 'zh_CN' ? '重启' : 'Restart'
        const deleteLabel = localeCode === 'zh_CN' ? '删除' : 'Delete'
        const target = targetFor(name, record.namespace)
        const deletePending = isTargetMutationPending(deleteMutation, name, record.namespace)

        return (
          <Space size={4} className="soha-deployment-action-cell">
            {canRestart ? (
              <ManagementIconButton
                icon={<ReloadOutlined />}
                aria-label={restartLabel}
                disabled={workloadMutationCapability.disabled}
                loading={isTargetMutationPending(restartMutation, name, record.namespace)}
                tooltip={capabilityActionTooltip(restartLabel, workloadMutationCapability)}
                onClick={() =>
                  restartMutation.mutate(target, {
                    onSuccess: () =>
                      void message.success(
                        localeCode === 'zh_CN' ? '已触发重启' : 'Restart triggered',
                      ),
                    onError: (error) => void message.error(error.message),
                  })
                }
              />
            ) : null}
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
                okButtonProps={{ danger: true, loading: deletePending }}
                placement="topRight"
                onConfirm={() =>
                  deleteMutation.mutate(target, {
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
                  loading={deletePending}
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
            localeCode === 'zh_CN' ? '搜索 DaemonSet / Namespace' : 'Search daemon set / namespace'
          }
        />
      </WorkloadQueryPanel>
      <AdminTable
        className="soha-daemonsets-table soha-platform-table"
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        headerExtra={
          <ManagementTableToolbar>
            <WorkloadCreateEntry kind="DaemonSet" />
            {densityButton}
            <WorkloadRefreshButton
              disabled={!clusterId}
              label={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              loading={daemonSetsQuery.isFetching}
              onRefresh={() => void daemonSetsQuery.refetch()}
            />
          </ManagementTableToolbar>
        }
        columns={columns}
        dataSource={filteredDaemonSets}
        rowKey={(record) => `${record.namespace}/${record.name}`}
        loading={daemonSetsQuery.isLoading}
        paginationSummary={
          <WorkloadTableSummary
            filteredCount={filteredDaemonSets.length}
            localeCode={localeCode}
            totalCount={daemonSets.length}
          />
        }
        empty={
          <WorkloadTableEmpty
            clusterId={clusterId}
            filteredCount={filteredDaemonSets.length}
            localeCode={localeCode}
            resourceLabel="DaemonSets"
            totalCount={daemonSets.length}
          />
        }
        tableSize={tableSize}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}
