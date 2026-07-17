import { useMemo, useState } from 'react'
import { Card, Descriptions, Drawer, Input, Select, Space, Tabs, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryScope,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { systemQueries } from '../queries'
import {
  buildTargetScopeLabel,
  compactText,
  prettifyOperationType,
  stringifyPayload,
  type OperationLog,
} from '../system-model'
import {
  UsageSnapshotDiffView,
  UsageSnapshotPanel,
  UsageSnapshotRawJson,
  UsageSnapshotSummary,
  usageSnapshotFilterParams,
} from '../usage-snapshot'
import '../shared/log-styles.css'

const { Paragraph, Text } = Typography

function OperationLogDrawer({
  record,
  open,
  onClose,
}: {
  record: OperationLog | null
  open: boolean
  onClose: () => void
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={record ? prettifyOperationType(record.operationType).primary : '操作详情'}
      size={640}
      destroyOnHidden
    >
      {record ? (
        <Tabs
          items={[
            {
              key: 'overview',
              label: '概览',
              children: (
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <UsageSnapshotPanel metadata={record.metadata} />
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {
                        key: 'time',
                        label: '发生时间',
                        children: formatDateTime(record.createdAt),
                      },
                      {
                        key: 'actor',
                        label: '操作者',
                        children: record.actorName || record.actorId || '-',
                      },
                      {
                        key: 'operation',
                        label: '操作',
                        children: (
                          <Space orientation="vertical" size={0}>
                            <Text strong>
                              {prettifyOperationType(record.operationType).primary}
                            </Text>
                            <Text type="secondary">{record.operationType}</Text>
                          </Space>
                        ),
                      },
                      {
                        key: 'target',
                        label: '目标',
                        children: (
                          <Space orientation="vertical" size={0}>
                            <Text strong>
                              {buildTargetScopeLabel(record.targetScope || {}).primary}
                            </Text>
                            <Text type="secondary">
                              {buildTargetScopeLabel(record.targetScope || {}).secondary || '-'}
                            </Text>
                          </Space>
                        ),
                      },
                      {
                        key: 'result',
                        label: '结果',
                        children: <StatusTag value={record.result} />,
                      },
                      { key: 'summary', label: '摘要', children: record.summary || '-' },
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: 'scope',
              label: '目标范围',
              children: (
                <pre className="soha-system-json-block">{stringifyPayload(record.targetScope)}</pre>
              ),
            },
            {
              key: 'request',
              label: '请求上下文',
              children: (
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    { key: 'path', label: '路径', children: record.requestPath || '-' },
                    { key: 'method', label: '方法', children: record.requestMethod || '-' },
                    { key: 'requestId', label: '请求 ID', children: record.requestId || '-' },
                    { key: 'sourceIp', label: '来源 IP', children: record.sourceIp || '-' },
                  ]}
                />
              ),
            },
            {
              key: 'diff',
              label: '结构化 diff',
              children: (
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <UsageSnapshotDiffView metadata={record.metadata} />
                  <Card variant="outlined" className="soha-system-payload-card">
                    <Typography.Title level={5} style={{ marginTop: 0 }}>
                      原始 JSON
                    </Typography.Title>
                    <UsageSnapshotRawJson metadata={record.metadata} />
                  </Card>
                </Space>
              ),
            },
          ]}
        />
      ) : null}
    </Drawer>
  )
}

