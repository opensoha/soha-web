import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  App,
  Button,
  Popconfirm,
  Progress,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { CodeOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementBatchBar,
  ManagementIconButton,
  ManagementQueryField,
  ManagementTableToolbar,
} from '@/components/management-list'
import { TABLE_ACTIONS_COLUMN_CLASS_NAME } from '@/components/resource-actions'
import { hasAllowedAction, hasPermission, usePermissionSnapshot } from '@/features/auth'
import { encodeAIContextForElement, useAIPageContext } from '@/features/copilot'
import { useI18n } from '@/i18n'
import { StatusTag } from '@/components/status-tag'
import {
  capabilityActionTooltip,
  useClusterCapability,
} from '@/features/platform/cluster-capabilities'
import { K8S_TABLE_PAGE_SIZE } from '@/features/platform/shared/table-config'
import { ResourceStreamStatus } from '@/features/platform/shared/resource-stream-status'
import { useKubernetesResourceStream } from '@/features/platform/shared/resource-stream'
import { useRealtimeSessionDock } from '@/features/platform/session-dock'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatAgeSeconds } from '@/utils/time'
import {
  buildWorkloadDetailPath,
  compareStrings,
  formatCpuDisplay,
  formatMemoryDisplay,
  includesSearch,
  normalizeSearchKeyword,
  parseCpuValue,
  parseMemoryValue,
  parseReadyContainers,
} from '@/features/platform/workloads-model'
import { toScopeKey } from '@/types'
import type { TableColumnsType } from 'antd'
import {
  WorkloadQueryPanel,
  WorkloadRefreshButton,
  WorkloadSearchInput,
  WorkloadTableEmpty,
  useWorkloadTableDensity,
} from '../shared/list-controls'
import { podMutations } from './mutations'
import { podQueries } from './queries'
import { podTargetFromRecord, type Pod } from './types'
import { workloadKeys } from '../shared/keys'
import '@/features/platform/workloads/styles.css'

const { Link, Text } = Typography

/* ─── Pods ─── */

function podSorter(compareFn: (left: Pod, right: Pod) => number) {
  return (left?: Pod, right?: Pod) => {
    if (!left && !right) return 0
    if (!left) return -1
    if (!right) return 1
    return compareFn(left, right)
  }
}

function renderPodReadyCell(readyContainers: string, readyLabel: string) {
  const ready = parseReadyContainers(readyContainers)
  const readyHealthy = ready.total > 0 && ready.ready >= ready.total

  return (
    <Tag variant="filled" color={readyHealthy ? 'success' : 'warning'}>
      {`${readyLabel} ${readyContainers || '-'}`}
    </Tag>
  )
}

function formatPodResourceValue(resource: 'cpu' | 'memory', value?: string) {
  return resource === 'cpu' ? formatCpuDisplay(value) : formatMemoryDisplay(value)
}

function getPodResourceAmount(resource: 'cpu' | 'memory', value?: string) {
  return resource === 'cpu' ? parseCpuValue(value) : parseMemoryValue(value)
}

