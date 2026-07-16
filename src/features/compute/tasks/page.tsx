import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  FileTextOutlined,
  LeftOutlined,
  RedoOutlined,
  ReloadOutlined,
  RightOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router-dom'
import type {
  ComputeTaskCategory,
  ComputeTaskDomain,
  ComputeTaskStatus,
  ComputeTaskView,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { AdminTable } from '@/components/admin-table'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { useAIPageContext } from '@/features/copilot'
import { formatDateTime } from '@/utils/time'
import type { ComputeTaskFilters } from '../api'
import { computeMutations } from '../mutations'
import { computeQueries } from '../queries'
import '../compute.css'

const { Text } = Typography

const TASK_CATEGORY_LABELS: Record<ComputeTaskCategory, string> = {
  sync: '同步',
  build: '构建',
  lifecycle: '生命周期',
  operation: '操作',
}

export function computeTaskCategoryFromPath(pathname: string): ComputeTaskCategory | undefined {
  if (pathname.endsWith('/sync')) return 'sync'
  if (pathname.endsWith('/build')) return 'build'
  return undefined
}

export function computeTaskFiltersFromLocation(
  pathname: string,
  search: URLSearchParams,
): ComputeTaskFilters {
  return {
    domain: (search.get('domain') as ComputeTaskDomain | null) ?? undefined,
    providerKey: search.get('providerKey') || undefined,
    status: (search.get('status') as ComputeTaskStatus | null) ?? undefined,
    category:
      (search.get('category') as ComputeTaskCategory | null) ??
      computeTaskCategoryFromPath(pathname),
    resourceKind: search.get('resourceKind') || undefined,
    resourceId: search.get('resourceId') || undefined,
    limit: 100,
  }
}

export function searchFromTaskFilters(
  filters: ComputeTaskFilters,
  drawer?: { domain: ComputeTaskDomain; taskId: string },
) {
  const params = new URLSearchParams()
  ;(['category', 'resourceKind', 'resourceId', 'domain', 'providerKey', 'status'] as const).forEach(
    (key) => {
      if (filters[key]) params.set(key, String(filters[key]))
    },
  )
  if (drawer) {
    params.set('domain', drawer.domain)
    params.set('taskId', drawer.taskId)
    params.set('view', 'logs')
  }
  return params
}

export function ComputeTasksPage() {
  const { message } = App.useApp()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilters = useMemo(
    () => computeTaskFiltersFromLocation(location.pathname, searchParams),
    [location.pathname, searchParams],
  )
  const [filters, setFilters] = useState<ComputeTaskFilters>(initialFilters)
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const [form] = Form.useForm<ComputeTaskFilters>()
  const queryClient = useQueryClient()
  const tasksQuery = useQuery(computeQueries.tasks(filters))
  const items = tasksQuery.data?.items ?? []
  const selectedTaskId = searchParams.get('view') === 'logs' ? searchParams.get('taskId') || '' : ''
  const selectedDomain =
    (searchParams.get('domain') as ComputeTaskDomain | null) ?? 'virtualization'
  const taskQuery = useQuery(computeQueries.task(selectedDomain, selectedTaskId))
  const logsQuery = useQuery(computeQueries.taskLogs(selectedDomain, selectedTaskId))
  const cancelMutation = useMutation(computeMutations.cancelTask(queryClient))
  const retryMutation = useMutation(computeMutations.retryTask(queryClient))
  const selectedTask =
    items.find((item) => item.domain === selectedDomain && item.id === selectedTaskId) ??
    taskQuery.data

  useEffect(() => {
    setFilters(initialFilters)
    setCursorHistory([])
    form.setFieldsValue(initialFilters)
  }, [form, initialFilters])

  useAIPageContext({
    sourceWorkbench: 'compute',
    sourceTitle: '计算任务中心',
    entityKind: 'compute.tasks',
    entityName: '计算资源任务',
    visibleFilters: { ...filters },
    pinnedData: { taskCount: items.length },
  })

  const updateFilters = (next: ComputeTaskFilters) => {
    const normalized = { ...next, cursor: undefined, limit: 100 }
    setCursorHistory([])
    setFilters(normalized)
    setSearchParams(searchFromTaskFilters(normalized), { replace: true })
  }

  const openLogs = (task: ComputeTaskView) => {
    setSearchParams(searchFromTaskFilters(filters, { domain: task.domain, taskId: task.id }))
  }

  const closeLogs = () => setSearchParams(searchFromTaskFilters(filters), { replace: true })

  const mutateTask = (action: 'cancel' | 'retry', task: ComputeTaskView) => {
    const mutation = action === 'cancel' ? cancelMutation : retryMutation
    mutation.mutate(
      { domain: task.domain, taskId: task.id },
      {
        onSuccess: () =>
          void message.success(action === 'cancel' ? '任务已取消' : '任务已重新排队'),
      },
    )
  }

  const columns: ColumnsType<ComputeTaskView> = [
    {
      title: '任务',
      fixed: 'left',
      width: 250,
      render: (_value, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.kind}</Text>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    {
      title: '领域',
      dataIndex: 'domain',
      width: 145,
      render: (value) => (value === 'container_runtime' ? '容器运行时' : '虚拟化'),
    },
    {
      title: '类别',
      dataIndex: 'category',
      width: 110,
      render: (value: ComputeTaskCategory) => <Tag>{TASK_CATEGORY_LABELS[value]}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'normalizedStatus',
      width: 120,
      render: (value) => <StatusTag value={value} />,
    },
    {
      title: 'Provider',
      width: 170,
      render: (_value, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.providerKey || '-'}</Text>
          <Text type="secondary">{record.providerSource || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '关联资源',
      width: 240,
      render: (_value, record) =>
        record.resources.map((item) => item.displayName).join(' / ') || '-',
    },
    { title: '发起人', dataIndex: 'requestedBy', width: 130, render: (value) => value || '-' },
    { title: '尝试', dataIndex: 'attemptCount', width: 80 },
    { title: '创建时间', dataIndex: 'createdAt', width: 170, render: formatDateTime },
    { title: '结束时间', dataIndex: 'finishedAt', width: 170, render: formatDateTime },
    { title: '摘要', dataIndex: 'summary', width: 260, render: (value) => value || '-' },
    {
      title: '操作',
      fixed: 'right',
      width: 128,
      render: (_value, record) => (
        <Space size={4}>
          {record.availableActions.includes('logs') ? (
            <ManagementIconButton
              aria-label="查看任务日志"
              icon={<FileTextOutlined />}
              tooltip="查看日志"
              onClick={() => openLogs(record)}
            />
          ) : null}
          {record.availableActions.includes('cancel') ? (
            <Popconfirm title="确认取消任务？" onConfirm={() => mutateTask('cancel', record)}>
              <ManagementIconButton
                aria-label="取消任务"
                danger
                icon={<StopOutlined />}
                loading={cancelMutation.isPending && cancelMutation.variables?.taskId === record.id}
                tooltip="取消"
              />
            </Popconfirm>
          ) : null}
          {record.availableActions.includes('retry') ? (
            <Popconfirm title="确认重试任务？" onConfirm={() => mutateTask('retry', record)}>
              <ManagementIconButton
                aria-label="重试任务"
                icon={<RedoOutlined />}
                loading={retryMutation.isPending && retryMutation.variables?.taskId === record.id}
                tooltip="重试"
              />
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <>
      <ManagementDataPage
        className="soha-compute-page"
        beforeQuery={
          <>
            <Segmented
              aria-label="任务领域"
              options={[
                { label: '全部', value: 'all' },
                { label: '虚拟化', value: 'virtualization' },
                { label: '容器运行时', value: 'container_runtime' },
              ]}
              value={filters.domain ?? 'all'}
              onChange={(value) => {
                const domain = value === 'all' ? undefined : (value as ComputeTaskDomain)
                form.setFieldValue('domain', domain)
                updateFilters({ ...filters, domain })
              }}
            />
            <ManagementQueryPanel
              form={form}
              initialValues={filters}
              collapsible={false}
              onFinish={(values) => updateFilters({ ...filters, ...values })}
              actions={
                <ManagementQueryActions
                  onReset={() => {
                    form.resetFields()
                    form.setFieldsValue({
                      domain: undefined,
                      providerKey: undefined,
                      status: undefined,
                      category: undefined,
                    })
                    updateFilters({ limit: 100 })
                  }}
                  submitLabel="筛选"
                />
              }
            >
              <Form.Item name="domain" hidden>
                <Input />
              </Form.Item>
              <ManagementQueryField label="状态" name="status">
                <Select
                  allowClear
                  placeholder="全部状态"
                  options={[
                    'queued',
                    'running',
                    'succeeded',
                    'failed',
                    'canceled',
                    'timeout',
                    'unknown',
                  ].map((value) => ({ value, label: value }))}
                />
              </ManagementQueryField>
              <ManagementQueryField label="Provider" name="providerKey">
                <Input allowClear placeholder="Provider key" />
              </ManagementQueryField>
              <ManagementQueryField label="类别" name="category">
                <Select
                  allowClear
                  placeholder="全部类别"
                  options={Object.entries(TASK_CATEGORY_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </ManagementQueryField>
            </ManagementQueryPanel>
          </>
        }
        tableNode={
          <AdminTable
            rowKey={(record: ComputeTaskView) => `${record.domain}:${record.id}`}
            columns={columns}
            dataSource={items}
            loading={tasksQuery.isLoading}
            empty={tasksQuery.isError ? '任务列表加载失败' : '暂无匹配任务'}
            toolbarExtra={
              <ManagementTableToolbar>
                <ManagementIconButton
                  aria-label="上一页"
                  disabled={cursorHistory.length === 0}
                  icon={<LeftOutlined />}
                  tooltip="上一页"
                  onClick={() => {
                    const previous = cursorHistory[cursorHistory.length - 1]
                    setCursorHistory((current) => current.slice(0, -1))
                    setFilters((current) => ({ ...current, cursor: previous || undefined }))
                  }}
                />
                <ManagementIconButton
                  aria-label="下一页"
                  disabled={!tasksQuery.data?.nextCursor}
                  icon={<RightOutlined />}
                  tooltip="下一页"
                  onClick={() => {
                    if (!tasksQuery.data?.nextCursor) return
                    setCursorHistory((current) => [...current, filters.cursor ?? ''])
                    setFilters((current) => ({ ...current, cursor: tasksQuery.data?.nextCursor }))
                  }}
                />
                <ManagementIconButton
                  aria-label="刷新任务列表"
                  icon={<ReloadOutlined />}
                  loading={tasksQuery.isFetching}
                  tooltip="刷新"
                  onClick={() => void tasksQuery.refetch()}
                />
              </ManagementTableToolbar>
            }
            pagination={false}
            scroll={{ x: 1908 }}
          />
        }
      />
      <Drawer
        title="任务日志"
        size="large"
        open={Boolean(selectedTaskId)}
        destroyOnHidden
        onClose={closeLogs}
      >
        {selectedTask ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="任务">{selectedTask.kind}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag value={selectedTask.normalizedStatus} />
              </Descriptions.Item>
              <Descriptions.Item label="任务 ID" span={2}>
                <Text copyable>{selectedTask.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="领域">
                {selectedTask.domain === 'container_runtime' ? '容器运行时' : '虚拟化'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDateTime(selectedTask.createdAt)}
              </Descriptions.Item>
            </Descriptions>
            <List
              loading={logsQuery.isLoading}
              dataSource={logsQuery.data ?? []}
              locale={{
                emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日志" />,
              }}
              renderItem={(log) => (
                <List.Item>
                  <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                    <Space wrap>
                      <Tag>{log.logLevel}</Tag>
                      <Text type="secondary">{formatDateTime(log.createdAt)}</Text>
                    </Space>
                    <Text>{log.message}</Text>
                    {log.payload ? <Text code>{log.payload}</Text> : null}
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        ) : taskQuery.isLoading ? null : (
          <Empty description="任务不存在或不可访问" />
        )}
      </Drawer>
    </>
  )
}
