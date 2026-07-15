import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Alert,
  Button,
  Descriptions,
  Drawer,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { DrawerProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ComponentProps, Key } from 'react'
import {
  CloudSyncOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
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
  ENABLED_FILTER_OPTIONS,
  STATUS_COLORS,
  VIRTUALIZATION_PROVIDER_FILTER_OPTIONS,
  bulkActionSummary,
  classNames,
  clusterRiskScore,
  isAbnormalOperation,
  isSyncOperation,
  latestNonEmptyOperationMessage,
  localTableSummary,
  operationKind,
  operationTime,
  providerLabel,
  riskReasons,
} from '@/features/virtualization/virtualization-model'
import type { EnabledFilter, ProviderFilter } from '@/features/virtualization/virtualization-model'
import { VirtualizationConnectionStepModal } from './create-page'
import '@/features/virtualization/virtualization-workbench.css'
import type {
  VirtualizationCluster,
  VirtualizationConnectionDeleteDependencies,
  VirtualizationOperation,
} from '@/features/virtualization/virtualization-types'

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

function tableTooltipTextButton(value: unknown, onClick: () => void) {
  const text = String(value ?? '').trim() || '-'
  if (text === '-') return <span className="soha-vrt-table-tooltip-text">-</span>
  return (
    <Tooltip
      placement="topLeft"
      title={<span className="soha-vrt-table-tooltip-content">{text}</span>}
    >
      <button className="soha-vrt-table-text-button" type="button" onClick={onClick}>
        {text}
      </button>
    </Tooltip>
  )
}

function dependencySampleText(samples?: VirtualizationConnectionDeleteDependencies['vmSamples']) {
  const names = (samples ?? [])
    .map((item) => item.name || item.externalId || item.id)
    .filter(Boolean)
  return names.length > 0 ? names.slice(0, 3).join('、') : '-'
}

