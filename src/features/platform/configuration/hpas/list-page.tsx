import { useState } from 'react'
import { TableCellText } from '@/components/table-cell-content'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ConfigurationNameLink, ConfigurationResourceListPage } from '../shared/list-page'
import { ConfigurationQuickEditModal } from '../shared/configuration-quick-edit-modal'
import type { HorizontalPodAutoscalerResource } from './types'

const columns: TableColumnsType<HorizontalPodAutoscalerResource> = [
  {
    title: 'Name',
    dataIndex: 'name',
    width: 260,
    ellipsis: { showTitle: false },
    render: (value: string, record) => (
      <ConfigurationNameLink kind="hpas" name={value} namespace={record.namespace} />
    ),
  },
  { title: 'Namespace', dataIndex: 'namespace', width: 160 },
  {
    title: 'Target',
    dataIndex: 'targetRef',
    width: 260,
    ellipsis: { showTitle: false },
    render: (value: string) => <TableCellText value={value} />,
  },
  { title: 'Min', dataIndex: 'minReplicas', width: 88 },
  { title: 'Max', dataIndex: 'maxReplicas', width: 88 },
  { title: 'Current', dataIndex: 'currentReplicas', width: 96 },
  { title: 'Desired', dataIndex: 'desiredReplicas', width: 96 },
  {
    ...tableColumnPresets.datetime,
    title: 'Age',
    dataIndex: 'ageSeconds',
    width: 120,
    render: (value: number) => formatAgeSeconds(value),
  },
]

export function ConfigurationHPAPage() {
  const [editing, setEditing] = useState<HorizontalPodAutoscalerResource | null>(null)
  return (
    <>
      <ConfigurationResourceListPage
        columns={columns}
        emptyDescription={{
          zh_CN: '当前范围没有 HPA',
          en_US: 'No HPA resources in the current scope',
        }}
        kind="hpas"
        label="HorizontalPodAutoscalers"
        onEdit={setEditing}
      />
      {editing ? (
        <ConfigurationQuickEditModal
          kind="hpas"
          name={editing.name}
          namespace={editing.namespace}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}
