import type { ReactNode } from 'react'
import { Card, Space, Table, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { buildRelatedResourcePath } from '@/features/platform/workloads-model'
import type { WorkloadCondition } from '@/types'
import { formatDateTime } from '@/utils/time'
import type { TableColumnsType } from 'antd'
import type { AdmissionWebhook, AdmissionWebhookRule } from './types'

const { Text } = Typography

export function ConfigurationConditions({ conditions }: { conditions?: WorkloadCondition[] }) {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<WorkloadCondition> = [
    { title: localeCode === 'zh_CN' ? '条件' : 'Condition', dataIndex: 'type', width: 160 },
    {
      title: localeCode === 'zh_CN' ? '状态' : 'Status',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: localeCode === 'zh_CN' ? '原因' : 'Reason',
      dataIndex: 'reason',
      width: 180,
      render: (value?: string) => value || '-',
    },
    {
      title: localeCode === 'zh_CN' ? '消息' : 'Message',
      dataIndex: 'message',
      ellipsis: { showTitle: false },
      render: (value?: string) => <Text title={value}>{value || '-'}</Text>,
    },
    {
      title: localeCode === 'zh_CN' ? '最近变化' : 'Last Transition',
      dataIndex: 'lastTransitionTime',
      width: 180,
      render: (value?: string) => (value ? formatDateTime(value) : '-'),
    },
  ]
  return (
    <Card className="soha-detail-card" title={localeCode === 'zh_CN' ? '条件' : 'Conditions'}>
      <Table
        className="soha-platform-table"
        columns={columns}
        dataSource={conditions ?? []}
        pagination={false}
        rowKey="type"
        size="small"
        tableLayout="fixed"
      />
    </Card>
  )
}

function list(value?: string[]) {
  return value?.join(', ') || '-'
}

export function AdmissionWebhooks({ webhooks }: { webhooks: AdmissionWebhook[] }) {
  const { localeCode } = useI18n()
  const webhookColumns: TableColumnsType<AdmissionWebhook> = [
    { title: 'Name', dataIndex: 'name', ellipsis: { showTitle: false } },
    {
      title: localeCode === 'zh_CN' ? '客户端目标' : 'Client target',
      dataIndex: 'clientTarget',
      render: (value: string, webhook) => {
        if (!webhook.serviceName) return value || '-'
        const path = buildRelatedResourcePath(
          {
            kind: 'Service',
            name: webhook.serviceName,
            namespace: webhook.serviceNamespace,
          },
          webhook.serviceNamespace ?? null,
        )
        return path ? <Link to={path}>{value}</Link> : value
      },
    },
    {
      title: 'CA',
      dataIndex: 'caBundleConfigured',
      width: 90,
      render: (value: boolean) => <BooleanTag value={value} />,
    },
    { title: 'Failure policy', dataIndex: 'failurePolicy', width: 130 },
    { title: 'Match policy', dataIndex: 'matchPolicy', width: 120 },
    { title: 'Side effects', dataIndex: 'sideEffects', width: 120 },
    { title: 'Timeout', dataIndex: 'timeoutSeconds', width: 90 },
    {
      title: 'Review versions',
      dataIndex: 'admissionReviewVersions',
      render: list,
    },
  ]
  const ruleColumns: TableColumnsType<AdmissionWebhookRule & { webhook: string; key: string }> = [
    { title: 'Webhook', dataIndex: 'webhook', width: 220 },
    { title: 'Operations', dataIndex: 'operations', render: list },
    { title: 'API groups', dataIndex: 'apiGroups', render: list },
    { title: 'API versions', dataIndex: 'apiVersions', render: list },
    { title: 'Resources', dataIndex: 'resources', render: list },
    { title: 'Scope', dataIndex: 'scope', width: 100, render: (value?: string) => value || '-' },
  ]
  const rules = webhooks.flatMap((webhook) =>
    (webhook.rules ?? []).map((rule, index) => ({
      ...rule,
      webhook: webhook.name,
      key: `${webhook.name}/${index}`,
    })),
  )
  const selectors = webhooks.filter(
    (webhook) => webhook.namespaceSelector || webhook.objectSelector,
  )
  return (
    <Space className="soha-config-detail-sections" orientation="vertical" size={16}>
      <Card className="soha-detail-card" title="Webhooks">
        <Table
          className="soha-platform-table"
          columns={webhookColumns}
          dataSource={webhooks}
          pagination={false}
          rowKey="name"
          size="small"
          tableLayout="fixed"
        />
      </Card>
      <Card className="soha-detail-card" title={localeCode === 'zh_CN' ? '规则' : 'Rules'}>
        <Table
          className="soha-platform-table"
          columns={ruleColumns}
          dataSource={rules}
          pagination={false}
          rowKey="key"
          size="small"
          tableLayout="fixed"
        />
      </Card>
      {selectors.length > 0 ? (
        <Card className="soha-detail-card" title={localeCode === 'zh_CN' ? '选择器' : 'Selectors'}>
          {selectors.map((webhook) => (
            <div key={webhook.name} className="soha-config-webhook-selector">
              <Text strong>{webhook.name}</Text>
              <Text>{`Namespace: ${webhook.namespaceSelector || '-'}`}</Text>
              <Text>{`Object: ${webhook.objectSelector || '-'}`}</Text>
            </div>
          ))}
        </Card>
      ) : null}
    </Space>
  )
}

export function renderResourceValues(value?: Record<string, string>): ReactNode {
  const entries = Object.entries(value ?? {})
  return entries.length > 0 ? entries.map(([key, item]) => `${key}: ${item}`).join(', ') : '-'
}
