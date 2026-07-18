import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ConfigurationNameLink, ConfigurationResourceListPage } from '../shared/list-page'
import { CONFIGMAP_DEFAULT_TEMPLATE, type ConfigMapResource } from './types'

const configMapColumns: TableColumnsType<ConfigMapResource> = [
  {
    title: 'Name',
    dataIndex: 'name',
    render: (value: string, record) => (
      <ConfigurationNameLink kind="configmaps" name={value} namespace={record.namespace} />
    ),
  },
  { title: 'Namespace', dataIndex: 'namespace' },
  { title: 'Data', dataIndex: 'dataEntries' },
  {
    ...tableColumnPresets.datetime,
    title: 'Age',
    dataIndex: 'ageSeconds',
    render: (value: number) => formatAgeSeconds(value),
  },
]

export function ConfigurationConfigMapsPage() {
  return (
    <ConfigurationResourceListPage
      columns={configMapColumns}
      defaultTemplate={CONFIGMAP_DEFAULT_TEMPLATE}
      emptyDescription={{
        zh_CN: '当前范围没有 ConfigMaps',
        en_US: 'No configmaps in the current scope',
      }}
      kind="configmaps"
      label="ConfigMaps"
      singularLabel="ConfigMap"
    />
  )
}
