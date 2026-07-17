import { useState, useMemo } from 'react'
import {
  Button,
  Select,
  Spin,
  Space,
  Modal,
  Popconfirm,
  InputNumber,
  Tooltip,
  Typography,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined, ReloadOutlined, UndoOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementQueryField,
  ManagementTableToolbar,
} from '@/components/management-list'
import { WorkloadCreateEntry } from '../shared/create-entry'
import { TABLE_ACTIONS_COLUMN_CLASS_NAME } from '@/components/resource-actions'
import { hasAllowedAction } from '@/features/auth'
import { encodeAIContextForElement, useAIPageContext } from '@/features/copilot'
import { useI18n } from '@/i18n'
import { StatusTag } from '@/components/status-tag'
import {
  capabilityActionTooltip,
  type ClusterCapabilityDecision,
  useClusterCapability,
} from '@/features/platform/cluster-capabilities'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatAgeSeconds, formatDateTime } from '@/utils/time'
import {
  buildWorkloadDetailPath,
  getDeploymentHealth,
  includesSearch,
  normalizeSearchKeyword,
} from '@/features/platform/workloads-model'
import type { BatchRollbackDraft, Deployment } from '@/features/platform/workloads-model'
import { toScopeKey } from '@/types'
import type { TableColumnsType } from 'antd'
import {
  listDeploymentRollouts,
  restartDeployment,
  rollbackDeployment,
  scaleDeployment,
} from './api'
import { deploymentMutations } from './mutations'
import { deploymentQueries } from './queries'
import type { DeploymentTarget } from './types'
import { workloadKeys } from '../shared/keys'
import {
  WorkloadQueryPanel,
  WorkloadRefreshButton,
  WorkloadSearchInput,
  WorkloadTableEmpty,
  WorkloadTableSummary,
  renderWorkloadNameLink,
  useWorkloadTableDensity,
} from '../shared/list-controls'
import '@/features/platform/workloads/styles.css'

const { Text } = Typography
const WORKLOAD_ACTIONS_COLUMN_CLASS_NAME = `${TABLE_ACTIONS_COLUMN_CLASS_NAME} soha-workload-actions-column`

type WorkloadActionRecord = {
  allowedActions?: string[]
  namespace: string
}

function isWorkloadMutationPending<T extends DeploymentTarget>(
  mutation: { isPending: boolean; variables?: T },
  name: string,
  namespace: string,
) {
  return (
    mutation.isPending &&
    mutation.variables?.name === name &&
    mutation.variables?.scope.namespace === namespace
  )
}

