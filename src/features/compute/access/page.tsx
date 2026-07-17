import { useEffect, useMemo, useState } from 'react'
import { Button, Form, Input, Space, Tabs, Typography } from 'antd'
import type { TabsProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import type {
  ComputeAccessSource,
  ComputeAccessSourceType,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { AdminTable } from '@/components/admin-table'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementDensityButton,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
  ManagementRefreshButton,
  ManagementTableToolbar,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useAIPageContext } from '@/features/copilot'
import { RuntimeHostStepModal } from '@/features/docker'
import { VirtualizationConnectionStepModal } from '@/features/virtualization'
import { formatDateTime } from '@/utils/time'
import { computeQueries } from '../queries'
import type { ComputeAccessFilters } from '../api'
import { computeRelatedResourcePath } from './related-resource-path'
import '../compute.css'

const { Text } = Typography
const DEFAULT_ACCESS_PAGE_SIZE = 20
const ACCESS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const SOURCE_LABELS: Record<ComputeAccessSourceType, string> = {
  virtualization_connection: '虚拟化',
  agent_host: 'Agent 主机',
  runtime_host: '运行时主机',
}

const ACCESS_VIEW_ITEMS: TabsProps['items'] = Object.entries(SOURCE_LABELS).map(([key, label]) => ({
  key,
  label,
}))

const ACCESS_SOURCE_TYPES = new Set<ComputeAccessSourceType>(
  Object.keys(SOURCE_LABELS) as ComputeAccessSourceType[],
)

export function computeAccessFiltersFromSearch(search: URLSearchParams): ComputeAccessFilters {
  const sourceType = search.get('sourceType') as ComputeAccessSourceType | null
  return {
    sourceType:
      sourceType && ACCESS_SOURCE_TYPES.has(sourceType) ? sourceType : 'virtualization_connection',
    providerKey: search.get('providerKey') || undefined,
    limit: DEFAULT_ACCESS_PAGE_SIZE,
  }
}

export function computeAccessPaginationTotal(
  currentPage: number,
  pageSize: number,
  itemCount: number,
  hasNextPage: boolean,
) {
  return (currentPage - 1) * pageSize + itemCount + (hasNextPage ? 1 : 0)
}

export function computeAccessCursorForPage(
  nextPage: number,
  cursorHistory: string[],
  currentPage: number,
) {
  if (nextPage < 1 || nextPage >= currentPage) return undefined
  return cursorHistory[nextPage - 1] || undefined
}

function searchFromFilters(filters: ComputeAccessFilters) {
  const params = new URLSearchParams()
  if (filters.sourceType) params.set('sourceType', filters.sourceType)
  if (filters.providerKey) params.set('providerKey', filters.providerKey)
  return params
}

export function ComputeAccessPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilters = useMemo(() => computeAccessFiltersFromSearch(searchParams), [searchParams])
  const [filters, setFilters] = useState<ComputeAccessFilters>(initialFilters)
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const [connectionEditorOpen, setConnectionEditorOpen] = useState(false)
  const [runtimeEditorOpen, setRuntimeEditorOpen] = useState(false)
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const [form] = Form.useForm<ComputeAccessFilters>()
  const accessQuery = useQuery(computeQueries.accessSources(filters))
  const permissionSnapshot = usePermissionSnapshot().data?.data
  const canCreateVirtualization =
    hasPermission(permissionSnapshot, 'virtualization.clusters.manage') ||
    hasPermission(permissionSnapshot, 'virtualization.manage')
  const canCreateRuntime = hasPermission(permissionSnapshot, 'docker.hosts.manage')
  const canCreateAccess =
    filters.sourceType === 'virtualization_connection'
      ? canCreateVirtualization
      : filters.sourceType === 'runtime_host'
        ? canCreateRuntime
        : false
  const items = accessQuery.data?.items ?? []
  const pageSize = filters.limit ?? DEFAULT_ACCESS_PAGE_SIZE
  const currentPage = cursorHistory.length + 1
  const paginationTotal = computeAccessPaginationTotal(
    currentPage,
    pageSize,
    items.length,
    Boolean(accessQuery.data?.nextCursor),
  )

  useEffect(() => {
    setFilters(initialFilters)
    setCursorHistory([])
    form.setFieldsValue(initialFilters)
  }, [form, initialFilters])

  useAIPageContext({
    sourceWorkbench: 'compute',
    sourceTitle: '资源接入',
    entityKind: 'compute.access',
    entityName: '计算资源接入',
    visibleFilters: { ...filters },
    pinnedData: { sourceCount: items.length },
  })

  const updateFilters = (next: ComputeAccessFilters) => {
    const normalized = {
      ...next,
      cursor: undefined,
      limit: next.limit ?? filters.limit ?? DEFAULT_ACCESS_PAGE_SIZE,
    }
    setCursorHistory([])
    setFilters(normalized)
    setSearchParams(searchFromFilters(normalized), { replace: true })
  }

  const changePage = (nextPage: number) => {
    if (nextPage === currentPage) return
    if (nextPage < currentPage) {
      const cursor = computeAccessCursorForPage(nextPage, cursorHistory, currentPage)
      setCursorHistory((current) => current.slice(0, nextPage - 1))
      setFilters((current) => ({ ...current, cursor }))
      return
    }
    if (nextPage === currentPage + 1 && accessQuery.data?.nextCursor) {
      setCursorHistory((current) => [...current, filters.cursor ?? ''])
      setFilters((current) => ({ ...current, cursor: accessQuery.data.nextCursor }))
    }
  }

  const changePageSize = (nextPageSize: number) => {
    setCursorHistory([])
    setFilters((current) => ({
      ...current,
      cursor: undefined,
      limit: nextPageSize,
    }))
  }

  const columns: ColumnsType<ComputeAccessSource> = [
    {
      title: '接入资源',
      fixed: 'left',
      width: 240,
      render: (_value, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.resource.displayName}</Text>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'sourceType',
      width: 130,
      render: (value: ComputeAccessSourceType) => SOURCE_LABELS[value],
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 115,
      render: (value) => <StatusTag value={value} />,
    },
    {
      title: 'Provider',
      width: 180,
      render: (_value, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.providerKey || record.resource.providerKey || '-'}</Text>
          <Text type="secondary">
            {record.providerSource || record.resource.providerSource || '-'}
            {record.pluginId ? ` · ${record.pluginId}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '接入方式',
      dataIndex: 'accessMode',
      width: 130,
      render: (value) => <MetadataTag label={value || '-'} />,
    },
    {
      title: '关联资源',
      width: 220,
      render: (_value, record) =>
        record.relatedResources?.length ? (
          <Space separator="/" size={4} wrap>
            {record.relatedResources.map((resource, index) => {
              const target = computeRelatedResourcePath(resource)
              return target ? (
                <Link key={`${resource.kind}:${resource.id}:${index}`} to={target}>
                  {resource.displayName}
                </Link>
              ) : (
                <Text key={`${resource.kind}:${resource.id}:${index}`}>{resource.displayName}</Text>
              )
            })}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '可用动作',
      width: 200,
      render: (_value, record) =>
        record.availableActions?.length ? (
          <Space size={[4, 4]} wrap>
            {record.availableActions.map((action) => (
              <MetadataTag key={action} label={action} />
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    { title: '最近观测', dataIndex: 'lastObservedAt', width: 170, render: formatDateTime },
  ]

  return (
    <>
      <ManagementDataPage
        className="soha-compute-page"
        beforeQuery={
          <>
            <Tabs
              activeKey={filters.sourceType}
              className="soha-resource-tabs is-header-only"
              indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
              items={ACCESS_VIEW_ITEMS}
              onChange={(sourceType) =>
                updateFilters({ ...filters, sourceType: sourceType as ComputeAccessSourceType })
              }
              size="small"
              tabBarGutter={18}
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
                    form.setFieldValue('providerKey', undefined)
                    updateFilters({
                      sourceType: filters.sourceType,
                      limit: DEFAULT_ACCESS_PAGE_SIZE,
                    })
                  }}
                  submitLabel="筛选"
                />
              }
            >
              <ManagementQueryField label="Provider" name="providerKey">
                <Input allowClear placeholder="例如 pve、docker" />
              </ManagementQueryField>
            </ManagementQueryPanel>
          </>
        }
        tableNode={
          <AdminTable
            rowKey="id"
            columns={columns}
            dataSource={items}
            loading={accessQuery.isLoading}
            empty={accessQuery.isError ? '资源接入列表加载失败' : '暂无已授权接入资源'}
            columnSettingIconOnly
            tableSize={tableSize}
            toolbarExtra={
              <ManagementTableToolbar>
                {canCreateAccess ? (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      if (filters.sourceType === 'virtualization_connection') {
                        setConnectionEditorOpen(true)
                      } else if (filters.sourceType === 'runtime_host') {
                        setRuntimeEditorOpen(true)
                      }
                    }}
                  >
                    新增接入
                  </Button>
                ) : null}
                <ManagementDensityButton
                  aria-label="切换表格密度"
                  tooltip={tableSize === 'small' ? '切换为宽松密度' : '切换为紧凑密度'}
                  onClick={() =>
                    setTableSize((current) => (current === 'small' ? 'middle' : 'small'))
                  }
                />
                <ManagementRefreshButton
                  aria-label="刷新资源接入列表"
                  loading={accessQuery.isFetching}
                  tooltip="刷新"
                  onClick={() => void accessQuery.refetch()}
                />
              </ManagementTableToolbar>
            }
            pageSize={pageSize}
            pagination={{
              current: currentPage,
              currentPage,
              pageSize,
              pageSizeOptions: ACCESS_PAGE_SIZE_OPTIONS,
              total: paginationTotal,
              onPageChange: changePage,
              onPageSizeChange: changePageSize,
            }}
            paginationSummary={
              <Text type="secondary">
                当前第 {currentPage} 页，本页 {items.length} 条
                {accessQuery.data?.nextCursor ? '，还有更多' : ''}
              </Text>
            }
            scroll={{ x: 1320 }}
          />
        }
      />
      <VirtualizationConnectionStepModal
        open={connectionEditorOpen}
        onClose={() => setConnectionEditorOpen(false)}
      />
      <RuntimeHostStepModal
        initialMode="existing"
        open={runtimeEditorOpen}
        onClose={() => setRuntimeEditorOpen(false)}
      />
    </>
  )
}
