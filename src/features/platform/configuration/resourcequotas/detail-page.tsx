import { Card, Table } from 'antd'
import { useParams, useSearchParams } from 'react-router-dom'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type { TableColumnsType } from 'antd'
import { ConfigurationQueryDetailPage } from '../shared/detail-shell'
import { resolveConfigurationNamespace } from '../shared/scope'
import type { ResourceQuotaResource } from './types'

interface QuotaRow {
  readonly resource: string
  readonly hard: string
  readonly used: string
}

function QuotaOverview({ detail }: { detail: ResourceQuotaResource }) {
  const resources = [
    ...new Set([...Object.keys(detail.hard ?? {}), ...Object.keys(detail.used ?? {})]),
  ]
  const rows = resources.sort().map((resource) => ({
    resource,
    hard: detail.hard?.[resource] ?? '-',
    used: detail.used?.[resource] ?? '-',
  }))
  const columns: TableColumnsType<QuotaRow> = [
    { title: 'Resource', dataIndex: 'resource' },
    { title: 'Hard', dataIndex: 'hard', width: 220 },
    { title: 'Used', dataIndex: 'used', width: 220 },
  ]
  return (
    <Card className="soha-detail-card" title="Quota usage">
      <Table
        className="soha-platform-table"
        columns={columns}
        dataSource={rows}
        pagination={false}
        rowKey="resource"
        size="small"
      />
    </Card>
  )
}

export function ConfigurationResourceQuotaDetailPage() {
  const name = useParams().name as string
  const [searchParams] = useSearchParams()
  const { namespace } = usePlatformScopeStore()
  const detailNamespace = resolveConfigurationNamespace(namespace, searchParams.get('namespace'))
  return (
    <ConfigurationQueryDetailPage<ResourceQuotaResource>
      kind="resourcequotas"
      label="ResourceQuota"
      name={name}
      namespace={detailNamespace}
      overviewExtra={(detail) => [
        { key: 'Scopes', value: detail.scopes?.join(', ') || '-' },
        { key: 'Hard', value: Object.keys(detail.hard ?? {}).length || '-' },
        { key: 'Used', value: Object.keys(detail.used ?? {}).length || '-' },
      ]}
      renderOverview={(detail) => <QuotaOverview detail={detail} />}
    />
  )
}
