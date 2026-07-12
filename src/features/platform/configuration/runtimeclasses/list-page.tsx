import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ConfigurationResourceListPage } from '../shared/list-page'
import type { RuntimeClassResource } from './types'

const columns: TableColumnsType<RuntimeClassResource> = [
  { title: 'Name', dataIndex: 'name', width: 280, ellipsis: { showTitle: false } },
  { title: 'Handler', dataIndex: 'handler', ellipsis: { showTitle: false } },
  {
    ...tableColumnPresets.datetime,
    title: 'Age',
    dataIndex: 'ageSeconds',
    width: 120,
    render: (value: number) => formatAgeSeconds(value),
  },
]

export function ConfigurationRuntimeClassesPage() {
  return (
    <ConfigurationResourceListPage
      columns={columns}
      emptyDescription={{
        zh_CN: '当前集群没有 RuntimeClass',
        en_US: 'No runtime classes in this cluster',
      }}
      kind="runtimeclasses"
      label="RuntimeClasses"
      scopeMode="cluster"
    />
  )
}
