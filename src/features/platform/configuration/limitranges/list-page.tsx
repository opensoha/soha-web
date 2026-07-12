import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ConfigurationNameLink, ConfigurationResourceListPage } from '../shared/list-page'
import type { LimitRangeResource } from './types'

const columns: TableColumnsType<LimitRangeResource> = [
  { title: 'Namespace', dataIndex: 'namespace', width: 160 },
  {
    title: 'Name',
    dataIndex: 'name',
    ellipsis: { showTitle: false },
    render: (value: string, record) => (
      <ConfigurationNameLink kind="limitranges" name={value} namespace={record.namespace} />
    ),
  },
  { title: 'Limits', dataIndex: 'limits', width: 120 },
  {
    ...tableColumnPresets.datetime,
    title: 'Age',
    dataIndex: 'ageSeconds',
    width: 120,
    render: (value: number) => formatAgeSeconds(value),
  },
]

export function ConfigurationLimitRangesPage() {
  return (
    <ConfigurationResourceListPage
      columns={columns}
      emptyDescription={{
        zh_CN: '当前范围没有 LimitRange',
        en_US: 'No limit ranges in the current scope',
      }}
      kind="limitranges"
      label="LimitRanges"
    />
  )
}