function renderPodResourceLimitComparison(
  record: Pod,
  resource: 'cpu' | 'memory',
  localeCode: 'zh_CN' | 'en_US',
) {
  const usageValue = resource === 'cpu' ? record.cpu : record.memory
  const requestValue = record.requests?.[resource]
  const limitValue = record.limits?.[resource]
  const usageAmount = getPodResourceAmount(resource, usageValue)
  const requestAmount = getPodResourceAmount(resource, requestValue)
  const limitAmount = getPodResourceAmount(resource, limitValue)
  const hasUsage = usageAmount >= 0
  const hasRequest = requestAmount >= 0
  const hasLimit = limitAmount > 0
  const baselineAmount = hasLimit ? limitAmount : hasRequest ? requestAmount : 0
  const hasBaseline = baselineAmount > 0
  const percent =
    hasUsage && hasBaseline ? Math.min(100, Math.round((usageAmount / baselineAmount) * 100)) : 0
  const requestPercent =
    hasRequest && hasBaseline
      ? Math.min(100, Math.round((requestAmount / baselineAmount) * 100))
      : null
  const limitPercent =
    hasLimit && hasBaseline ? Math.min(100, Math.round((limitAmount / baselineAmount) * 100)) : null
  const label = resource === 'cpu' ? 'CPU' : localeCode === 'zh_CN' ? '内存' : 'Memory'
  const usageLabel = formatPodResourceValue(resource, usageValue)
  const requestLabel = formatPodResourceValue(resource, requestValue)
  const limitLabel = formatPodResourceValue(resource, limitValue)
  const usageText = localeCode === 'zh_CN' ? '使用' : 'Use'
  const requestText = localeCode === 'zh_CN' ? '请求' : 'Req'
  const limitText = localeCode === 'zh_CN' ? '限制' : 'Limit'
  const tooltipTitle = hasLimit
    ? `${label} ${usageText} ${usageLabel} / ${requestText} ${requestLabel} / ${limitText} ${limitLabel}`
    : localeCode === 'zh_CN'
      ? `${label} 使用 ${usageLabel} / 请求 ${requestLabel}，未设置限制`
      : `${label} use ${usageLabel} / request ${requestLabel}, no limit set`
  const markerStyle = {
    '--soha-pod-resource-request-percent': `${requestPercent ?? 0}%`,
    '--soha-pod-resource-limit-percent': `${limitPercent ?? 100}%`,
  } as CSSProperties
  const progressClassName = hasBaseline ? undefined : 'is-without-baseline'
  const strokeColor =
    hasUsage && hasLimit && usageAmount > limitAmount
      ? 'var(--soha-danger)'
      : resource === 'cpu'
        ? 'var(--soha-primary)'
        : 'var(--soha-success)'

  return (
    <Tooltip title={tooltipTitle} placement="topLeft">
      <div className="soha-pod-resource-limit-cell" aria-label={tooltipTitle}>
        <div className="soha-pod-resource-progress-wrap" style={markerStyle}>
          <Progress
            className={progressClassName}
            percent={percent}
            showInfo={false}
            size={['100%', 5]}
            strokeColor={strokeColor}
            strokeLinecap="butt"
            railColor="var(--soha-fill-weak)"
          />
          {requestPercent === null ? null : (
            <span className="soha-pod-resource-marker is-request" aria-hidden />
          )}
          {limitPercent === null ? null : (
            <span className="soha-pod-resource-marker is-limit" aria-hidden />
          )}
        </div>
      </div>
    </Tooltip>
  )
}

function renderPodNameCell(record: Pod, onClick: () => void) {
  const persistentVolumeClaims = record.persistentVolumeClaims ?? []

  return (
    <div className="soha-pod-table-name-cell">
      <Tooltip title={record.name} placement="topLeft">
        <Link className="soha-pod-table-name-link" onClick={onClick}>
          {record.name}
        </Link>
      </Tooltip>
      {persistentVolumeClaims.length > 0 ? (
        <Space size={4} wrap={false} className="soha-pod-table-meta">
          <Tag variant="filled" className="soha-pod-table-pvc-tag">
            PVC {persistentVolumeClaims.length}
          </Tag>
        </Space>
      ) : null}
    </div>
  )
}

