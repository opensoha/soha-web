import { BooleanTag } from '@/components/status-tag'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ConfigurationNameLink, ConfigurationResourceListPage } from '../shared/list-page'
import { SECRET_DEFAULT_TEMPLATE, type SecretResource } from './types'

const secretColumns: TableColumnsType<SecretResource> = [
  {
    title: 'Name',
    dataIndex: 'name',
    render: (value: string, record) => (
      <ConfigurationNameLink kind="secrets" name={value} namespace={record.namespace} />
    ),
  },
  { title: 'Namespace', dataIndex: 'namespace' },
  { title: 'Type', dataIndex: 'type', render: (value: string) => value || '-' },
  { title: 'Data', dataIndex: 'dataEntries' },
  {
    title: 'Immutable',
    dataIndex: 'immutable',
    render: (value: boolean) => <BooleanTag value={value} />,
  },
  {
    ...tableColumnPresets.datetime,
    title: 'Age',
    dataIndex: 'ageSeconds',
    render: (value: number) => formatAgeSeconds(value),
  },
]

export function ConfigurationSecretsPage() {
  return (
    <ConfigurationResourceListPage
      columns={secretColumns}
      defaultTemplate={SECRET_DEFAULT_TEMPLATE}
      emptyDescription={{
        zh_CN: '当前范围没有 Secrets',
        en_US: 'No secrets in the current scope',
      }}
      kind="secrets"
      label="Secrets"
      singularLabel="Secret"
    />
  )
}