export function OperationLogsPage() {
  const [searchParams] = useSearchParams()
  const initialUsageFilters = useMemo(() => usageSnapshotFilterParams(searchParams), [searchParams])
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>('')
  const [resultFilter, setResultFilter] = useState<string>('')
  const [metadataKeyFilter, setMetadataKeyFilter] = useState<string>(
    initialUsageFilters.metadataKey,
  )
  const [metadataValueFilter, setMetadataValueFilter] = useState<string>(
    initialUsageFilters.metadataValue,
  )
  const [moduleView, setModuleView] = useState<
    'all' | 'system' | 'access' | 'platform' | 'virtualization' | 'delivery'
  >('all')
  const [activeRecord, setActiveRecord] = useState<OperationLog | null>(null)
  const { data: rawLogs = [], isLoading } = useQuery(
    systemQueries.operationLogs({
      operationType: operationTypeFilter,
      result: resultFilter,
      metadataKey: metadataKeyFilter,
      metadataValue: metadataValueFilter,
    }),
  )
  const filteredLogs = useMemo(() => {
    if (moduleView === 'all') return rawLogs
    return rawLogs.filter(
      (item) => compactText(String(item.targetScope?.module || '')) === moduleView,
    )
  }, [moduleView, rawLogs])

  const columns: TableColumnsType<OperationLog> = [
    {
      ...tableColumnPresets.datetime,
      title: '时间',
      dataIndex: 'createdAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '操作者',
      dataIndex: 'actorName',
      width: 160,
      render: (_: string, record: OperationLog) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.actorName || record.actorId || '-'}</Text>
          {record.actorId && record.actorId !== record.actorName ? (
            <Text type="secondary">{record.actorId}</Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'operationType',
      width: 260,
      render: (value: string) => {
        const pretty = prettifyOperationType(value)
        return (
          <div className="soha-log-event-cell">
            <Text strong>{pretty.primary}</Text>
            <Text type="secondary">{pretty.secondary}</Text>
          </div>
        )
      },
    },
    {
      title: '目标',
      dataIndex: 'targetScope',
      width: 260,
      render: (value: Record<string, unknown>) => {
        const target = buildTargetScopeLabel(value || {})
        return (
          <div className="soha-log-event-cell">
            <Text strong>{target.primary}</Text>
            <Text type="secondary">{target.secondary || '-'}</Text>
          </div>
        )
      },
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'result',
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      render: (value: string) => (
        <Paragraph className="soha-log-summary" ellipsis={{ rows: 2, tooltip: value }}>
          {value || '-'}
        </Paragraph>
      ),
    },
    {
      title: 'Usage Snapshot',
      dataIndex: 'metadata',
      width: 260,
      render: (value: OperationLog['metadata']) => <UsageSnapshotSummary metadata={value} />,
    },
    {
      ...tableColumnPresets.action,
      title: '详情',
      dataIndex: 'id',
      render: (_: string, record: OperationLog) => (
        <ManagementIconButton
          aria-label="查看操作详情"
          icon={<EyeOutlined />}
          size="small"
          tooltip="详情"
          onClick={() => setActiveRecord(record)}
        />
      ),
    },
  ]

  return (
    <ManagementDataPage
      query={{
        collapsible: true,
        onFinish: () => undefined,
        actions: (
          <ManagementQueryActions
            disabledReset={
              moduleView === 'all' &&
              !operationTypeFilter.trim() &&
              !resultFilter &&
              !metadataKeyFilter &&
              !metadataValueFilter.trim()
            }
            onReset={() => {
              setModuleView('all')
              setOperationTypeFilter('')
              setResultFilter('')
              setMetadataKeyFilter('')
              setMetadataValueFilter('')
            }}
          />
        ),
        children: (
          <>
            <ManagementQueryScope
              label="业务域"
              value={moduleView}
              onChange={(value) =>
                setModuleView(
                  value as
                    | 'all'
                    | 'system'
                    | 'access'
                    | 'platform'
                    | 'virtualization'
                    | 'delivery',
                )
              }
              options={[
                { value: 'all', label: '全部' },
                { value: 'system', label: '系统' },
                { value: 'access', label: '访问控制' },
                { value: 'platform', label: '平台' },
                { value: 'virtualization', label: '虚拟化' },
                { value: 'delivery', label: '交付' },
              ]}
            />
            <ManagementQueryField minWidth={180} width={220} label="操作类型">
              <Input
                allowClear
                placeholder="按操作类型过滤"
                value={operationTypeFilter}
                onChange={(event) => setOperationTypeFilter(event.target.value)}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={140} width={160} label="结果">
              <Select
                allowClear
                placeholder="全部结果"
                value={resultFilter || undefined}
                onChange={(value) => setResultFilter(value || '')}
                options={[
                  { value: 'success', label: 'success' },
                  { value: 'failure', label: 'failure' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={180} width={220} label="字段">
              <Select
                allowClear
                placeholder="usageSnapshot 字段"
                value={metadataKeyFilter || undefined}
                onChange={(value) => setMetadataKeyFilter(value || '')}
                options={[
                  { value: 'usageSnapshot.templateKind', label: 'templateKind' },
                  { value: 'usageSnapshot.templateId', label: 'templateId' },
                  { value: 'usageSnapshot.riskLevel', label: 'riskLevel' },
                  { value: 'usageSnapshot.before.templateId', label: 'before.templateId' },
                  { value: 'usageSnapshot.after.templateId', label: 'after.templateId' },
                  { value: 'usageSnapshot.after.riskLevel', label: 'after.riskLevel' },
                ]}
              />
            </ManagementQueryField>
            <ManagementQueryField grow minWidth={180} width={220} label="字段值">
              <Input
                allowClear
                placeholder="usageSnapshot 值"
                value={metadataValueFilter}
                onChange={(event) => setMetadataValueFilter(event.target.value)}
              />
            </ManagementQueryField>
          </>
        ),
      }}
      table={{
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        columns,
        dataSource: filteredLogs,
        rowKey: 'id',
        loading: isLoading,
        pageSize: 50,
        scroll: { x: 'max-content' },
        onRow: (record: OperationLog) => ({
          onClick: () => setActiveRecord(record),
          style: { cursor: 'pointer' },
        }),
      }}
      afterTable={
        <OperationLogDrawer
          record={activeRecord}
          open={Boolean(activeRecord)}
          onClose={() => setActiveRecord(null)}
        />
      }
    />
  )
}