export function WorkloadsPodsPage() {
  const { t, localeCode } = useI18n()
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const permissionSnapshot = permissionSnapshotQuery.data?.data
  const canDeletePods = hasPermission(permissionSnapshot, 'platform.pods.delete')
  const canExecPods = hasPermission(permissionSnapshot, 'platform.pods.exec')
  const canViewPodLogs = hasPermission(permissionSnapshot, 'platform.pods.logs')
  const { clusterId, namespace } = usePlatformScopeStore()
  const { openSession } = useRealtimeSessionDock()
  const podDeleteCapability = useClusterCapability('workload.mutations', localeCode)
  const podExecCapability = useClusterCapability('pod.exec', localeCode)
  const podLogsCapability = useClusterCapability('pod.logs', localeCode)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [autoRefreshIntervalSeconds, setAutoRefreshIntervalSeconds] = useState(15)
  const [manualRefreshPending, setManualRefreshPending] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [phaseFilter, setPhaseFilter] = useState('all')
  const [restartFilter, setRestartFilter] = useState('all')
  const [pvcFilter, setPvcFilter] = useState('all')
  const [nodeFilter, setNodeFilter] = useState('all')
  const [selectedPodKeys, setSelectedPodKeys] = useState<string[]>([])
  const { densityButton, tableSize } = useWorkloadTableDensity(localeCode)

  useEffect(() => {
    setNodeFilter('all')
    setSelectedPodKeys([])
  }, [clusterId])

  const listScope = toScopeKey(clusterId, namespace)
  const podsQueryOptions = podQueries.list(listScope)
  const podStream = useKubernetesResourceStream({
    clusterId,
    namespace,
    kinds: ['Pod', 'Event'],
    onEvent: () => void queryClient.invalidateQueries({ queryKey: workloadKeys.lists('pods') }),
    onFallback: () => void queryClient.invalidateQueries({ queryKey: workloadKeys.lists('pods') }),
    onResyncRequired: () => queryClient.invalidateQueries({ queryKey: workloadKeys.lists('pods') }),
  })
  const podsQuery = useQuery({
    ...podsQueryOptions,
    refetchInterval:
      !podStream.live && autoRefreshEnabled && clusterId
        ? autoRefreshIntervalSeconds * 1000
        : false,
  })

  const isLoading = podsQuery.isLoading

  const pods = podsQuery.data ?? []
  const normalizedKeyword = normalizeSearchKeyword(searchKeyword)
  useAIPageContext({
    sourceWorkbench: 'platform',
    sourceTitle: localeCode === 'zh_CN' ? 'Pods 列表' : 'Pods',
    entityKind: 'kubernetes.pod.list',
    entityName: 'Pods',
    clusterId: clusterId ?? undefined,
    namespace: namespace ?? undefined,
    timeRangeMinutes: 60,
    visibleFilters: { searchKeyword, phaseFilter, restartFilter, pvcFilter, nodeFilter },
    pinnedData: { total: pods.length },
    promptHint:
      localeCode === 'zh_CN'
        ? '分析当前 Pod 列表中的异常状态、重启、节点分布和存储挂载风险。'
        : 'Analyze abnormal Pod states, restarts, node distribution, and storage mount risks.',
  })
  const nodeOptions = useMemo(
    () => Array.from(new Set(pods.map((item) => item.nodeName).filter(Boolean))).sort(),
    [pods],
  )

  const filteredPods = useMemo(
    () =>
      pods.filter((item) => {
        if (phaseFilter !== 'all' && item.phase !== phaseFilter) return false
        if (restartFilter === 'restarting' && item.restarts <= 0) return false
        if (restartFilter === 'clean' && item.restarts > 0) return false
        if (pvcFilter === 'with-pvc' && (item.persistentVolumeClaims?.length ?? 0) === 0)
          return false
        if (pvcFilter === 'without-pvc' && (item.persistentVolumeClaims?.length ?? 0) > 0)
          return false
        if (nodeFilter !== 'all' && item.nodeName !== nodeFilter) return false
        return includesSearch(
          [item.name, item.namespace, item.nodeName, item.podIp],
          normalizedKeyword,
        )
      }),
    [nodeFilter, normalizedKeyword, phaseFilter, pods, pvcFilter, restartFilter],
  )

  const orderedPods = useMemo(
    () =>
      [...filteredPods].sort((left, right) => {
        const nameCompare = compareStrings(left.name, right.name)
        if (nameCompare !== 0) return nameCompare
        return compareStrings(left.namespace, right.namespace)
      }),
    [filteredPods],
  )
  const selectedPods = useMemo(
    () => pods.filter((item) => selectedPodKeys.includes(`${item.namespace}/${item.name}`)),
    [pods, selectedPodKeys],
  )
  const hasSelectedPodsWithoutDeleteAction = selectedPods.some(
    (item) => !hasAllowedAction(item.allowedActions, 'delete'),
  )
  const podDeleteDisabled =
    podDeleteCapability.isLoading ||
    podDeleteCapability.disabled ||
    (podDeleteCapability.mode === 'agent' && podDeleteCapability.status === 'partial')
  const canShowPodDeleteActions =
    canDeletePods &&
    !podDeleteDisabled &&
    pods.some((item) => hasAllowedAction(item.allowedActions, 'delete'))
  const podDeleteDisabledReason = podDeleteDisabled
    ? podDeleteCapability.isLoading
      ? localeCode === 'zh_CN'
        ? '正在读取当前集群的 Pod 删除能力。'
        : 'Reading pod delete capability for the current cluster.'
      : podDeleteCapability.reason ||
        (localeCode === 'zh_CN'
          ? '当前集群连接模式暂不支持 Pod 删除。'
          : 'The current cluster connection mode does not support pod deletion.')
    : ''
  const canDeleteSelectedPods =
    !!clusterId &&
    selectedPods.length > 0 &&
    !hasSelectedPodsWithoutDeleteAction &&
    !podDeleteDisabled
  const batchDeleteDisabledReason =
    selectedPods.length === 0
      ? localeCode === 'zh_CN'
        ? '先选择要删除的 Pod'
        : 'Select pods first'
      : podDeleteDisabledReason
        ? podDeleteDisabledReason
        : hasSelectedPodsWithoutDeleteAction
          ? localeCode === 'zh_CN'
            ? '部分 Pod 当前不允许删除'
            : 'Some selected pods do not allow delete'
          : ''

  const deletePodMutation = useMutation(podMutations.remove(queryClient))
  const batchDeletePodsMutation = useMutation(podMutations.removeBatch(queryClient))

  const handleRefresh = async () => {
    if (!clusterId || manualRefreshPending) {
      return
    }
    setManualRefreshPending(true)
    try {
      await podsQuery.refetch()
    } finally {
      setManualRefreshPending(false)
    }
  }

  const columns: TableColumnsType<Pod> = [
    {
      title: 'Pod',
      dataIndex: 'name',
      fixed: 'left',
      width: 360,
      ellipsis: { showTitle: false },
      sorter: podSorter((left, right) => {
        const nameCompare = compareStrings(left.name, right.name)
        if (nameCompare !== 0) return nameCompare
        return compareStrings(left.namespace, right.namespace)
      }),
      defaultSortOrder: 'ascend',
      render: (_name: string, record: Pod) =>
        renderPodNameCell(record, () =>
          navigate(
            buildWorkloadDetailPath('pods', record.name, namespace, record.namespace, clusterId),
          ),
        ),
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 132,
      sorter: podSorter((left, right) => compareStrings(left.namespace, right.namespace)),
      render: (value: string) => (
        <Tag variant="filled" color="blue" className="soha-pod-table-namespace-tag">
          {value || '-'}
        </Tag>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'podIp',
      width: 128,
      sorter: podSorter((left, right) => compareStrings(left.podIp, right.podIp)),
      render: (value?: string) => value || '-',
    },
    {
      title: localeCode === 'zh_CN' ? '节点' : 'Node',
      dataIndex: 'nodeName',
      width: 180,
      ellipsis: { showTitle: false },
      sorter: podSorter((left, right) => compareStrings(left.nodeName, right.nodeName)),
      render: (value?: string) => (
        <Tooltip title={value || '-'} placement="topLeft">
          <Text className="soha-pod-table-node-text">{value || '-'}</Text>
        </Tooltip>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '运行时间' : 'Age',
      dataIndex: 'ageSeconds',
      width: 96,
      sorter: podSorter((left, right) => left.ageSeconds - right.ageSeconds),
      render: (value: number) => formatAgeSeconds(value),
    },
    {
      title: localeCode === 'zh_CN' ? '运行状态' : 'Runtime',
      dataIndex: 'phase',
      width: 104,
      sorter: podSorter((left, right) => compareStrings(left.phase, right.phase)),
      render: (phase: string) => <StatusTag value={phase} />,
    },
    {
      title: localeCode === 'zh_CN' ? '容器' : 'Containers',
      dataIndex: 'readyContainers',
      width: 120,
      sorter: podSorter((left, right) => {
        const leftReady = parseReadyContainers(left.readyContainers)
        const rightReady = parseReadyContainers(right.readyContainers)
        if (leftReady.total !== rightReady.total) return leftReady.total - rightReady.total
        return leftReady.ready - rightReady.ready
      }),
      render: (readyContainers: string) =>
        renderPodReadyCell(readyContainers, localeCode === 'zh_CN' ? '就绪' : 'Ready'),
    },
    {
      title: localeCode === 'zh_CN' ? '重启' : 'Restarts',
      dataIndex: 'restarts',
      width: 64,
      sorter: podSorter((left, right) => left.restarts - right.restarts),
      render: (value: number) => (
        <Tag variant="filled" color={value > 0 ? 'warning' : 'default'}>
          {value}
        </Tag>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? 'CPU 使用 / 请求 / 限制' : 'CPU Use / Req / Limit',
      key: 'cpu-resource',
      width: 150,
      sorter: podSorter(
        (left, right) =>
          getPodResourceAmount('cpu', left.cpu) - getPodResourceAmount('cpu', right.cpu),
      ),
      render: (_: unknown, record: Pod) =>
        renderPodResourceLimitComparison(record, 'cpu', localeCode),
    },
    {
      title: localeCode === 'zh_CN' ? '内存 使用 / 请求 / 限制' : 'Memory Use / Req / Limit',
      key: 'memory-resource',
      width: 150,
      sorter: podSorter(
        (left, right) =>
          getPodResourceAmount('memory', left.memory) -
          getPodResourceAmount('memory', right.memory),
      ),
      render: (_: unknown, record: Pod) =>
        renderPodResourceLimitComparison(record, 'memory', localeCode),
    },
    {
      fixed: 'right',
      title: localeCode === 'zh_CN' ? '操作' : 'Actions',
      dataIndex: 'name',
      key: 'actions',
      width: 116,
      align: 'center',
      className: `${TABLE_ACTIONS_COLUMN_CLASS_NAME} soha-pod-actions-column`,
      onHeaderCell: () => ({
        className: `${TABLE_ACTIONS_COLUMN_CLASS_NAME} soha-pod-actions-column`,
      }),
      onCell: () => ({ className: `${TABLE_ACTIONS_COLUMN_CLASS_NAME} soha-pod-actions-column` }),
      render: (_value: string, record: Pod) => {
        const canOpenLogs = canViewPodLogs && hasAllowedAction(record.allowedActions, 'logs')
        const canOpenTerminal = canExecPods && hasAllowedAction(record.allowedActions, 'exec')
        const canDeletePod = canDeletePods && hasAllowedAction(record.allowedActions, 'delete')
        const logsDisabled = !clusterId || podLogsCapability.isLoading || podLogsCapability.disabled
        const terminalDisabled =
          !clusterId ||
          podExecCapability.isLoading ||
          podExecCapability.disabled ||
          podExecCapability.status === 'partial'
        const logLabel = localeCode === 'zh_CN' ? '打开日志会话' : 'Open log session'
        const terminalLabel = localeCode === 'zh_CN' ? '打开终端会话' : 'Open terminal session'
        const deleteLabel = localeCode === 'zh_CN' ? '删除 Pod' : 'Delete pod'

        return (
          <Space size={4} className="soha-deployment-action-cell">
            {canOpenLogs ? (
              <ManagementIconButton
                aria-label={logLabel}
                disabled={logsDisabled}
                icon={<FileTextOutlined />}
                tooltip={capabilityActionTooltip(logLabel, podLogsCapability)}
                onClick={() => {
                  if (!clusterId) return
                  openSession({
                    clusterId,
                    kind: 'logs',
                    namespace: record.namespace,
                    podName: record.name,
                    streamingDisabledReason:
                      podLogsCapability.status === 'partial' ? podLogsCapability.reason : undefined,
                  })
                }}
              />
            ) : null}
            {canOpenTerminal ? (
              <ManagementIconButton
                aria-label={terminalLabel}
                disabled={terminalDisabled}
                icon={<CodeOutlined />}
                tooltip={capabilityActionTooltip(terminalLabel, podExecCapability)}
                onClick={() => {
                  if (!clusterId) return
                  openSession({
                    clusterId,
                    kind: 'terminal',
                    namespace: record.namespace,
                    podName: record.name,
                    shell: '/bin/sh',
                  })
                }}
              />
            ) : null}
            {canDeletePod ? (
              <ManagementIconButton
                danger
                aria-label={deleteLabel}
                disabled={podDeleteDisabled}
                icon={<DeleteOutlined />}
                loading={deletePodMutation.isPending}
                tooltip={capabilityActionTooltip(deleteLabel, podDeleteCapability)}
                onClick={() =>
                  modal.confirm({
                    title:
                      localeCode === 'zh_CN'
                        ? `确认删除 Pod ${record.name}？`
                        : `Delete pod ${record.name}?`,
                    content:
                      localeCode === 'zh_CN'
                        ? '独立 Pod 会直接消失；受控制器管理的 Pod 可能会自动创建替代实例。'
                        : 'Standalone pods are removed. A controller-managed pod may be replaced automatically.',
                    okText: localeCode === 'zh_CN' ? '删除' : 'Delete',
                    cancelText: localeCode === 'zh_CN' ? '取消' : 'Cancel',
                    okButtonProps: { danger: true },
                    onOk: async () => {
                      try {
                        await deletePodMutation.mutateAsync(podTargetFromRecord(clusterId, record))
                        void message.success(localeCode === 'zh_CN' ? 'Pod 已删除' : 'Pod deleted')
                        void podsQuery.refetch()
                      } catch (error) {
                        void message.error(error instanceof Error ? error.message : String(error))
                        throw error
                      }
                    },
                  })
                }
              />
            ) : null}
          </Space>
        )
      },
    },
  ]

  const podQueryPanel = (
    <WorkloadQueryPanel
      hasActiveFilters={
        Boolean(searchKeyword.trim()) ||
        phaseFilter !== 'all' ||
        restartFilter !== 'all' ||
        pvcFilter !== 'all' ||
        nodeFilter !== 'all'
      }
      localeCode={localeCode}
      onReset={() => {
        setSearchKeyword('')
        setPhaseFilter('all')
        setRestartFilter('all')
        setPvcFilter('all')
        setNodeFilter('all')
      }}
    >
      <WorkloadSearchInput
        label={localeCode === 'zh_CN' ? '关键词' : 'Keyword'}
        value={searchKeyword}
        onChange={setSearchKeyword}
        placeholder={localeCode === 'zh_CN' ? '搜索 Pod / Node / IP' : 'Search pod / node / IP'}
      />
      <ManagementQueryField label={localeCode === 'zh_CN' ? '状态' : 'Phase'}>
        <Select
          className="soha-platform-compact-field"
          size="small"
          value={phaseFilter}
          onChange={(value) => setPhaseFilter(String(value || 'all'))}
          options={[
            { value: 'all', label: localeCode === 'zh_CN' ? '全部状态' : 'All phases' },
            { value: 'Running', label: 'Running' },
            { value: 'Pending', label: 'Pending' },
            { value: 'Succeeded', label: 'Succeeded' },
            { value: 'Failed', label: 'Failed' },
            { value: 'Unknown', label: 'Unknown' },
          ]}
        />
      </ManagementQueryField>
      <ManagementQueryField label={localeCode === 'zh_CN' ? '重启' : 'Restarts'}>
        <Select
          className="soha-platform-compact-field"
          size="small"
          value={restartFilter}
          onChange={(value) => setRestartFilter(String(value || 'all'))}
          options={[
            {
              value: 'all',
              label: localeCode === 'zh_CN' ? '全部重启状态' : 'All restart states',
            },
            {
              value: 'restarting',
              label: localeCode === 'zh_CN' ? '仅有重启' : 'Restarted only',
            },
            { value: 'clean', label: localeCode === 'zh_CN' ? '仅无重启' : 'No restarts' },
          ]}
        />
      </ManagementQueryField>
      <ManagementQueryField label={localeCode === 'zh_CN' ? '存储' : 'Storage'}>
        <Select
          className="soha-platform-compact-field"
          size="small"
          value={pvcFilter}
          onChange={(value) => setPvcFilter(String(value || 'all'))}
          options={[
            {
              value: 'all',
              label: localeCode === 'zh_CN' ? '全部存储状态' : 'All storage states',
            },
            {
              value: 'with-pvc',
              label: localeCode === 'zh_CN' ? '仅挂载 PVC' : 'With PVC only',
            },
            {
              value: 'without-pvc',
              label: localeCode === 'zh_CN' ? '仅无 PVC' : 'Without PVC',
            },
          ]}
        />
      </ManagementQueryField>
      <ManagementQueryField label={localeCode === 'zh_CN' ? '节点' : 'Node'}>
        <Select
          className="soha-platform-compact-field"
          size="small"
          value={nodeFilter}
          onChange={(value) => setNodeFilter(String(value || 'all'))}
          options={[
            { value: 'all', label: localeCode === 'zh_CN' ? '全部节点' : 'All nodes' },
            ...nodeOptions.map((item) => ({ value: item, label: item })),
          ]}
        />
      </ManagementQueryField>
    </WorkloadQueryPanel>
  )

  const podBatchBar =
    canShowPodDeleteActions && selectedPodKeys.length > 0 ? (
      <ManagementBatchBar
        selectedCount={selectedPodKeys.length}
        selectedLabel={
          localeCode === 'zh_CN'
            ? `已选 ${selectedPodKeys.length} 个 Pod`
            : `${selectedPodKeys.length} pods selected`
        }
      >
        <Tooltip title={batchDeleteDisabledReason}>
          <span>
            <Popconfirm
              title={
                localeCode === 'zh_CN'
                  ? `确认删除 ${selectedPods.length} 个 Pod？`
                  : `Delete ${selectedPods.length} pods?`
              }
              description={
                localeCode === 'zh_CN'
                  ? '这会删除已选 Pod。受控制器管理的 Pod 会按控制器策略重建；独立 Pod 会直接消失。'
                  : 'This deletes the selected pods. Controller-managed pods may be recreated; standalone pods are removed.'
              }
              okText={localeCode === 'zh_CN' ? '删除' : 'Delete'}
              cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
              okButtonProps={{ danger: true, loading: batchDeletePodsMutation.isPending }}
              placement="topRight"
              disabled={!canDeleteSelectedPods}
              onConfirm={() =>
                batchDeletePodsMutation.mutate(
                  {
                    targets: selectedPods.map((item) => podTargetFromRecord(clusterId, item)),
                  },
                  {
                    onSuccess: (results) => {
                      const successCount = results.filter(
                        (item) => item.status === 'fulfilled',
                      ).length
                      const failureCount = results.length - successCount
                      void message.success(
                        failureCount > 0
                          ? localeCode === 'zh_CN'
                            ? `批量删除完成，成功 ${successCount}，失败 ${failureCount}`
                            : `Batch delete finished: ${successCount} succeeded, ${failureCount} failed`
                          : localeCode === 'zh_CN'
                            ? `已删除 ${successCount} 个 Pod`
                            : `Deleted ${successCount} pods`,
                      )
                      setSelectedPodKeys([])
                      void podsQuery.refetch()
                    },
                    onError: (error) => void message.error(error.message),
                  },
                )
              }
            >
              <Button
                autoInsertSpace={false}
                danger
                disabled={!canDeleteSelectedPods}
                loading={batchDeletePodsMutation.isPending}
                size="small"
                variant="outlined"
              >
                {localeCode === 'zh_CN' ? '批量删除' : 'Batch Delete'}
              </Button>
            </Popconfirm>
          </span>
        </Tooltip>
      </ManagementBatchBar>
    ) : null

  const podToolbarExtra = (
    <ManagementTableToolbar batchBar={podBatchBar}>
      <div className="soha-refresh-controls">
        <Text className="soha-refresh-meta" type="secondary">
          {localeCode === 'zh_CN' ? '自动刷新' : 'Auto refresh'}
        </Text>
        <Switch
          size="small"
          checked={autoRefreshEnabled}
          onChange={setAutoRefreshEnabled}
          disabled={!clusterId || podStream.live}
        />
        <Select
          className="soha-platform-compact-field"
          size="small"
          value={autoRefreshIntervalSeconds}
          onChange={(value) => setAutoRefreshIntervalSeconds(Number(value))}
          disabled={!clusterId || podStream.live || !autoRefreshEnabled}
          style={{ width: 96 }}
          options={[
            { value: 5, label: localeCode === 'zh_CN' ? '5 秒' : '5s' },
            { value: 15, label: localeCode === 'zh_CN' ? '15 秒' : '15s' },
            { value: 30, label: localeCode === 'zh_CN' ? '30 秒' : '30s' },
          ]}
        />
      </div>
      <ResourceStreamStatus
        status={podStream.status}
        lastEventAt={podStream.lastEventAt}
        localeCode={localeCode}
      />
      {densityButton}
      <WorkloadRefreshButton
        label={t('common.refresh', 'Refresh')}
        loading={manualRefreshPending}
        disabled={!clusterId || manualRefreshPending}
        onRefresh={() => void handleRefresh()}
      />
    </ManagementTableToolbar>
  )

  return (
    <div className="soha-page">
      {podQueryPanel}
      <AdminTable
        className="soha-pods-table soha-platform-table"
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        headerExtra={podToolbarExtra}
        columns={columns}
        dataSource={orderedPods}
        rowKey={(record) => `${record.namespace}/${record.name}`}
        onRow={(record: Pod) => ({
          'data-ai-context': encodeAIContextForElement({
            sourceWorkbench: 'platform',
            sourceRoute: buildWorkloadDetailPath(
              'pods',
              record.name,
              namespace,
              record.namespace,
              clusterId,
            ),
            sourceTitle: `Pod ${record.name}`,
            entityKind: 'kubernetes.pod',
            entityName: record.name,
            clusterId: clusterId ?? undefined,
            namespace: record.namespace,
            pod: record.name,
            node: record.nodeName,
            timeRangeMinutes: 60,
          }),
        })}
        loading={isLoading}
        localSorting
        empty={
          <WorkloadTableEmpty
            clusterId={clusterId}
            filteredCount={orderedPods.length}
            localeCode={localeCode}
            resourceLabel="Pods"
            totalCount={pods.length}
          />
        }
        pageSize={K8S_TABLE_PAGE_SIZE}
        tableSize={tableSize}
        scroll={{ x: 1540 }}
        viewportScroll
        selectCurrentPageOnly
        rowSelection={
          canShowPodDeleteActions
            ? {
                columnWidth: 44,
                selectedRowKeys: selectedPodKeys,
                onChange: (selectedRowKeys: string[]) => setSelectedPodKeys(selectedRowKeys),
              }
            : undefined
        }
      />
    </div>
  )
}
