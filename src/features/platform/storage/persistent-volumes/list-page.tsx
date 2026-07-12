import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { TableColumnsType } from 'antd'
import { StatusTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { formatAgeSeconds } from '@/utils/time'
import { StorageListPage } from '../shared/list-page'
import { persistentVolumeMutations } from './mutations'
import { persistentVolumeQueries } from './queries'
import type { PersistentVolume } from './types'

const DEFAULT_TEMPLATE = `apiVersion: v1
kind: PersistentVolume
metadata:
  name: example-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /data/example-pv
`

export function StoragePvPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const columns: TableColumnsType<PersistentVolume> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 260,
      render: (value: string) => (
        <Button
          type="text"
          onClick={() => navigate(`/storage/persistentvolumes/${encodeURIComponent(value)}`)}
        >
          {value}
        </Button>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '状态' : 'Status',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: localeCode === 'zh_CN' ? '容量' : 'Capacity',
      dataIndex: 'capacity',
      width: 110,
      render: (v?: string) => v || '-',
    },
    {
      title: 'StorageClass',
      dataIndex: 'storageClass',
      ellipsis: { showTitle: false },
      width: 180,
      render: (v?: string) => v || '-',
    },
    {
      title: 'Claim',
      dataIndex: 'claimRef',
      ellipsis: { showTitle: false },
      width: 260,
      render: (v?: string) => v || '-',
    },
    {
      title: 'Access Modes',
      dataIndex: 'accessModes',
      width: 160,
      render: (v?: string[]) => v?.join(', ') || '-',
    },
    { title: 'Reclaim Policy', dataIndex: 'reclaimPolicy', width: 140 },
    { title: 'Age', dataIndex: 'ageSeconds', width: 104, render: formatAgeSeconds },
  ]
  return (
    <StorageListPage
      clusterScoped
      columns={columns}
      createDefaultTemplate={DEFAULT_TEMPLATE}
      createOptions={persistentVolumeMutations.create}
      emptyLabel={{ zh_CN: '当前集群没有 PV', en_US: 'No PVs in this cluster' }}
      kind="PersistentVolume"
      listQuery={persistentVolumeQueries.list}
      removeOptions={persistentVolumeMutations.remove}
      resourceLabel="PV"
      rowKey="name"
      searchPlaceholder={{
        zh_CN: '搜索 PV / claim / storageClass',
        en_US: 'Search PV / claim / storageClass',
      }}
      searchValues={(record) => [
        record.name,
        record.status,
        record.storageClass,
        record.claimRef,
        record.reclaimPolicy,
      ]}
    />
  )
}
