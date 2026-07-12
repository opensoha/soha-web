import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ConfigurationNameLink, ConfigurationResourceListPage } from '../shared/list-page'
import type { MutatingWebhookConfigurationResource } from './types'

const columns: TableColumnsType<MutatingWebhookConfigurationResource> = [
  {
    title: 'Name',
    dataIndex: 'name',
    ellipsis: { showTitle: false },
    render: (value: string) => (
      <ConfigurationNameLink kind="mutatingwebhookconfigurations" name={value} />
    ),
  },
  { title: 'Webhooks', dataIndex: 'webhooks', width: 120 },
  {
    ...tableColumnPresets.datetime,
    title: 'Age',
    dataIndex: 'ageSeconds',
    width: 120,
    render: (value: number) => formatAgeSeconds(value),
  },
]

export function ConfigurationMutatingWebhooksPage() {
  return (
    <ConfigurationResourceListPage
      columns={columns}
      emptyDescription={{
        zh_CN: '当前集群没有 MutatingWebhookConfiguration',
        en_US: 'No mutating webhook configurations in this cluster',
      }}
      kind="mutatingwebhookconfigurations"
      label="MutatingWebhookConfigurations"
      scopeMode="cluster"
    />
  )
}
