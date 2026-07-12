import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ConfigurationNameLink, ConfigurationResourceListPage } from '../shared/list-page'
import type { PodDisruptionBudgetResource } from './types'

const columns: TableColumnsType<PodDisruptionBudgetResource> = [
  {
    title: 'Name',
    dataIndex: 'name',
    width: 260,
    ellipsis: { showTitle: false },
    render: (value: string, record) => (
      <ConfigurationNameLink
        kind="poddisruptionbudgets"
        name={value}
        namespace={record.namespace}
      />
    ),
  },
  { title: 'Namespace', dataIndex: 'namespace', width: 160 },
  {
    title: 'Min Available',
    dataIndex: 'minAvailable',
    width: 128,
    render: (value: string | undefined) => value || '-',
  },
  {
    title: 'Max Unavailable',
    dataIndex: 'maxUnavailable',
    width: 150,
    render: (value: string | undefined) => value || '-',
  },
  { title: 'Healthy', dataIndex: 'currentHealthy', width: 96 },
  { title: 'Desired', dataIndex: 'desiredHealthy', width: 96 },
  { title: 'Allowed', dataIndex: 'disruptionsAllowed', width: 96 },
  {
    ...tableColumnPresets.datetime,
    title: 'Age',
    dataIndex: 'ageSeconds',
    width: 120,
    render: (value: number) => formatAgeSeconds(value),
  },
]

export function ConfigurationPodDisruptionBudgetsPage() {
  return (
    <ConfigurationResourceListPage
      columns={columns}
      emptyDescription={{
        zh_CN: '当前范围没有 PodDisruptionBudgets',
        en_US: 'No pod disruption budgets in the current scope',
      }}
      kind="poddisruptionbudgets"
      label="PodDisruptionBudgets"
    />
  )
}
