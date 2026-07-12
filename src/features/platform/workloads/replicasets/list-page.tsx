import { Progress, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { TableColumnsType } from 'antd'
import { useI18n } from '@/i18n'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { buildWorkloadDetailPath } from '@/features/platform/workloads-model'
import { renderWorkloadNameLink } from '../shared/list-controls'
import { ReplicaControllerListPage } from '../shared/replica-controller-list'
import type { ReplicaSet } from './types'
import '@/features/platform/workloads/styles.css'

const { Text } = Typography

function renderReady(ready: number, desired: number) {
  const percent = desired > 0 ? Math.min(100, Math.round((ready / desired) * 100)) : 0
  return (
    <div className="soha-replica-progress-cell">
      <Progress
        percent={percent}
        showInfo={false}
        size="small"
        status={desired === 0 || ready >= desired ? 'success' : 'active'}
      />
      <Text type="secondary">{`${ready}/${desired}`}</Text>
    </div>
  )
}

export function WorkloadsReplicaSetsPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const columns: TableColumnsType<ReplicaSet> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      render: (name: string, record) =>
        renderWorkloadNameLink(name, () =>
          navigate(buildWorkloadDetailPath('replicasets', name, null, record.namespace)),
        ),
      width: 240,
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
    },
    {
      title: 'Ready',
      dataIndex: 'readyReplicas',
      width: 190,
      render: (_: number, record) => renderReady(record.readyReplicas, record.desiredReplicas),
    },
    { title: 'Desired', dataIndex: 'desiredReplicas', width: 96 },
    { title: 'Available', dataIndex: 'availableReplicas', width: 110 },
    {
      ...tableColumnPresets.datetime,
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 120,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]

  return <ReplicaControllerListPage columns={columns} kind="replicasets" label="ReplicaSets" />
}
