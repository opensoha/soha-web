import { BooleanTag } from '@/components/status-tag'
import { TableCellText } from '@/components/table-cell-content'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ConfigurationResourceListPage } from '../shared/list-page'
import type { PriorityClassResource } from './types'

const columns: TableColumnsType<PriorityClassResource> = [
  {
    title: 'Name',
    dataIndex: 'name',
    width: 280,
    ellipsis: { showTitle: false },
    render: (value: string) => <TableCellText value={value} />,
  },
  { title: 'Value', dataIndex: 'value', width: 120 },
  {
    title: 'Global Default',
    dataIndex: 'globalDefault',
    width: 140,
    render: (value: boolean) => <BooleanTag value={value} trueLabel="Yes" falseLabel="No" />,
  },
  {
    title: 'Preemption',
    dataIndex: 'preemptionPolicy',
    width: 180,
    render: (value: string | undefined) => <TableCellText value={value} />,
  },
  {
    title: 'Description',
    dataIndex: 'description',
    ellipsis: { showTitle: false },
    render: (value: string | undefined) => <TableCellText value={value} />,
  },
  {
    ...tableColumnPresets.datetime,
    title: 'Age',
    dataIndex: 'ageSeconds',
    width: 120,
    render: (value: number) => formatAgeSeconds(value),
  },
]

export function ConfigurationPriorityClassesPage() {
  return (
    <ConfigurationResourceListPage
      columns={columns}
      emptyDescription={{
        zh_CN: '当前集群没有 PriorityClass',
        en_US: 'No priority classes in this cluster',
      }}
      kind="priorityclasses"
      label="PriorityClasses"
      scopeMode="cluster"
    />
  )
}