function buildWorkloadActionColumn<T extends WorkloadActionRecord>({
  capability,
  deleteMutation,
  localeCode,
  onRestart,
  onRollback,
  onScale,
  restartMutation,
  rollbackMutation,
  scaleLabel,
  toTarget,
  width,
}: {
  capability: ClusterCapabilityDecision
  deleteMutation: {
    isPending: boolean
    mutate: (value: DeploymentTarget) => void
    variables?: DeploymentTarget
  }
  localeCode: 'zh_CN' | 'en_US'
  onRestart?: (record: T, name: string) => void
  onRollback?: (record: T, name: string) => void
  onScale?: (record: T, name: string) => void
  restartMutation?: {
    isPending: boolean
    variables?: DeploymentTarget
  }
  rollbackMutation?: {
    isPending: boolean
    variables?: DeploymentTarget
  }
  scaleLabel?: string
  toTarget: (name: string, namespace: string) => DeploymentTarget
  width: number
}): TableColumnsType<T>[number] {
  const restartLabel = localeCode === 'zh_CN' ? '重启' : 'Restart'
  const resolvedScaleLabel = scaleLabel ?? (localeCode === 'zh_CN' ? '扩缩' : 'Scale')
  const rollbackLabel = localeCode === 'zh_CN' ? '回滚' : 'Rollback'
  const deleteLabel = localeCode === 'zh_CN' ? '删除' : 'Delete'

  return {
    fixed: 'right',
    title: '',
    dataIndex: 'name',
    key: 'actions',
    width,
    align: 'center',
    onHeaderCell: () => ({ className: WORKLOAD_ACTIONS_COLUMN_CLASS_NAME }),
    onCell: () => ({ className: WORKLOAD_ACTIONS_COLUMN_CLASS_NAME }),
    render: (name: string, record: T) => {
      const canRestart = Boolean(onRestart) && hasAllowedAction(record.allowedActions, 'restart')
      const canScale = Boolean(onScale) && hasAllowedAction(record.allowedActions, 'scale')
      const canRollback = Boolean(onRollback) && hasAllowedAction(record.allowedActions, 'update')
      const canDelete = hasAllowedAction(record.allowedActions, 'delete')
      if (!canRestart && !canScale && !canRollback && !canDelete) return '-'

      const deletePending = isWorkloadMutationPending(deleteMutation, name, record.namespace)
      return (
        <Space size={4} className="soha-deployment-action-cell">
          {canRestart ? (
            <ManagementIconButton
              icon={<ReloadOutlined />}
              aria-label={restartLabel}
              disabled={capability.disabled}
              loading={isWorkloadMutationPending(
                restartMutation ?? { isPending: false },
                name,
                record.namespace,
              )}
              tooltip={capabilityActionTooltip(restartLabel, capability)}
              onClick={() => onRestart?.(record, name)}
            />
          ) : null}
          {canScale ? (
            <ManagementIconButton
              icon={<EditOutlined />}
              aria-label={resolvedScaleLabel}
              disabled={capability.disabled}
              tooltip={capabilityActionTooltip(resolvedScaleLabel, capability)}
              onClick={() => onScale?.(record, name)}
            />
          ) : null}
          {canRollback ? (
            <ManagementIconButton
              icon={<UndoOutlined />}
              aria-label={rollbackLabel}
              disabled={capability.disabled}
              loading={isWorkloadMutationPending(
                rollbackMutation ?? { isPending: false },
                name,
                record.namespace,
              )}
              tooltip={capabilityActionTooltip(rollbackLabel, capability)}
              onClick={() => onRollback?.(record, name)}
            />
          ) : null}
          {canDelete && capability.disabled ? (
            <ManagementIconButton
              danger
              disabled
              icon={<DeleteOutlined />}
              aria-label={deleteLabel}
              tooltip={capabilityActionTooltip(deleteLabel, capability)}
            />
          ) : null}
          {canDelete && !capability.disabled ? (
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
              onConfirm={() => deleteMutation.mutate(toTarget(name, record.namespace))}
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
  }
}

/* ─── Deployments ─── */

export function WorkloadsDeploymentsPage() {
  const { t, localeCode } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clusterId, namespace } = usePlatformScopeStore()
  const listScope = toScopeKey(clusterId, namespace)
  const deploymentsQuery = useQuery(deploymentQueries.list(listScope))
  const [scaleTarget, setScaleTarget] = useState<{
    name: string
    namespace: string
    replicas: number
  } | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [healthFilter, setHealthFilter] = useState('all')
  const [selectedDeploymentKeys, setSelectedDeploymentKeys] = useState<string[]>([])
  const [batchScaleVisible, setBatchScaleVisible] = useState(false)
  const [batchScaleReplicas, setBatchScaleReplicas] = useState(1)
  const [batchRollbackVisible, setBatchRollbackVisible] = useState(false)
  const [batchRollbackLoading, setBatchRollbackLoading] = useState(false)
  const [batchRollbackDrafts, setBatchRollbackDrafts] = useState<BatchRollbackDraft[]>([])
  const { densityButton, tableSize } = useWorkloadTableDensity(localeCode)
  const workloadMutationCapability = useClusterCapability('workload.mutations', localeCode)
  const workloadMutationDisabled = workloadMutationCapability.disabled

  const deployments = deploymentsQuery.data ?? []
  const isLoading = deploymentsQuery.isLoading
  const targetFor = (name: string, targetNamespace: string) => ({
    name,
    scope: toScopeKey(clusterId, targetNamespace),
  })
  const normalizedKeyword = normalizeSearchKeyword(searchKeyword)
  useAIPageContext({
    sourceWorkbench: 'platform',
    sourceTitle: localeCode === 'zh_CN' ? 'Deployments 列表' : 'Deployments',
    entityKind: 'kubernetes.deployment.list',
    entityName: 'Deployments',
    clusterId: clusterId ?? undefined,
    namespace: namespace ?? undefined,
    timeRangeMinutes: 60,
    visibleFilters: { searchKeyword, healthFilter },
    pinnedData: { total: deployments.length },
    promptHint: '分析当前 Deployment 列表的健康状态、重启、滚动发布和相关事件。',
  })

  const restartMutation = useMutation(deploymentMutations.restart(queryClient))
  const scaleMutation = useMutation(deploymentMutations.scale(queryClient))
  const rollbackMutation = useMutation(deploymentMutations.rollback(queryClient))
  const deleteMutation = useMutation(deploymentMutations.remove(queryClient))

  const batchRestartMutation = useMutation({
    mutationFn: async (items: Deployment[]) =>
      Promise.allSettled(
        items.map((item) => restartDeployment(targetFor(item.name, item.namespace))),
      ),
    onSuccess: (results) => {
      const successCount = results.filter((item) => item.status === 'fulfilled').length
      const failureCount = results.length - successCount
      void message.success(
        failureCount > 0
          ? `批量重启完成，成功 ${successCount}，失败 ${failureCount}`
          : `已批量重启 ${successCount} 个 Deployment`,
      )
      setSelectedDeploymentKeys([])
      void queryClient.invalidateQueries({ queryKey: workloadKeys.resource('deployments') })
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const batchScaleMutation = useMutation({
    mutationFn: async ({ items, replicas }: { items: Deployment[]; replicas: number }) =>
      Promise.allSettled(
        items.map((item) =>
          scaleDeployment({
            ...targetFor(item.name, item.namespace),
            replicas,
          }),
        ),
      ),
    onSuccess: (results) => {
      const successCount = results.filter((item) => item.status === 'fulfilled').length
      const failureCount = results.length - successCount
      void message.success(
        failureCount > 0
          ? `批量扩缩完成，成功 ${successCount}，失败 ${failureCount}`
          : `已批量扩缩 ${successCount} 个 Deployment`,
      )
      setBatchScaleVisible(false)
      setSelectedDeploymentKeys([])
      void queryClient.invalidateQueries({ queryKey: workloadKeys.resource('deployments') })
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const batchRollbackMutation = useMutation({
    mutationFn: async (items: BatchRollbackDraft[]) => {
      const validItems = items.filter((item) => item.revision)
      if (validItems.length === 0) {
        throw new Error(
          localeCode === 'zh_CN'
            ? '请至少为一个 Deployment 选择回滚 Revision'
            : 'Select at least one rollback revision',
        )
      }
      return Promise.allSettled(
        validItems.map((item) =>
          rollbackDeployment({
            ...targetFor(item.name, item.namespace),
            revision: item.revision,
          }),
        ),
      )
    },
    onSuccess: (results) => {
      const successCount = results.filter((item) => item.status === 'fulfilled').length
      const failureCount = results.length - successCount
      void message.success(
        failureCount > 0
          ? `批量回滚完成，成功 ${successCount}，失败 ${failureCount}`
          : `已批量回滚 ${successCount} 个 Deployment`,
      )
      setBatchRollbackVisible(false)
      setSelectedDeploymentKeys([])
      void queryClient.invalidateQueries({ queryKey: workloadKeys.resource('deployments') })
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const filteredDeployments = useMemo(
    () =>
      deployments.filter((item) => {
        const health = getDeploymentHealth(item)
        if (healthFilter !== 'all' && health !== healthFilter) return false
        return includesSearch([item.name, item.namespace], normalizedKeyword)
      }),
    [deployments, healthFilter, normalizedKeyword],
  )

  const selectedDeployments = useMemo(
    () =>
      deployments.filter((item) =>
        selectedDeploymentKeys.includes(`${item.namespace}/${item.name}`),
      ),
    [deployments, selectedDeploymentKeys],
  )
  const canBatchRestart =
    selectedDeployments.length > 0 &&
    !workloadMutationDisabled &&
    selectedDeployments.every((item) => hasAllowedAction(item.allowedActions, 'restart'))
  const canBatchScale =
    selectedDeployments.length > 0 &&
    !workloadMutationDisabled &&
    selectedDeployments.every((item) => hasAllowedAction(item.allowedActions, 'scale'))
  const canBatchRollback =
    selectedDeployments.length > 0 &&
    !workloadMutationDisabled &&
    selectedDeployments.every((item) => hasAllowedAction(item.allowedActions, 'update'))
  const batchMutationDisabledReason =
    selectedDeployments.length > 0 && workloadMutationDisabled
      ? workloadMutationCapability.reason
      : ''

  const openBatchRollbackModal = async () => {
    if (!clusterId || selectedDeployments.length === 0) return
    setBatchRollbackLoading(true)
    setBatchRollbackVisible(true)
    try {
      const drafts = await Promise.all(
        selectedDeployments.map(async (item) => {
          const histories = await listDeploymentRollouts(targetFor(item.name, item.namespace))
          const options = histories
            .filter((history) => history.revision)
            .map((history) => ({
              value: history.revision,
              label: `${history.revision}${history.createdAt ? ` · ${formatDateTime(history.createdAt)}` : ''}`,
            }))
          return {
            key: `${item.namespace}/${item.name}`,
            name: item.name,
            namespace: item.namespace,
            options,
            revision: options[1]?.value ?? options[0]?.value ?? '',
          } satisfies BatchRollbackDraft
        }),
      )
      setBatchRollbackDrafts(drafts)
    } catch (err) {
      void message.error(err instanceof Error ? err.message : String(err))
      setBatchRollbackVisible(false)
    } finally {
      setBatchRollbackLoading(false)
    }
  }

  const restartActionMutation = {
    isPending: restartMutation.isPending,
    variables: restartMutation.variables,
  }
  const rollbackActionMutation = {
    isPending: rollbackMutation.isPending,
    variables: rollbackMutation.variables,
  }
  const deleteActionMutation = {
    isPending: deleteMutation.isPending,
    variables: deleteMutation.variables,
    mutate: (target: DeploymentTarget) =>
      deleteMutation.mutate(target, {
        onSuccess: () => void message.success(localeCode === 'zh_CN' ? '已删除' : 'Deleted'),
        onError: (error) => void message.error(error.message),
      }),
  }

  const columns: TableColumnsType<Deployment> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      render: (name: string, record: Deployment) =>
        renderWorkloadNameLink(name, () =>
          navigate(buildWorkloadDetailPath('deployments', name, namespace, record.namespace)),
        ),
    },
    { title: t('common.namespace', 'Namespace'), dataIndex: 'namespace' },
    {
      title: localeCode === 'zh_CN' ? '状态' : 'Status',
      dataIndex: 'health',
      key: 'health',
      width: 120,
      render: (_: unknown, record: Deployment) => <StatusTag value={getDeploymentHealth(record)} />,
    },
    {
      title: 'Ready',
      dataIndex: 'readyReplicas',
      width: 88,
      render: (_: number, record: Deployment) =>
        `${record.readyReplicas}/${record.desiredReplicas}`,
    },
    {
      title: localeCode === 'zh_CN' ? '已更新' : 'Up-to-date',
      dataIndex: 'updatedReplicas',
      width: 96,
    },
    { title: localeCode === 'zh_CN' ? '可用' : 'Available', dataIndex: 'available', width: 88 },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
    buildWorkloadActionColumn<Deployment>({
      capability: workloadMutationCapability,
      deleteMutation: deleteActionMutation,
      localeCode,
      onRestart: (record, name) =>
        restartMutation.mutate(targetFor(name, record.namespace), {
          onSuccess: () => void message.success('已触发重启'),
          onError: (error) => void message.error(error.message),
        }),
      onRollback: (record, name) =>
        rollbackMutation.mutate(targetFor(name, record.namespace), {
          onSuccess: () => void message.success('已触发回滚'),
          onError: (error) => void message.error(error.message),
        }),
      onScale: (record, name) =>
        setScaleTarget({
          name,
          namespace: record.namespace,
          replicas: record.desiredReplicas,
        }),
      restartMutation: restartActionMutation,
      rollbackMutation: rollbackActionMutation,
      toTarget: targetFor,
      width: 148,
    }),
  ]

  const deploymentQueryPanel = (
    <WorkloadQueryPanel
      hasActiveFilters={Boolean(searchKeyword.trim()) || healthFilter !== 'all'}
      localeCode={localeCode}
      onReset={() => {
        setSearchKeyword('')
        setHealthFilter('all')
      }}
    >
      <WorkloadSearchInput
        label={localeCode === 'zh_CN' ? '名称' : 'Name'}
        value={searchKeyword}
        onChange={setSearchKeyword}
        placeholder={localeCode === 'zh_CN' ? '搜索 Deployment 名称' : 'Search deployment name'}
      />
      <ManagementQueryField label={localeCode === 'zh_CN' ? '健康状态' : 'Health'}>
        <Select
          className="soha-platform-compact-field"
          size="small"
          value={healthFilter}
          onChange={(value) => setHealthFilter(String(value || 'all'))}
          options={[
            { value: 'all', label: localeCode === 'zh_CN' ? '全部健康状态' : 'All health states' },
            { value: 'healthy', label: localeCode === 'zh_CN' ? '健康' : 'Healthy' },
            { value: 'progressing', label: localeCode === 'zh_CN' ? '进行中' : 'Progressing' },
            { value: 'degraded', label: localeCode === 'zh_CN' ? '异常' : 'Degraded' },
            { value: 'scaled-down', label: localeCode === 'zh_CN' ? '已缩容为 0' : 'Scaled down' },
          ]}
        />
      </ManagementQueryField>
    </WorkloadQueryPanel>
  )

  const deploymentToolbarExtra = (
    <ManagementTableToolbar>
      <WorkloadCreateEntry kind="Deployment" />
      {workloadMutationDisabled && workloadMutationCapability.reason ? (
        <Text type="danger" style={{ fontSize: 12 }}>
          {workloadMutationCapability.reason}
        </Text>
      ) : null}
      <Tooltip title={batchMutationDisabledReason}>
        <span>
          <Button
            autoInsertSpace={false}
            size="small"
            variant="outlined"
            disabled={!canBatchRestart}
            loading={batchRestartMutation.isPending}
            onClick={() => batchRestartMutation.mutate(selectedDeployments)}
          >
            {localeCode === 'zh_CN'
              ? `批量重启 (${selectedDeployments.length})`
              : `Batch Restart (${selectedDeployments.length})`}
          </Button>
        </span>
      </Tooltip>
      <Tooltip title={batchMutationDisabledReason}>
        <span>
          <Button
            autoInsertSpace={false}
            size="small"
            variant="outlined"
            disabled={!canBatchRollback}
            loading={batchRollbackLoading}
            onClick={openBatchRollbackModal}
          >
            {localeCode === 'zh_CN'
              ? `批量回滚 (${selectedDeployments.length})`
              : `Batch Rollback (${selectedDeployments.length})`}
          </Button>
        </span>
      </Tooltip>
      <Tooltip title={batchMutationDisabledReason}>
        <span>
          <Button
            autoInsertSpace={false}
            size="small"
            variant="outlined"
            disabled={!canBatchScale}
            onClick={() => {
              setBatchScaleReplicas(selectedDeployments[0]?.desiredReplicas ?? 1)
              setBatchScaleVisible(true)
            }}
          >
            {localeCode === 'zh_CN'
              ? `批量扩缩 (${selectedDeployments.length})`
              : `Batch Scale (${selectedDeployments.length})`}
          </Button>
        </span>
      </Tooltip>
      {densityButton}
      <WorkloadRefreshButton
        disabled={!clusterId}
        label={t('common.refresh', 'Refresh')}
        onRefresh={() => void deploymentsQuery.refetch()}
      />
    </ManagementTableToolbar>
  )

  return (
    <div className="soha-page">
      {deploymentQueryPanel}
      <AdminTable
        className="soha-deployments-table soha-platform-table"
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        headerExtra={deploymentToolbarExtra}
        columns={columns}
        dataSource={filteredDeployments}
        rowKey={(record) => `${record.namespace}/${record.name}`}
        onRow={(record: Deployment) => ({
          'data-ai-context': encodeAIContextForElement({
            sourceWorkbench: 'platform',
            sourceRoute: `/workloads/deployments/${record.name}?namespace=${encodeURIComponent(record.namespace)}`,
            sourceTitle: `Deployment ${record.name}`,
            entityKind: 'kubernetes.deployment',
            entityName: record.name,
            clusterId: clusterId ?? undefined,
            namespace: record.namespace,
            workload: record.name,
            timeRangeMinutes: 60,
          }),
        })}
        loading={isLoading}
        paginationSummary={
          <WorkloadTableSummary
            filteredCount={filteredDeployments.length}
            localeCode={localeCode}
            totalCount={deployments.length}
          />
        }
        empty={
          <WorkloadTableEmpty
            clusterId={clusterId}
            filteredCount={filteredDeployments.length}
            localeCode={localeCode}
            resourceLabel="Deployments"
            totalCount={deployments.length}
          />
        }
        pageSize={10}
        tableSize={tableSize}
        scroll={{ x: 'max-content' }}
        selectCurrentPageOnly
        rowSelection={{
          selectedRowKeys: selectedDeploymentKeys,
          onChange: (selectedRowKeys: string[]) => setSelectedDeploymentKeys(selectedRowKeys),
        }}
      />
      <Modal
        title={localeCode === 'zh_CN' ? '扩缩容' : 'Scale deployment'}
        open={!!scaleTarget}
        onOk={() => {
          if (scaleTarget) {
            scaleMutation.mutate(
              {
                ...targetFor(scaleTarget.name, scaleTarget.namespace),
                replicas: scaleTarget.replicas,
              },
              {
                onSuccess: () => {
                  void message.success('已触发扩缩容')
                  setScaleTarget(null)
                },
                onError: (error) => void message.error(error.message),
              },
            )
          }
        }}
        onCancel={() => setScaleTarget(null)}
        confirmLoading={scaleMutation.isPending}
      >
        <div className="flex items-center gap-2">
          <Text>{localeCode === 'zh_CN' ? '副本数:' : 'Replicas:'}</Text>
          <InputNumber
            value={scaleTarget?.replicas ?? 1}
            min={0}
            onChange={(v) =>
              scaleTarget && setScaleTarget({ ...scaleTarget, replicas: v as number })
            }
          />
        </div>
      </Modal>
      <Modal
        title={localeCode === 'zh_CN' ? '批量回滚' : 'Batch rollback deployments'}
        open={batchRollbackVisible}
        onOk={() => batchRollbackMutation.mutate(batchRollbackDrafts)}
        onCancel={() => setBatchRollbackVisible(false)}
        confirmLoading={batchRollbackMutation.isPending}
        width={900}
      >
        {batchRollbackLoading ? (
          <div className="flex items-center justify-center h-48">
            <Spin size="large" />
          </div>
        ) : (
          <AdminTable
            shellClassName="soha-management-table-shell"
            columns={[
              { title: localeCode === 'zh_CN' ? 'Deployment' : 'Deployment', dataIndex: 'name' },
              { title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace', dataIndex: 'namespace' },
              {
                title: localeCode === 'zh_CN' ? '目标 Revision' : 'Target Revision',
                dataIndex: 'revision',
                render: (_: string, record: BatchRollbackDraft) => (
                  <Select
                    value={record.revision || undefined}
                    options={record.options}
                    style={{ width: 260 }}
                    placeholder={localeCode === 'zh_CN' ? '选择回滚版本' : 'Select revision'}
                    onChange={(value) =>
                      setBatchRollbackDrafts((current) =>
                        current.map((item) =>
                          item.key === record.key
                            ? { ...item, revision: String(value || '') }
                            : item,
                        ),
                      )
                    }
                  />
                ),
              },
            ]}
            dataSource={batchRollbackDrafts}
            rowKey="key"
            pageSize={10}
            enableColumnSelection={false}
          />
        )}
      </Modal>
      <Modal
        title={localeCode === 'zh_CN' ? '批量扩缩容' : 'Batch scale deployments'}
        open={batchScaleVisible}
        onOk={() =>
          batchScaleMutation.mutate({ items: selectedDeployments, replicas: batchScaleReplicas })
        }
        onCancel={() => setBatchScaleVisible(false)}
        confirmLoading={batchScaleMutation.isPending}
      >
        <div className="flex flex-col gap-3">
          <Text type="secondary">
            {localeCode === 'zh_CN'
              ? `将对 ${selectedDeployments.length} 个 Deployment 应用相同副本数`
              : `Apply the same replica count to ${selectedDeployments.length} deployments`}
          </Text>
          <div className="flex items-center gap-2">
            <Text>{localeCode === 'zh_CN' ? '副本数:' : 'Replicas:'}</Text>
            <InputNumber
              value={batchScaleReplicas}
              min={0}
              onChange={(value) => setBatchScaleReplicas(Number(value) || 0)}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
