import { useMemo, useState } from 'react'
import { InputNumber, Modal, Popconfirm, Space, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons'
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
import { statefulSetMutations } from './mutations'
import { statefulSetQueries } from './queries'
import type { ScaleStatefulSetVariables, StatefulSet, StatefulSetTarget } from './types'
import '@/features/platform/workloads/styles.css'

const { Text } = Typography
const WORKLOAD_ACTIONS_COLUMN_CLASS_NAME = `${TABLE_ACTIONS_COLUMN_CLASS_NAME} soha-workload-actions-column`

function isTargetMutationPending<T extends StatefulSetTarget>(
  mutation: { isPending: boolean; variables?: T },
  name: string,
  namespace: string,
) {
  return (
    mutation.isPending &&
    mutation.variables?.name === name &&
    mutation.variables.scope.namespace === namespace
  )
}

export function WorkloadsStatefulSetsPage() {
  const { t, localeCode } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clusterId, namespace } = usePlatformScopeStore()
  const listScope = toScopeKey(clusterId, namespace)
  const statefulSetsQuery = useQuery(statefulSetQueries.list(listScope))
  const restartMutation = useMutation(statefulSetMutations.restart(queryClient))
  const scaleMutation = useMutation(statefulSetMutations.scale(queryClient))
  const deleteMutation = useMutation(statefulSetMutations.remove(queryClient))
  const [scaleTarget, setScaleTarget] = useState<ScaleStatefulSetVariables | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const { densityButton, tableSize } = useWorkloadTableDensity(localeCode)
  const workloadMutationCapability = useClusterCapability('workload.mutations', localeCode)

  const statefulSets = statefulSetsQuery.data ?? []
  const targetFor = (name: string, targetNamespace: string): StatefulSetTarget => ({
    name,
    scope: toScopeKey(clusterId, targetNamespace),
  })
  const filteredStatefulSets = useMemo(
    () =>
      statefulSets.filter((item) =>
        includesSearch(
          [item.name, item.namespace, item.serviceName],
          normalizeSearchKeyword(searchKeyword),
        ),
      ),
    [searchKeyword, statefulSets],
  )

  const columns: TableColumnsType<StatefulSet> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      width: 260,
      ellipsis: { showTitle: false },
      render: (name: string, record) =>
        renderWorkloadNameLink(name, () =>
          navigate(buildWorkloadDetailPath('statefulsets', name, namespace, record.namespace)),
        ),
    },
    { title: t('common.namespace', 'Namespace'), dataIndex: 'namespace', width: 160 },
    {
      title: 'Service',
      dataIndex: 'serviceName',
      width: 180,
      ellipsis: { showTitle: true },
      render: (value: string) => value || '-',
    },
    {
      title: 'Ready',
      dataIndex: 'readyReplicas',
      width: 96,
      render: (_value: number, record) => `${record.readyReplicas}/${record.desiredReplicas}`,
    },
    { title: 'Current', dataIndex: 'currentReplicas', width: 96 },
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
      width: 116,
      align: 'center',
      onHeaderCell: () => ({ className: WORKLOAD_ACTIONS_COLUMN_CLASS_NAME }),
      onCell: () => ({ className: WORKLOAD_ACTIONS_COLUMN_CLASS_NAME }),
      render: (name: string, record) => {
        const canRestart = hasAllowedAction(record.allowedActions, 'restart')
        const canScale = hasAllowedAction(record.allowedActions, 'scale')
        const canDelete = hasAllowedAction(record.allowedActions, 'delete')
        if (!canRestart && !canScale && !canDelete) return '-'

        const restartLabel = localeCode === 'zh_CN' ? '重启' : 'Restart'
        const scaleLabel = localeCode === 'zh_CN' ? '扩缩' : 'Scale'
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
            {canScale ? (
              <ManagementIconButton
                icon={<EditOutlined />}
                aria-label={scaleLabel}
                disabled={workloadMutationCapability.disabled}
                tooltip={capabilityActionTooltip(scaleLabel, workloadMutationCapability)}
                onClick={() =>
                  setScaleTarget({
                    ...target,
                    replicas: record.desiredReplicas,
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
            localeCode === 'zh_CN'
              ? '搜索 StatefulSet / Namespace / Service'
              : 'Search stateful set / namespace / service'
          }
        />
      </WorkloadQueryPanel>
      <AdminTable
        className="soha-statefulsets-table soha-platform-table"
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        headerExtra={
          <ManagementTableToolbar>
            <WorkloadCreateEntry kind="StatefulSet" />
            {densityButton}
            <WorkloadRefreshButton
              disabled={!clusterId}
              label={t('common.refresh', 'Refresh')}
              loading={statefulSetsQuery.isFetching}
              onRefresh={() => void statefulSetsQuery.refetch()}
            />
          </ManagementTableToolbar>
        }
        columns={columns}
        dataSource={filteredStatefulSets}
        rowKey={(record) => `${record.namespace}/${record.name}`}
        loading={statefulSetsQuery.isLoading}
        paginationSummary={
          <WorkloadTableSummary
            filteredCount={filteredStatefulSets.length}
            localeCode={localeCode}
            totalCount={statefulSets.length}
          />
        }
        empty={
          <WorkloadTableEmpty
            clusterId={clusterId}
            filteredCount={filteredStatefulSets.length}
            localeCode={localeCode}
            resourceLabel="StatefulSets"
            totalCount={statefulSets.length}
          />
        }
        tableSize={tableSize}
        scroll={{ x: 'max-content' }}
      />
      <Modal
        title={localeCode === 'zh_CN' ? 'StatefulSet 扩缩容' : 'Scale StatefulSet'}
        open={Boolean(scaleTarget)}
        onOk={() => {
          if (!scaleTarget) return
          scaleMutation.mutate(scaleTarget, {
            onSuccess: () => {
              void message.success(localeCode === 'zh_CN' ? '已触发扩缩容' : 'Scale triggered')
              setScaleTarget(null)
            },
            onError: (error) => void message.error(error.message),
          })
        }}
        onCancel={() => setScaleTarget(null)}
        confirmLoading={scaleMutation.isPending}
      >
        <div className="flex items-center gap-2">
          <Text>{localeCode === 'zh_CN' ? '副本数:' : 'Replicas:'}</Text>
          <InputNumber
            value={scaleTarget?.replicas ?? 1}
            min={0}
            onChange={(value) =>
              scaleTarget && setScaleTarget({ ...scaleTarget, replicas: Number(value) || 0 })
            }
          />
        </div>
      </Modal>
    </div>
  )
}
