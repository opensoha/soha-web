import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Alert,
  Button,
  Descriptions,
  Drawer,
  Popconfirm,
  Segmented,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { DrawerProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ComponentProps, Key } from 'react'
import {
  FileTextOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { hasAllowedAction } from '@/features/auth'
import { getAIWorkbenchPathForMode } from '@/features/copilot'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementQueryField,
  ManagementQueryPanel,
  ManagementTableToolbar,
} from '@/components/management-list'
import {
  virtualizationMutations,
  withVirtualizationMutationSuccess,
} from '@/features/virtualization/mutations'
import { virtualizationQueries } from '@/features/virtualization/queries'
import { useVirtualizationPermissions } from '@/features/virtualization/shared/use-virtualization-permissions'
import {
  OPERATION_FILTER_PRESETS,
  STATUS_COLORS,
  buildOperationFilter,
  bulkActionSummary,
  classNames,
  formatOperationDuration,
  isAbnormalOperation,
  isPendingOperation,
  isSyncOperation,
  isVMOperation,
  latestNonEmptyOperationMessage,
  localTableSummary,
  nextOperationSearch,
  operationKind,
  operationParamsFromSearch,
  operationTime,
  selectableOperationIds,
} from '@/features/virtualization/virtualization-model'
import type {
  OperationFilterPreset,
  OverviewTone,
} from '@/features/virtualization/virtualization-model'
import '@/features/virtualization/virtualization-workbench.css'
import type { VirtualizationOperation } from '@/features/virtualization/virtualization-types'

const { Text } = Typography

const stableDrawerMotion = null as unknown as DrawerProps['motion']

const tableEllipsis = { showTitle: false } as const

function statusTag(value?: string) {
  if (!value) return <Text type="secondary">-</Text>
  const key = value.toLowerCase()
  return <Tag color={STATUS_COLORS[key] ?? 'default'}>{value}</Tag>
}

function tableTooltipText(value: unknown) {
  const text = String(value ?? '').trim() || '-'
  const content = <span className="soha-vrt-table-tooltip-text">{text}</span>
  if (text === '-') return content
  return (
    <Tooltip
      placement="topLeft"
      title={<span className="soha-vrt-table-tooltip-content">{text}</span>}
    >
      {content}
    </Tooltip>
  )
}

function VirtualizationAdminTable({
  className,
  columnSettingIconOnly = true,
  columnSettingPlacement = 'header',
  shellClassName,
  tableSize = 'small',
  ...props
}: ComponentProps<typeof AdminTable>) {
  return (
    <AdminTable
      {...props}
      className={classNames('soha-vrt-table', className)}
      columnSettingIconOnly={columnSettingIconOnly}
      columnSettingPlacement={columnSettingPlacement}
      shellClassName={classNames('soha-management-table-shell', shellClassName)}
      tableSize={tableSize}
    />
  )
}

function buildInvestigationPath(params: {
  clusterId?: string
  namespace?: string
  workload?: string
  connectionId?: string
  vmId?: string
  provider?: string
  timeRangeMinutes?: number
}) {
  const search = new URLSearchParams()
  search.set('mode', 'root_cause')
  search.set('timeRangeMinutes', String(params.timeRangeMinutes ?? 60))
  if (params.clusterId) search.set('clusterId', params.clusterId)
  if (params.namespace) search.set('namespace', params.namespace)
  if (params.workload) search.set('workload', params.workload)
  if (params.connectionId) search.set('connectionId', params.connectionId)
  if (params.vmId) search.set('vmId', params.vmId)
  if (params.provider) search.set('provider', params.provider)
  return getAIWorkbenchPathForMode('root_cause', search)
}

