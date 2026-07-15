import { useEffect, useMemo, useState } from 'react'
import { Form, Input, Segmented, Select, Space, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
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
import { computeQueries } from '../queries'
import '../compute.css'

const { Text } = Typography

const TASK_CATEGORY_LABELS: Record<ComputeTaskCategory, string> = {
  sync: '同步',
  build: '构建',
  lifecycle: '生命周期',
  operation: '操作',
}

function legacyFilters(pathname: string): Partial<ComputeTaskFilters> {
  if (pathname === '/virtualization/sync') return { domain: 'virtualization', category: 'sync' }
  if (pathname === '/virtualization/operations') {
    return { domain: 'virtualization', category: 'operation' }
  }
  if (pathname === '/docker/operations') {
    return { domain: 'container_runtime', category: 'operation' }
  }
  return {}
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
  const legacy = legacyFilters(pathname)
  const legacyStatus =
    search.get('abnormal') === 'true'
      ? 'failed'
      : search.get('pending') === 'true'
        ? 'running'
        : undefined
  const legacyCategory = search.get('assetType') === 'asset_sync' ? 'sync' : undefined
  return {
    domain: (search.get('domain') as ComputeTaskDomain | null) ?? legacy.domain,
    providerKey: search.get('providerKey') || undefined,
    status: (search.get('status') as ComputeTaskStatus | null) ?? legacyStatus,
    category:
      (search.get('category') as ComputeTaskCategory | null) ??
      legacyCategory ??
      legacy.category ??
      computeTaskCategoryFromPath(pathname),
    limit: 100,
  }
}

function searchFromFilters(filters: ComputeTaskFilters) {
  const params = new URLSearchParams()
  ;(['domain', 'providerKey', 'status'] as const).forEach((key) => {
    if (filters[key]) params.set(key, String(filters[key]))
  })
  return params
}

export function ComputeTasksPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilters = useMemo(
    () => computeTaskFiltersFromLocation(location.pathname, searchParams),
    [location.pathname, searchParams],
  )
  const [filters, setFilters] = useState<ComputeTaskFilters>(initialFilters)
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const [form] = Form.useForm<ComputeTaskFilters>()
  const tasksQuery = useQuery(computeQueries.tasks(filters))
  const items = tasksQuery.data?.items ?? []

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
    setSearchParams(searchFromFilters(normalized), { replace: true })
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
  ]

  return (
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
                  })
                  updateFilters({ category: filters.category, limit: 100 })
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
          scroll={{ x: 1780 }}
        />
      }
    />
  )
}
