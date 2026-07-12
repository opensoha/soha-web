import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { TableColumnsType } from 'antd'
import { StatusTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { formatAgeSeconds } from '@/utils/time'
import { StorageListPage } from '../shared/list-page'
import { persistentVolumeClaimMutations } from './mutations'
import { persistentVolumeClaimQueries } from './queries'
import type { PersistentVolumeClaim } from './types'

const DEFAULT_TEMPLATE = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: example-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
`

export function StoragePvcPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const columns: TableColumnsType<PersistentVolumeClaim> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 260,
      render: (value: string, record) => (
        <Button
          type="text"
          onClick={() =>
            navigate(
              `/storage/persistentvolumeclaims/${encodeURIComponent(value)}?namespace=${encodeURIComponent(record.namespace)}`,
            )
          }
        >
          {value}
        </Button>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 150,
    },
    {
      title: localeCode === 'zh_CN' ? '状态' : 'Status',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: 'Volume',
      dataIndex: 'volumeName',
      ellipsis: { showTitle: false },
      width: 220,
      render: (value?: string) => value || '-',
    },
    {
      title: localeCode === 'zh_CN' ? '申请容量' : 'Requested',
      dataIndex: 'requested',
      width: 110,
      render: (value?: string) => value || '-',
    },
    {
      title: 'StorageClass',
      dataIndex: 'storageClass',
      ellipsis: { showTitle: false },
      width: 180,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Access Modes',
      dataIndex: 'accessModes',
      ellipsis: { showTitle: false },
      width: 160,
      render: (value?: string[]) => value?.join(', ') || '-',
    },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <StorageListPage
      clusterScoped={false}
      columns={columns}
      createDefaultTemplate={DEFAULT_TEMPLATE}
      createOptions={persistentVolumeClaimMutations.create}
      emptyLabel={{ zh_CN: '当前范围没有 PVC', en_US: 'No PVCs in the current scope' }}
      getRecordNamespace={(record) => record.namespace}
      kind="PersistentVolumeClaim"
      listQuery={persistentVolumeClaimQueries.list}
      removeOptions={persistentVolumeClaimMutations.remove}
      resourceLabel="PVC"
      rowKey={(record) => `${record.namespace}/${record.name}`}
      searchPlaceholder={{
        zh_CN: '搜索 PVC / namespace / storageClass',
        en_US: 'Search PVC / namespace / storageClass',
      }}
      searchValues={(record) => [
        record.name,
        record.namespace,
        record.status,
        record.storageClass,
        record.volumeName,
      ]}
    />
  )
}
