import { formatAgeSeconds, formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ConfigurationResourceListPage } from '../shared/list-page'
import type { LeaseResource } from './types'

const columns: TableColumnsType<LeaseResource> = [
  { title: 'Namespace', dataIndex: 'namespace', width: 160 },
  { title: 'Name', dataIndex: 'name', width: 260, ellipsis: { showTitle: false } },
  {
    title: 'Holder',
    dataIndex: 'holderIdentity',
    ellipsis: { showTitle: false },
    render: (value: string | undefined) => value || '-',
  },
  {
    title: 'Duration (s)',
    dataIndex: 'leaseDurationSeconds',
    width: 120,
    render: (value: number | undefined) => (value == null ? '-' : String(value)),
  },
  {
    title: 'Acquired',
    dataIndex: 'acquireTime',
    width: 180,
    render: (value: string | undefined) => (value ? formatDateTime(value) : '-'),
  },
  {
    title: 'Renewed',
    dataIndex: 'renewTime',
    width: 180,
    render: (value: string | undefined) => (value ? formatDateTime(value) : '-'),
  },
  {
    ...tableColumnPresets.datetime,
    title: 'Age',
    dataIndex: 'ageSeconds',
    width: 120,
    render: (value: number) => formatAgeSeconds(value),
  },
]

export function ConfigurationLeasesPage() {
  return (
    <ConfigurationResourceListPage
      columns={columns}
      emptyDescription={{
        zh_CN: '当前范围没有 Lease',
        en_US: 'No leases in the current scope',
      }}
      kind="leases"
      label="Leases"
    />
  )
}
