import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ConfigurationNameLink, ConfigurationResourceListPage } from '../shared/list-page'
import { ResourceQuotaUsage } from './quota-usage'
import type { ResourceQuotaResource } from './types'

const columns: TableColumnsType<ResourceQuotaResource> = [
  { title: 'Namespace', dataIndex: 'namespace', width: 160 },
  {
    title: 'Name',
    dataIndex: 'name',
    width: 240,
    ellipsis: { showTitle: false },
    render: (value: string, record) => (
      <ConfigurationNameLink kind="resourcequotas" name={value} namespace={record.namespace} />
    ),
  },
  {
    title: 'Scopes',
    dataIndex: 'scopes',
    width: 220,
    ellipsis: { showTitle: false },
    render: (value: string[] | undefined) => value?.join(', ') || '-',
  },
  {
    title: 'Usage',
    dataIndex: 'hard',
    render: (_value, record) => <ResourceQuotaUsage record={record} />,
  },
  {
    ...tableColumnPresets.datetime,
    title: 'Age',
    dataIndex: 'ageSeconds',
    width: 120,
    render: (value: number) => formatAgeSeconds(value),
  },
]

export function ConfigurationResourceQuotasPage() {
  return (
    <ConfigurationResourceListPage
      columns={columns}
      emptyDescription={{
        zh_CN: '当前范围没有 ResourceQuota',
        en_US: 'No resource quotas in the current scope',
      }}
      kind="resourcequotas"
      label="ResourceQuotas"
    />
  )
}