function ConnectionDeletePreview({
  dependencies,
}: {
  dependencies: VirtualizationConnectionDeleteDependencies
}) {
  const pendingTaskCount = dependencies.pendingTaskCount ?? 0
  const forceRequired = dependencies.forceRequired === true
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      {pendingTaskCount > 0 ? (
        <Alert
          type="warning"
          showIcon
          title="存在未完成任务"
          description="请先取消或等待 queued/running 任务结束后再删除连接。"
        />
      ) : forceRequired ? (
        <Alert
          type="warning"
          showIcon
          title="删除将影响关联资源"
          description="确认后会使用 force 删除，后端会先为历史任务写入连接与 VM 快照。"
        />
      ) : (
        <Alert
          type="info"
          showIcon
          title="未发现关联资源"
          description="可以直接删除该虚拟化连接。"
        />
      )}
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="VM">{dependencies.vmCount ?? 0}</Descriptions.Item>
        <Descriptions.Item label="镜像">{dependencies.imageCount ?? 0}</Descriptions.Item>
        <Descriptions.Item label="规格">{dependencies.flavorCount ?? 0}</Descriptions.Item>
        <Descriptions.Item label="历史任务">{dependencies.taskCount ?? 0}</Descriptions.Item>
        <Descriptions.Item label="未完成任务">{pendingTaskCount}</Descriptions.Item>
        <Descriptions.Item label="Docker Host">
          {dependencies.dockerHostCount ?? 0}
        </Descriptions.Item>
        <Descriptions.Item label="VM 样例" span={2}>
          {dependencySampleText(dependencies.vmSamples)}
        </Descriptions.Item>
        <Descriptions.Item label="任务样例" span={2}>
          {dependencySampleText(dependencies.taskSamples)}
        </Descriptions.Item>
      </Descriptions>
    </Space>
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

export function VirtualizationClustersPage() {
  const navigate = useNavigate()
  const [editing, setEditing] = useState<VirtualizationCluster | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [showOnlyAbnormal, setShowOnlyAbnormal] = useState(false)
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>('all')
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all')
  const [showNeverSynced, setShowNeverSynced] = useState(false)
  const [selectedConnectionOperation, setSelectedConnectionOperation] =
    useState<VirtualizationOperation | null>(null)
  const [selectedClusterRowKeys, setSelectedClusterRowKeys] = useState<React.Key[]>([])
  const [deletePreview, setDeletePreview] = useState<{
    cluster: VirtualizationCluster
    dependencies: VirtualizationConnectionDeleteDependencies
  } | null>(null)
  const { virtualizationModuleEnabled, canManageClusters, canSync } = useVirtualizationPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const clustersQuery = useQuery(virtualizationQueries.clusters(virtualizationModuleEnabled))
  const clusterOperationsQuery = useQuery(
    virtualizationQueries.operations({}, virtualizationModuleEnabled),
  )
  const deletePreviewMutation = useMutation(virtualizationMutations.clusterDeleteDependencies())
  const deleteMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.deleteCluster(queryClient), () => {
      message.success('连接已删除')
      setDeletePreview(null)
    }),
  )
  const testMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.testCluster(queryClient), () =>
      message.success('测试任务已提交'),
    ),
  )
  const syncMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.syncCluster(queryClient), () =>
      message.success('同步任务已提交'),
    ),
  )
  const batchSyncMutation = useMutation(
    withVirtualizationMutationSuccess(
      virtualizationMutations.syncClusters(queryClient),
      (_response, ids) => {
        message.success(`已提交 ${ids.length} 个连接的同步任务`)
        setSelectedClusterRowKeys([])
      },
    ),
  )
  const batchTestMutation = useMutation(
    withVirtualizationMutationSuccess(
      virtualizationMutations.testClusters(queryClient),
      (_response, ids) => {
        message.success(`已提交 ${ids.length} 个连接的测试任务`)
        setSelectedClusterRowKeys([])
      },
    ),
  )
  function openEditor(record?: VirtualizationCluster) {
    setEditing(record ?? null)
    setEditorOpen(true)
  }

  const clusterRows = useMemo(() => {
    const records = clustersQuery.data ?? []
    return [...records]
      .filter((record) => !showOnlyAbnormal || riskReasons(record).length > 0)
      .filter(
        (record) =>
          enabledFilter === 'all' ||
          (enabledFilter === 'enabled' ? record.enabled !== false : record.enabled === false),
      )
      .filter((record) => providerFilter === 'all' || record.provider === providerFilter)
      .filter((record) => !showNeverSynced || !record.lastSyncedAt)
      .sort(
        (left, right) =>
          clusterRiskScore(left) - clusterRiskScore(right) || left.name.localeCompare(right.name),
      )
  }, [clustersQuery.data, enabledFilter, providerFilter, showNeverSynced, showOnlyAbnormal])
  const clusterOperations = clusterOperationsQuery.data ?? []
  function operationsForConnection(connectionId?: string) {
    if (!connectionId) return []
    return clusterOperations.filter((item) => item.connectionId === connectionId)
  }

  function failedSyncForConnection(connectionId?: string) {
    return operationsForConnection(connectionId).find(
      (item) => isSyncOperation(item) && isAbnormalOperation(item.status),
    )
  }

  function latestAbnormalForConnection(connectionId?: string) {
    return operationsForConnection(connectionId).find((item) => isAbnormalOperation(item.status))
  }

  function resetClusterFilters() {
    setShowOnlyAbnormal(false)
    setEnabledFilter('all')
    setProviderFilter('all')
    setShowNeverSynced(false)
  }

  const columns: ColumnsType<VirtualizationCluster> = [
    {
      title: '名称',
      dataIndex: 'name',
      render: tableTooltipText,
      ellipsis: tableEllipsis,
      width: 180,
    },
    { title: 'Provider', dataIndex: 'provider', render: providerLabel, width: 120 },
    {
      title: '接入目标',
      render: (_value, record) =>
        tableTooltipText(
          record.provider === 'kubevirt'
            ? record.kubernetesClusterId || '-'
            : record.endpoint || '-',
        ),
      ellipsis: tableEllipsis,
      width: 280,
    },
    {
      title: '健康',
      dataIndex: 'health',
      render: (value, record) => statusTag(value || record.status),
      width: 120,
    },
    {
      title: '风险',
      render: (_value, record) => tableTooltipText(riskReasons(record).join(' / ') || '正常'),
      ellipsis: tableEllipsis,
      width: 240,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      render: (value: string | undefined) =>
        value ? (
          <Tag
            color={
              value === 'critical'
                ? 'red'
                : value === 'warning'
                  ? 'gold'
                  : value === 'attention'
                    ? 'blue'
                    : 'default'
            }
          >
            {value}
          </Tag>
        ) : (
          '-'
        ),
      width: 120,
    },
    {
      title: '最近失败同步',
      render: (_value, record) => {
        const failedSync = failedSyncForConnection(record.id)
        return failedSync
          ? tableTooltipTextButton(latestNonEmptyOperationMessage(failedSync), () =>
              setSelectedConnectionOperation(failedSync),
            )
          : '-'
      },
      ellipsis: tableEllipsis,
      width: 260,
    },
    {
      title: '最近异常任务',
      render: (_value, record) => {
        const abnormal = latestAbnormalForConnection(record.id)
        return abnormal
          ? tableTooltipTextButton(operationKind(abnormal), () =>
              setSelectedConnectionOperation(abnormal),
            )
          : '-'
      },
      ellipsis: tableEllipsis,
      width: 180,
    },
    {
      title: '凭证',
      dataIndex: 'credentialConfigured',
      render: (value: boolean | undefined) =>
        value === false ? <Tag color="red">未配置</Tag> : <Tag color="green">已配置</Tag>,
      width: 120,
    },
    {
      ...tableColumnPresets.datetime,
      title: '最近同步',
      dataIndex: 'lastSyncedAt',
      render: formatDateTime,
      width: 180,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      width: 168,
      render: (_value, record) => (
        <Space className="soha-row-action-icons">
          {canManageClusters ? (
            <ManagementIconButton
              aria-label="测试连接"
              size="small"
              tooltip="测试"
              icon={<ThunderboltOutlined />}
              onClick={() => testMutation.mutate(record.id)}
            />
          ) : null}
          {canSync ? (
            <ManagementIconButton
              aria-label="同步连接"
              size="small"
              tooltip="同步"
              icon={<CloudSyncOutlined />}
              onClick={() => syncMutation.mutate(record.id)}
            />
          ) : null}
          {canManageClusters ? (
            <ManagementIconButton
              aria-label="编辑连接"
              size="small"
              tooltip="编辑"
              icon={<EditOutlined />}
              onClick={() => openEditor(record)}
            />
          ) : null}
          {canManageClusters ? (
            <ManagementIconButton
              aria-label="删除连接"
              size="small"
              tooltip="删除"
              danger
              icon={<DeleteOutlined />}
              loading={deletePreviewMutation.isPending || deleteMutation.isPending}
              onClick={() =>
                deletePreviewMutation.mutate(record.id, {
                  onSuccess: (dependencies) => setDeletePreview({ cluster: record, dependencies }),
                })
              }
            />
          ) : null}
        </Space>
      ),
    },
  ]
  const deletePendingTaskCount = deletePreview?.dependencies.pendingTaskCount ?? 0
  const deleteForceRequired = deletePreview?.dependencies.forceRequired === true
  const deleteBlocked = deletePendingTaskCount > 0

  return (
    <div className="soha-page soha-virtualization-page">
      <div className="soha-vrt-query">
        <ManagementQueryPanel
          collapsible
          actions={<Button onClick={resetClusterFilters}>重置</Button>}
        >
          <ManagementQueryField label="异常过滤" minWidth={180} width={180}>
            <Switch
              checked={showOnlyAbnormal}
              onChange={setShowOnlyAbnormal}
              checkedChildren="仅异常"
              unCheckedChildren="全部"
            />
          </ManagementQueryField>
          <ManagementQueryField label="启用状态" minWidth={180} width={180}>
            <Select
              value={enabledFilter}
              onChange={setEnabledFilter}
              options={ENABLED_FILTER_OPTIONS}
            />
          </ManagementQueryField>
          <ManagementQueryField label="Provider" minWidth={160} width={160}>
            <Select
              value={providerFilter}
              onChange={setProviderFilter}
              options={VIRTUALIZATION_PROVIDER_FILTER_OPTIONS}
            />
          </ManagementQueryField>
          <ManagementQueryField label="同步状态" minWidth={180} width={180}>
            <Switch
              checked={showNeverSynced}
              onChange={setShowNeverSynced}
              checkedChildren="未同步"
              unCheckedChildren="全部"
            />
          </ManagementQueryField>
        </ManagementQueryPanel>
      </div>
      <VirtualizationAdminTable
        rowKey="id"
        headerExtra={
          canManageClusters ? (
            <ManagementTableToolbar>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
                新增连接
              </Button>
            </ManagementTableToolbar>
          ) : null
        }
        toolbarExtra={
          selectedClusterRowKeys.length > 0 ? (
            <div className="soha-vrt-selection-bar">
              <Text type="secondary">已选择 {selectedClusterRowKeys.length} 个连接</Text>
              <Space wrap>
                {canManageClusters ? (
                  <Popconfirm
                    title="确认批量测试连接？"
                    description={bulkActionSummary(
                      '将测试',
                      clusterRows
                        .filter((record) => selectedClusterRowKeys.includes(record.id))
                        .map((record) => record.name),
                    )}
                    onConfirm={() => batchTestMutation.mutate(selectedClusterRowKeys.map(String))}
                  >
                    <Button loading={batchTestMutation.isPending}>批量测试</Button>
                  </Popconfirm>
                ) : null}
                {canSync ? (
                  <Popconfirm
                    title="确认批量同步连接？"
                    description={bulkActionSummary(
                      '将同步',
                      clusterRows
                        .filter((record) => selectedClusterRowKeys.includes(record.id))
                        .map((record) => record.name),
                    )}
                    onConfirm={() => batchSyncMutation.mutate(selectedClusterRowKeys.map(String))}
                  >
                    <Button type="primary" loading={batchSyncMutation.isPending}>
                      批量同步
                    </Button>
                  </Popconfirm>
                ) : null}
                <Button onClick={() => setSelectedClusterRowKeys([])}>清空选择</Button>
              </Space>
            </div>
          ) : null
        }
        rowSelection={{
          selectedRowKeys: selectedClusterRowKeys,
          onChange: (keys: Key[]) => setSelectedClusterRowKeys(keys),
        }}
        tableSize="small"
        loading={clustersQuery.isLoading || clusterOperationsQuery.isLoading}
        dataSource={clusterRows}
        columns={columns}
        scroll={{ x: 1970 }}
        paginationSummary={localTableSummary(clusterRows.length, clustersQuery.data?.length ?? 0)}
        expandable={{
          expandedRowRender: (record: VirtualizationCluster) => {
            const failedSync = failedSyncForConnection(record.id)
            const latestAbnormal = latestAbnormalForConnection(record.id)
            return (
              <Descriptions size="small" column={{ xs: 1, md: 2 }} bordered>
                <Descriptions.Item label="Endpoint / Cluster">
                  {record.provider === 'kubevirt'
                    ? record.kubernetesClusterId || '-'
                    : record.endpoint || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="默认命名空间">
                  {record.defaultNamespace || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="校验 TLS">
                  {record.verifyTls === false ? '关闭' : '开启'}
                </Descriptions.Item>
                <Descriptions.Item label="最近同步">
                  {formatDateTime(record.lastSyncedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Region">{record.region || '-'}</Descriptions.Item>
                <Descriptions.Item label="风险说明">
                  {riskReasons(record).join(' / ') || '正常'}
                </Descriptions.Item>
                <Descriptions.Item label="Console Backend">
                  {record.provider === 'kubevirt'
                    ? String(record.config?.backendUrl || record.endpoint || '-')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Prometheus">
                  {record.provider === 'kubevirt'
                    ? String(record.config?.prometheusUrl || '-')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="PVE 默认网桥">
                  {record.provider === 'pve' ? String(record.config?.defaultBridge || '-') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="PVE Snippet Storage">
                  {record.provider === 'pve'
                    ? String(
                        record.config?.defaultSnippetStorage ||
                          record.config?.snippetStorage ||
                          '-',
                      )
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="最近失败同步">
                  {failedSync
                    ? `${operationKind(failedSync)} · ${latestNonEmptyOperationMessage(failedSync)}`
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="最近异常任务">
                  {latestAbnormal
                    ? `${operationKind(latestAbnormal)} · ${latestNonEmptyOperationMessage(latestAbnormal)}`
                    : '-'}
                </Descriptions.Item>
              </Descriptions>
            )
          },
        }}
      />
      <Modal
        title={deletePreview ? `删除连接：${deletePreview.cluster.name}` : '删除连接'}
        open={Boolean(deletePreview)}
        okText={deleteForceRequired ? '确认强制删除' : '确认删除'}
        cancelText="取消"
        okButtonProps={{ danger: true, disabled: deleteBlocked, loading: deleteMutation.isPending }}
        onOk={() => {
          if (!deletePreview || deleteBlocked) return
          deleteMutation.mutate({ id: deletePreview.cluster.id, force: deleteForceRequired })
        }}
        onCancel={() => setDeletePreview(null)}
        destroyOnHidden
      >
        {deletePreview ? (
          <ConnectionDeletePreview dependencies={deletePreview.dependencies} />
        ) : null}
      </Modal>
      <VirtualizationConnectionStepModal
        editing={editing}
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
      />
      <Drawer
        title="连接关联异常任务"
        size="large"
        motion={stableDrawerMotion}
        open={Boolean(selectedConnectionOperation)}
        onClose={() => setSelectedConnectionOperation(null)}
      >
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="任务 ID">{selectedConnectionOperation?.id}</Descriptions.Item>
          <Descriptions.Item label="类型">
            {selectedConnectionOperation ? operationKind(selectedConnectionOperation) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {statusTag(selectedConnectionOperation?.status)}
          </Descriptions.Item>
          <Descriptions.Item label="连接">
            {selectedConnectionOperation?.connectionId || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="摘要">
            {selectedConnectionOperation?.message || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {formatDateTime(
              operationTime(selectedConnectionOperation || ({} as VirtualizationOperation)),
            )}
          </Descriptions.Item>
        </Descriptions>
        {selectedConnectionOperation?.message ? (
          <Alert
            className="mt-4"
            type={isAbnormalOperation(selectedConnectionOperation.status) ? 'error' : 'info'}
            title={selectedConnectionOperation.message}
          />
        ) : null}
        <div className="mt-4">
          <Button
            onClick={() =>
              navigate(
                `/compute/tasks/operations?domain=virtualization&connectionId=${encodeURIComponent(selectedConnectionOperation?.connectionId || '')}&abnormal=true`,
              )
            }
          >
            查看该连接全部异常任务
          </Button>
        </div>
      </Drawer>
    </div>
  )
}
