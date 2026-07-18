import { Card, Table } from 'antd'
import { useParams, useSearchParams } from 'react-router-dom'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type { TableColumnsType } from 'antd'
import { renderResourceValues } from '../shared/detail-tables'
import { ConfigurationQueryDetailPage } from '../shared/detail-shell'
import { resolveConfigurationNamespace } from '../shared/scope'
import type { LimitRangeResource, LimitRangeRule } from './types'

function LimitRangeOverview({ detail }: { detail: LimitRangeResource }) {
  const columns: TableColumnsType<LimitRangeRule> = [
    { title: 'Type', dataIndex: 'type', width: 120 },
    { title: 'Min', dataIndex: 'min', render: renderResourceValues },
    { title: 'Max', dataIndex: 'max', render: renderResourceValues },
    { title: 'Default', dataIndex: 'default', render: renderResourceValues },
    { title: 'Default request', dataIndex: 'defaultRequest', render: renderResourceValues },
    {
      title: 'Max limit/request ratio',
      dataIndex: 'maxLimitRequestRatio',
      render: renderResourceValues,
    },
  ]
  return (
    <Card className="soha-detail-card" title="Limit rules">
      <Table
        className="soha-platform-table"
        columns={columns}
        dataSource={detail.rules ?? []}
        pagination={false}
        rowKey={(rule) => `${rule.type}/${JSON.stringify(rule)}`}
        size="small"
        tableLayout="fixed"
      />
    </Card>
  )
}

export function ConfigurationLimitRangeDetailPage() {
  const name = useParams().name as string
  const [searchParams] = useSearchParams()
  const { namespace } = usePlatformScopeStore()
  const detailNamespace = resolveConfigurationNamespace(namespace, searchParams.get('namespace'))
  return (
    <ConfigurationQueryDetailPage<LimitRangeResource>
      kind="limitranges"
      label="LimitRange"
      name={name}
      namespace={detailNamespace}
      overviewExtra={(detail) => [{ key: 'Limits', value: detail.limits }]}
      renderOverview={(detail) => <LimitRangeOverview detail={detail} />}
    />
  )
}
