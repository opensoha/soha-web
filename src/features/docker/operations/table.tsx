import { useMemo, useState } from 'react'
import { App, Descriptions, Drawer, Form, Segmented, Space, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileTextOutlined, PoweroffOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
} from '@/components/management-list'
import { formatDateTime } from '@/utils/time'
import { dockerApi } from '../docker-api'
import { dockerQueries } from '../queries'
import type { DockerOperation, DockerOperationLog } from '../docker-types'
import {
  DockerAdminTable,
  isAbnormalOperation,
  isPendingOperation,
  normalizePage,
  operationTone,
  pageTablePagination,
  queryData,
  refreshDocker,
  statusTag,
  type DockerFilterState,
  useDockerPermissions,
} from '../shared/ui'

const { Text } = Typography
type OperationPreset = 'all' | 'pending' | 'abnormal' | 'host' | 'project' | 'service'

function OperationLogDrawer({
  operation,
  logs,
  loading,
  open,
  onClose,
}: {
  operation?: DockerOperation | null
  logs: DockerOperationLog[]
  loading?: boolean
  open: boolean
  onClose: () => void
}) {
  const text = logs.length
    ? logs
        .map(
          (item) =>
            `[${formatDateTime(item.createdAt)}] ${item.logLevel || 'info'} ${item.message}`,
        )
        .join('\n')
    : JSON.stringify(operation?.payload ?? {}, null, 2)
  return (
    <Drawer title="操作日志" size="large" open={open} onClose={onClose}>
      {operation ? (
        <Descriptions size="small" column={2} bordered className="mb-3">
          <Descriptions.Item label="任务 ID">{operation.id}</Descriptions.Item>
          <Descriptions.Item label="状态">{statusTag(operation.status)}</Descriptions.Item>
          <Descriptions.Item label="类型">{operation.operationKind}</Descriptions.Item>
          <Descriptions.Item label="发起人">{operation.requestedBy || '-'}</Descriptions.Item>
        </Descriptions>
      ) : null}
      <pre className="max-h-[560px] overflow-auto rounded border border-[var(--soha-border-color)] bg-[var(--soha-bg-surface-muted)] p-3 text-xs">
        {loading ? '日志加载中' : text || '暂无日志'}
      </pre>
    </Drawer>
  )
}

