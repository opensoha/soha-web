import { useMemo, useState } from 'react'
import { Card, Descriptions, Drawer, Input, Select, Space, Tabs, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router-dom'
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
import { resolveSystemEndpointScope } from '../api'
import { systemQueries } from '../queries'
import {
  buildAuditResourceLabel,
  isTodayDate,
  prettifyAction,
  type AuditLog,
} from '../system-model'
import {
  UsageSnapshotDiffView,
  UsageSnapshotPanel,
  UsageSnapshotRawJson,
  UsageSnapshotSummary,
  usageSnapshotFilterParams,
} from '../usage-snapshot'
import '../shared/log-styles.css'

const { Paragraph, Text, Title } = Typography

function AuditLogDrawer({
  record,
  open,
  onClose,
}: {
  record: AuditLog | null
  open: boolean
  onClose: () => void
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={record ? `审计记录 · ${prettifyAction(record.action)}` : '审计记录'}
      size={620}
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
                        key: 'action',
                        label: '动作',
                        children: <StatusTag value={record.action} />,
                      },
                      {
                        key: 'resource',
                        label: '资源',
                        children:
                          [record.resourceKind, record.resourceName].filter(Boolean).join(' / ') ||
                          '-',
                      },
                      {
                        key: 'result',
                        label: '结果',
                        children: <StatusTag value={record.result} />,
                      },
                      { key: 'summary', label: '摘要', children: record.summary || '-' },
                    ]}
                  />
                  <Card variant="outlined" className="soha-system-payload-card">
                    <Title level={5} style={{ marginTop: 0 }}>
                      访问上下文
                    </Title>
                    <Descriptions
                      size="small"
                      column={1}
                      items={[
                        {
                          key: 'roles',
                          label: '角色',
                          children: record.roles?.length ? record.roles.join(', ') : '-',
                        },
                        {
                          key: 'teams',
                          label: '团队',
                          children: record.teams?.length ? record.teams.join(', ') : '-',
                        },
                        { key: 'requestPath', label: '路径', children: record.requestPath || '-' },
                        {
                          key: 'requestMethod',
                          label: '方法',
                          children: record.requestMethod || '-',
                        },
                        { key: 'requestId', label: '请求 ID', children: record.requestId || '-' },
                        { key: 'sourceIp', label: '来源 IP', children: record.sourceIp || '-' },
                      ]}
                    />
                  </Card>
                </Space>
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

export function AuditLogsPage() {
  const location = useLocation()
  const endpointScope = resolveSystemEndpointScope(location.pathname)
  const [searchParams] = useSearchParams()
  const initialUsageFilters = useMemo(() => usageSnapshotFilterParams(searchParams), [searchParams])
  const [actionFilter, setActionFilter] = useState<string>('')
  const [resultFilter, setResultFilter] = useState<string>('')
  const [metadataKeyFilter, setMetadataKeyFilter] = useState<string>(
    initialUsageFilters.metadataKey,
  )
  const [metadataValueFilter, setMetadataValueFilter] = useState<string>(
    initialUsageFilters.metadataValue,
  )
  const [viewMode, setViewMode] = useState<'all' | 'abnormal' | 'today'>('all')
  const [activeRecord, setActiveRecord] = useState<AuditLog | null>(null)
  const { data: rawLogs = [], isLoading } = useQuery(
    systemQueries.audit(endpointScope, {
      action: actionFilter,
      result: resultFilter,
      metadataKey: metadataKeyFilter,
      metadataValue: metadataValueFilter,
    }),
  )
  const filteredLogs = useMemo(() => {
    if (viewMode === 'abnormal') {
      return rawLogs.filter((item) => !['success', 'published'].includes(item.result))
    }
    if (viewMode === 'today') {
      return rawLogs.filter((item) => isTodayDate(item.createdAt))
    }
    return rawLogs
  }, [rawLogs, viewMode])

  const columns: TableColumnsType<AuditLog> = [
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
      render: (_: string, record: AuditLog) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.actorName || record.actorId || '-'}</Text>
          {record.actorId && record.actorId !== record.actorName ? (
            <Text type="secondary">{record.actorId}</Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: '事件',
      dataIndex: 'action',
      width: 240,
      render: (_: string, record: AuditLog) => {
        const resource = buildAuditResourceLabel(record.resourceKind, record.resourceName)
        return (
          <div className="soha-log-event-cell">
            <Space size={8} wrap>
              <StatusTag value={record.action} />
              {resource.secondary ? <Text type="secondary">{resource.secondary}</Text> : null}
            </Space>
            <Text strong>{resource.primary}</Text>
          </div>
        )
      },
    },
    {
      ...tableColumnPresets.status,
      title: '结果',
      dataIndex: 'result',
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      render: (value: string) => (
        <Space orientation="vertical" size={4}>
          <Paragraph className="soha-log-summary" ellipsis={{ rows: 2, tooltip: value }}>
            {value || '-'}
          </Paragraph>
        </Space>
      ),
    },
    {
      title: 'Usage Snapshot',
      dataIndex: 'metadata',
      width: 260,
      render: (value: AuditLog['metadata']) => <UsageSnapshotSummary metadata={value} />,
    },
    {
      ...tableColumnPresets.action,
      title: '详情',
      dataIndex: 'id',
      render: (_: string, record: AuditLog) => (
        <ManagementIconButton
          aria-label="查看审计详情"
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
              viewMode === 'all' &&
              !actionFilter &&
              !resultFilter &&
              !metadataKeyFilter &&
              !metadataValueFilter.trim()
            }
            onReset={() => {
              setViewMode('all')
              setActionFilter('')
              setResultFilter('')
              setMetadataKeyFilter('')
              setMetadataValueFilter('')
            }}
          />
        ),
        children: (
          <>
            <ManagementQueryScope
              label="快捷范围"
              value={viewMode}
              onChange={(value) => setViewMode(value as 'all' | 'abnormal' | 'today')}
              options={[
                { value: 'all', label: '全部' },
                { value: 'abnormal', label: '异常 / 拒绝' },
                { value: 'today', label: '今日' },
              ]}
            />
            <ManagementQueryField minWidth={140} width={160} label="动作">
              <Select
                allowClear
                placeholder="全部动作"
                value={actionFilter || undefined}
                onChange={(value) => setActionFilter(value || '')}
                options={[
                  { value: 'list', label: 'list' },
                  { value: 'view', label: 'view' },
                  { value: 'create', label: 'create' },
                  { value: 'update', label: 'update' },
                  { value: 'delete', label: 'delete' },
                  { value: 'login', label: 'login' },
                  { value: 'publish', label: 'publish' },
                  { value: 'withdraw', label: 'withdraw' },
                ]}
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
                  { value: 'deny', label: 'deny' },
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
        onRow: (record: AuditLog) => ({
          onClick: () => setActiveRecord(record),
          style: { cursor: 'pointer' },
        }),
      }}
      afterTable={
        <AuditLogDrawer
          record={activeRecord}
          open={Boolean(activeRecord)}
          onClose={() => setActiveRecord(null)}
        />
      }
    />
  )
}
