import { useEffect, useMemo, useState } from 'react'
import { Button, Form, Input, Space, Tabs, Tag, Typography } from 'antd'
import type { TabsProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { LeftOutlined, PlusOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import type {
  ComputeAccessSource,
  ComputeAccessSourceType,
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
    limit: 100,
  }
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
    const normalized = { ...next, cursor: undefined, limit: 100 }
    setCursorHistory([])
    setFilters(normalized)
    setSearchParams(searchFromFilters(normalized), { replace: true })
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
      render: (value) => <Tag>{value || '-'}</Tag>,
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
              <Tag key={action}>{action}</Tag>
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
              className="soha-compute-view-tabs"
              items={ACCESS_VIEW_ITEMS}
              onChange={(sourceType) =>
                updateFilters({ ...filters, sourceType: sourceType as ComputeAccessSourceType })
              }
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
                    updateFilters({ sourceType: filters.sourceType, limit: 100 })
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
                  disabled={!accessQuery.data?.nextCursor}
                  icon={<RightOutlined />}
                  tooltip="下一页"
                  onClick={() => {
                    if (!accessQuery.data?.nextCursor) return
                    setCursorHistory((current) => [...current, filters.cursor ?? ''])
                    setFilters((current) => ({ ...current, cursor: accessQuery.data?.nextCursor }))
                  }}
                />
                <ManagementIconButton
                  aria-label="刷新资源接入列表"
                  icon={<ReloadOutlined />}
                  loading={accessQuery.isFetching}
                  tooltip="刷新"
                  onClick={() => void accessQuery.refetch()}
                />
              </ManagementTableToolbar>
            }
            pagination={false}
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
