import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ConfigurationNameLink, ConfigurationResourceListPage } from '../shared/list-page'
import type { ValidatingWebhookConfigurationResource } from './types'

const columns: TableColumnsType<ValidatingWebhookConfigurationResource> = [
  {
    title: 'Name',
    dataIndex: 'name',
    ellipsis: { showTitle: false },
    render: (value: string) => (
      <ConfigurationNameLink kind="validatingwebhookconfigurations" name={value} />
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

export function ConfigurationValidatingWebhooksPage() {
  return (
    <ConfigurationResourceListPage
      columns={columns}
      emptyDescription={{
        zh_CN: '当前集群没有 ValidatingWebhookConfiguration',
        en_US: 'No validating webhook configurations in this cluster',
      }}
      kind="validatingwebhookconfigurations"
      label="ValidatingWebhookConfigurations"
      scopeMode="cluster"
    />
  )
}