export function OperationsTable({
  embedded = false,
  initialPreset = 'all' as OperationPreset,
}: {
  embedded?: boolean
  initialPreset?: OperationPreset
}) {
  const [preset, setPreset] = useState<OperationPreset>(initialPreset)
  const [filters, setFilters] = useState<DockerFilterState>({
    page: 1,
    pageSize: embedded ? 6 : 10,
  })
  const [filterForm] = Form.useForm<DockerFilterState>()
  const [selectedOperation, setSelectedOperation] = useState<DockerOperation | null>(null)
  const { dockerModuleEnabled, canManageOperations } = useDockerPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const presetFilter = useMemo<DockerFilterState>(() => {
    if (preset === 'pending') return { pending: true }
    if (preset === 'abnormal') return { abnormal: true }
    if (preset === 'host') return { operationKind: 'host_provision' }
    if (preset === 'project') return { operationKind: 'project_deploy' }
    if (preset === 'service') return { operationKind: 'service_action' }
    return {}
  }, [preset])
  const queryFilters = { ...filters, ...presetFilter }
  const operationsQuery = useQuery(dockerQueries.operations(queryFilters, dockerModuleEnabled))
  const logsQuery = useQuery(
    dockerQueries.operationLogs(selectedOperation?.id ?? '', dockerModuleEnabled),
  )
  const cancelMutation = useMutation({
    mutationFn: dockerApi.cancelOperation,
    onSuccess: () => {
      message.success('任务已取消')
      refreshDocker(queryClient)
    },
  })
  const retryMutation = useMutation({
    mutationFn: dockerApi.retryOperation,
    onSuccess: () => {
      message.success('重试任务已提交')
      refreshDocker(queryClient)
    },
  })
  const page = normalizePage(operationsQuery.data, filters.page ?? 1, filters.pageSize ?? 10)
  const logs = queryData(logsQuery.data, [])
  const columns: ColumnsType<DockerOperation> = [
    {
      title: '任务',
      dataIndex: 'operationKind',
      fixed: 'left',
      width: 190,
      render: (value, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    { title: '状态', dataIndex: 'status', width: 115, render: statusTag },
    {
      title: '关联对象',
      width: 240,
      render: (_value, record) =>
        [record.hostId, record.projectId, record.serviceId].filter(Boolean).join(' / ') || '-',
    },
    { title: '发起人', dataIndex: 'requestedBy', width: 130, render: (value) => value || '-' },
    {
      title: '尝试',
      width: 90,
      render: (_value, record) => `${record.attemptCount ?? 0}/${record.maxRetries ?? 0}`,
    },
    {
      title: 'Worker',
      dataIndex: 'claimedByWorkerId',
      width: 150,
      render: (value) => value || '-',
    },
    { title: '开始', dataIndex: 'startedAt', width: 155, render: formatDateTime },
    { title: '结束', dataIndex: 'finishedAt', width: 155, render: formatDateTime },
    {
      title: '操作',
      align: 'center',
      fixed: 'right',
      width: 116,
      render: (_value, record) => (
        <Space className="soha-row-action-icons">
          <ManagementIconButton
            aria-label="查看日志"
            size="small"
            tooltip="日志"
            icon={<FileTextOutlined />}
            onClick={() => setSelectedOperation(record)}
          />
          {canManageOperations && isPendingOperation(record.status) ? (
            <ManagementIconButton
              aria-label="取消任务"
              size="small"
              tooltip="取消"
              danger
              icon={<PoweroffOutlined />}
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate(record.id)}
            />
          ) : null}
          {canManageOperations && isAbnormalOperation(record.status) ? (
            <ManagementIconButton
              aria-label="重试任务"
              size="small"
              tooltip="重试"
              icon={<ReloadOutlined />}
              loading={retryMutation.isPending}
              onClick={() => retryMutation.mutate(record.id)}
            />
          ) : null}
        </Space>
      ),
    },
  ]
  return (
    <>
      {!embedded ? (
        <div className="soha-vrt-query">
          <ManagementQueryPanel
            form={filterForm}
            actions={
              <ManagementQueryActions
                loading={operationsQuery.isFetching}
                onReset={() => {
                  filterForm.resetFields()
                  setPreset(initialPreset)
                  setFilters({ page: 1, pageSize: filters.pageSize ?? (embedded ? 6 : 10) })
                }}
              />
            }
            onFinish={(values) => setFilters((current) => ({ ...current, ...values, page: 1 }))}
          >
            <ManagementQueryField minWidth={360} width={460} label="任务视图">
              <Segmented<OperationPreset>
                value={preset}
                onChange={(value) => {
                  setPreset(value)
                  setFilters((current) => ({ ...current, page: 1 }))
                }}
                options={[
                  { value: 'all', label: '全部' },
                  { value: 'pending', label: '待处理' },
                  { value: 'abnormal', label: '异常' },
                  { value: 'host', label: '主机构建' },
                  { value: 'project', label: 'Compose' },
                  { value: 'service', label: '服务' },
                ]}
              />
            </ManagementQueryField>
            <ManagementKeywordField placeholder="任务 ID、类型或发起人" />
          </ManagementQueryPanel>
        </div>
      ) : null}
      <DockerAdminTable
        rowKey="id"
        enableColumnSelection={!embedded}
        loading={operationsQuery.isLoading}
        dataSource={page.items}
        columns={columns}
        rowClassName={(record: DockerOperation) => `soha-vrt-row-tone-${operationTone(record)}`}
        scroll={{ x: 1280 }}
        pagination={pageTablePagination(page, embedded, setFilters)}
        title={
          embedded ? (
            <Text strong>{initialPreset === 'pending' ? '待处理任务' : '操作记录'}</Text>
          ) : undefined
        }
        enableDensity={!embedded}
        refreshing={operationsQuery.isFetching}
        showColumnSettings={!embedded}
        showRefresh={!embedded}
        onRefresh={() => operationsQuery.refetch()}
      />
      <OperationLogDrawer
        operation={selectedOperation}
        logs={logs}
        loading={logsQuery.isLoading}
        open={Boolean(selectedOperation)}
        onClose={() => setSelectedOperation(null)}
      />
    </>
  )
}