export function OperationsTable({
  assetType,
  initialPreset = 'all',
  toolbarExtra,
}: {
  assetType?: string
  initialPreset?: OperationFilterPreset
  toolbarExtra?: React.ReactNode
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const parsedSearch = useMemo(() => operationParamsFromSearch(location.search), [location.search])
  const [selectedOperation, setSelectedOperation] = useState<VirtualizationOperation | null>(null)
  const [preset, setPreset] = useState<OperationFilterPreset>(initialPreset)
  const [selectedTaskRowKeys, setSelectedTaskRowKeys] = useState<React.Key[]>([])
  const { virtualizationModuleEnabled, canManageOperations } = useVirtualizationPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const operationParams = {
    assetType: assetType ?? parsedSearch.query.assetType,
    taskKind: assetType ? undefined : parsedSearch.query.taskKind,
    abnormal: parsedSearch.query.abnormal,
    pending: parsedSearch.query.pending,
    statuses: parsedSearch.query.statuses,
    connectionId: parsedSearch.query.connectionId,
    vmId: parsedSearch.query.vmId,
    search: parsedSearch.query.search,
  }
  const operationsQuery = useQuery(
    virtualizationQueries.operations(operationParams, virtualizationModuleEnabled),
  )
  const logsQuery = useQuery(
    virtualizationQueries.operationLogs(
      selectedOperation?.id ?? '',
      virtualizationModuleEnabled && Boolean(selectedOperation?.id),
    ),
  )

  useEffect(() => {
    setPreset(assetType ? 'asset_sync' : parsedSearch.preset || initialPreset)
  }, [assetType, initialPreset, parsedSearch.preset])

  const operations = operationsQuery.data ?? []
  const hasServerFilters = Boolean(
    parsedSearch.query.abnormal ||
    parsedSearch.query.pending ||
    parsedSearch.query.connectionId ||
    parsedSearch.query.vmId ||
    parsedSearch.query.search ||
    parsedSearch.query.statuses?.length ||
    parsedSearch.query.taskKind ||
    parsedSearch.query.assetType,
  )
  const filteredOperations = useMemo(
    () => (hasServerFilters ? operations : buildOperationFilter(operations, preset)),
    [hasServerFilters, operations, preset],
  )
  const logs = logsQuery.data ?? []
  const cancelMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.cancelOperation(queryClient), () =>
      message.success('取消请求已提交'),
    ),
  )
  const retryMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.retryOperation(queryClient), () =>
      message.success('重试任务已提交'),
    ),
  )
  const batchCancelMutation = useMutation(
    withVirtualizationMutationSuccess(
      virtualizationMutations.cancelOperations(queryClient),
      (_response, ids) => {
        message.success(`已提交 ${ids.length} 个任务的取消请求`)
        setSelectedTaskRowKeys([])
      },
    ),
  )
  const batchRetryMutation = useMutation(
    withVirtualizationMutationSuccess(
      virtualizationMutations.retryOperations(queryClient),
      (_response, ids) => {
        message.success(`已提交 ${ids.length} 个任务的重试请求`)
        setSelectedTaskRowKeys([])
      },
    ),
  )
  const columns: ColumnsType<VirtualizationOperation> = [
    {
      title: '类型',
      dataIndex: 'operationType',
      render: (_value, record) => tableTooltipText(operationKind(record)),
      ellipsis: tableEllipsis,
      width: 140,
    },
    {
      title: '资源',
      dataIndex: 'targetName',
      render: (value, record) =>
        tableTooltipText(value || record.targetType || record.assetType || '-'),
      ellipsis: tableEllipsis,
      width: 180,
    },
    {
      title: '连接',
      dataIndex: 'connectionName',
      render: (value, record) => tableTooltipText(value || record.connectionId || '-'),
      ellipsis: tableEllipsis,
      width: 200,
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'status',
      render: statusTag,
      width: 120,
    },
    {
      title: '异常摘要',
      dataIndex: 'message',
      render: (_value, record) => tableTooltipText(latestNonEmptyOperationMessage(record)),
      ellipsis: tableEllipsis,
      width: 320,
    },
    {
      title: '运行时长',
      render: (_value, record) => tableTooltipText(formatOperationDuration(record)),
      ellipsis: tableEllipsis,
      width: 140,
    },
    {
      ...tableColumnPresets.datetime,
      title: '最近心跳',
      dataIndex: 'lastHeartbeatAt',
      render: (value) => tableTooltipText(formatDateTime(value)),
      ellipsis: tableEllipsis,
      width: 180,
    },
    {
      ...tableColumnPresets.datetime,
      title: '开始时间',
      dataIndex: 'startedAt',
      render: (_value, record) => tableTooltipText(formatDateTime(operationTime(record))),
      ellipsis: tableEllipsis,
      width: 180,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      dataIndex: 'id',
      width: 176,
      render: (_value, record) => {
        const canCancel = canManageOperations && hasAllowedAction(record.allowedActions, 'cancel')
        const canRetry = canManageOperations && hasAllowedAction(record.allowedActions, 'retry')
        return (
          <Space className="soha-row-action-icons" wrap>
            <ManagementIconButton
              aria-label="查看日志"
              size="small"
              tooltip="日志"
              icon={<FileTextOutlined />}
              onClick={() => setSelectedOperation(record)}
            />
            <ManagementIconButton
              aria-label="AI 调查"
              size="small"
              tooltip="AI 调查"
              icon={<SearchOutlined />}
              onClick={() =>
                navigate(
                  buildInvestigationPath({
                    connectionId: record.connectionId,
                    vmId: record.vmId,
                    workload: record.targetName || record.vmId || record.connectionId,
                    timeRangeMinutes: 60,
                  }),
                )
              }
            />
            {record.vmId ? (
              <ManagementIconButton
                aria-label="查看虚拟机"
                size="small"
                tooltip="VM"
                icon={<FileTextOutlined />}
                onClick={() =>
                  navigate(
                    `/virtualization/vms/${encodeURIComponent(record.vmId || '')}?focus=operations`,
                  )
                }
              />
            ) : null}
            {canCancel ? (
              <Popconfirm title="确认取消任务？" onConfirm={() => cancelMutation.mutate(record.id)}>
                <ManagementIconButton
                  aria-label="取消任务"
                  size="small"
                  tooltip="取消"
                  danger
                  icon={<PoweroffOutlined />}
                />
              </Popconfirm>
            ) : null}
            {canRetry ? (
              <ManagementIconButton
                aria-label="重试任务"
                size="small"
                tooltip="重试"
                icon={<ReloadOutlined />}
                onClick={() => retryMutation.mutate(record.id)}
              />
            ) : null}
          </Space>
        )
      },
    },
  ]

  const counts = {
    pending: operations.filter((record) => isPendingOperation(record.status)).length,
    abnormal: operations.filter((record) => isAbnormalOperation(record.status)).length,
    sync: operations.filter((record) => isSyncOperation(record)).length,
    vm: operations.filter((record) => isVMOperation(record)).length,
  }
  const statusSummary = [
    {
      key: 'pending',
      label: '待处理',
      value: counts.pending,
      tone: counts.pending > 0 ? 'warning' : 'default',
    },
    {
      key: 'abnormal',
      label: '失败/超时',
      value: counts.abnormal,
      tone: counts.abnormal > 0 ? 'danger' : 'default',
    },
    { key: 'sync', label: '同步任务', value: counts.sync },
    { key: 'vm', label: 'VM 任务', value: counts.vm },
  ] satisfies Array<{ key: string; label: string; value: number; tone?: OverviewTone }>
  const selectPreset = (nextPreset: OperationFilterPreset) => {
    setPreset(nextPreset)
    navigate({
      pathname: location.pathname,
      search: nextOperationSearch(nextPreset, {
        connectionId: parsedSearch.query.connectionId,
        vmId: parsedSearch.query.vmId,
        taskKind: parsedSearch.query.taskKind,
        search: parsedSearch.query.search,
        statuses: parsedSearch.query.statuses,
      }),
    })
  }
  const resetOperationFilters = () => {
    const nextPreset: OperationFilterPreset = assetType ? 'asset_sync' : 'all'
    setSelectedTaskRowKeys([])
    setPreset(nextPreset)
    navigate({
      pathname: location.pathname,
      search: assetType ? '' : nextOperationSearch(nextPreset, {}),
    })
  }

  return (
    <>
      <div className="soha-vrt-query soha-vrt-operations-query">
        <ManagementQueryPanel
          collapsible
          actions={
            <Space size={8}>
              <Button onClick={resetOperationFilters}>重置</Button>
              <Button
                icon={<ReloadOutlined />}
                loading={operationsQuery.isFetching}
                onClick={() => operationsQuery.refetch()}
              >
                刷新
              </Button>
            </Space>
          }
        >
          <ManagementQueryField label="任务视图" minWidth={300} width={360}>
            {assetType === 'asset_sync' ? (
              <Tag color="blue">同步任务</Tag>
            ) : (
              <Segmented
                size="small"
                value={preset}
                options={OPERATION_FILTER_PRESETS.map((item) => ({
                  label: item.label,
                  value: item.key,
                }))}
                onChange={(value) => selectPreset(value as OperationFilterPreset)}
              />
            )}
          </ManagementQueryField>
          <ManagementQueryField grow label="任务统计" minWidth={420} width={560}>
            <div className="soha-vrt-commandbar-meta">
              {statusSummary.map((item) => (
                <span key={item.key}>
                  {item.label}
                  <Text strong>{item.value}</Text>
                </span>
              ))}
            </div>
          </ManagementQueryField>
        </ManagementQueryPanel>
      </div>
      <VirtualizationAdminTable
        rowKey="id"
        headerExtra={
          toolbarExtra ? <ManagementTableToolbar>{toolbarExtra}</ManagementTableToolbar> : null
        }
        toolbarExtra={
          selectedTaskRowKeys.length > 0 ? (
            <div className="soha-vrt-selection-bar">
              <Text type="secondary">已选择 {selectedTaskRowKeys.length} 个任务</Text>
              <Space wrap>
                {canManageOperations ? (
                  <Popconfirm
                    title="确认批量取消任务？"
                    description={bulkActionSummary(
                      '将取消',
                      filteredOperations
                        .filter((record) => selectedTaskRowKeys.includes(record.id))
                        .map((record) => record.targetName || record.id),
                    )}
                    onConfirm={() => batchCancelMutation.mutate(selectedTaskRowKeys.map(String))}
                  >
                    <Button
                      danger
                      disabled={selectedTaskRowKeys.some(
                        (id) =>
                          !selectableOperationIds(filteredOperations, 'cancel').includes(
                            String(id),
                          ),
                      )}
                      loading={batchCancelMutation.isPending}
                    >
                      批量取消
                    </Button>
                  </Popconfirm>
                ) : null}
                {canManageOperations ? (
                  <Popconfirm
                    title="确认批量重试任务？"
                    description={bulkActionSummary(
                      '将重试',
                      filteredOperations
                        .filter((record) => selectedTaskRowKeys.includes(record.id))
                        .map((record) => record.targetName || record.id),
                    )}
                    onConfirm={() => batchRetryMutation.mutate(selectedTaskRowKeys.map(String))}
                  >
                    <Button
                      type="primary"
                      disabled={selectedTaskRowKeys.some(
                        (id) =>
                          !selectableOperationIds(filteredOperations, 'retry').includes(String(id)),
                      )}
                      loading={batchRetryMutation.isPending}
                    >
                      批量重试
                    </Button>
                  </Popconfirm>
                ) : null}
                <Button onClick={() => setSelectedTaskRowKeys([])}>清空选择</Button>
              </Space>
            </div>
          ) : null
        }
        rowSelection={{
          selectedRowKeys: selectedTaskRowKeys,
          onChange: (keys: Key[]) => setSelectedTaskRowKeys(keys),
        }}
        loading={operationsQuery.isLoading}
        dataSource={filteredOperations}
        columns={columns}
        paginationSummary={localTableSummary(filteredOperations.length, operations.length)}
        scroll={{ x: 1640 }}
      />
      <Drawer
        title="任务日志"
        size="large"
        motion={stableDrawerMotion}
        open={Boolean(selectedOperation)}
        onClose={() => setSelectedOperation(null)}
      >
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="任务 ID">{selectedOperation?.id}</Descriptions.Item>
          <Descriptions.Item label="类型">
            {selectedOperation ? operationKind(selectedOperation) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="状态">{statusTag(selectedOperation?.status)}</Descriptions.Item>
          <Descriptions.Item label="资源">
            {selectedOperation?.targetName || selectedOperation?.targetType || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="连接">
            {selectedOperation?.connectionName || selectedOperation?.connectionId || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="VM">{selectedOperation?.vmId || '-'}</Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {formatDateTime(selectedOperation?.startedAt || selectedOperation?.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="最近心跳">
            {formatDateTime(selectedOperation?.lastHeartbeatAt)}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">
            {formatDateTime(selectedOperation?.completedAt)}
          </Descriptions.Item>
        </Descriptions>
        {selectedOperation?.message ? (
          <Alert
            className="mt-4"
            type={isAbnormalOperation(selectedOperation.status) ? 'error' : 'info'}
            title={selectedOperation.message}
          />
        ) : null}
        <div className="mt-4 flex justify-end">
          <Button
            size="small"
            onClick={async () => {
              const text =
                (logs.length
                  ? logs
                      .map(
                        (item) =>
                          `[${formatDateTime(item.createdAt)}] ${item.logLevel ?? 'info'} ${item.message}`,
                      )
                      .join('\n')
                  : selectedOperation?.logs?.length
                    ? selectedOperation.logs.join('\n')
                    : selectedOperation?.logText) ||
                selectedOperation?.message ||
                ''
              if (!text) return
              await navigator.clipboard.writeText(text)
              message.success('日志已复制')
            }}
          >
            复制日志
          </Button>
        </div>
        <pre className="mt-4 max-h-[520px] overflow-auto rounded border border-[var(--soha-border-color)] bg-[var(--soha-bg-surface-muted)] p-3 text-xs">
          {(logs.length
            ? logs
                .map(
                  (item) =>
                    `[${formatDateTime(item.createdAt)}] ${item.logLevel ?? 'info'} ${item.message}`,
                )
                .join('\n')
            : selectedOperation?.logs?.length
              ? selectedOperation.logs.join('\n')
              : selectedOperation?.logText) ||
            selectedOperation?.message ||
            (logsQuery.isLoading ? '日志加载中' : '暂无日志')}
        </pre>
      </Drawer>
    </>
  )
}
