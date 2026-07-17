import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { TableColumnsType } from 'antd'
import { BooleanTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { formatAgeSeconds } from '@/utils/time'
import { StorageListPage } from '../shared/list-page'
import { storageClassMutations } from './mutations'
import { storageClassQueries } from './queries'
import type { StorageClass } from './types'

const DEFAULT_TEMPLATE = `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: example-storage-class
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
`

export function StorageClassesPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const columns: TableColumnsType<StorageClass> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 260,
      render: (value: string) => (
        <Button
          type="text"
          onClick={() => navigate(`/storage/storageclasses/${encodeURIComponent(value)}`)}
        >
          {value}
        </Button>
      ),
    },
    { title: 'Provisioner', dataIndex: 'provisioner', ellipsis: { showTitle: false }, width: 320 },
    { title: 'Reclaim Policy', dataIndex: 'reclaimPolicy', width: 140 },
    { title: 'Binding Mode', dataIndex: 'volumeBindingMode', width: 180 },
    {
      title: localeCode === 'zh_CN' ? '允许扩容' : 'Expansion',
      dataIndex: 'allowVolumeExpansion',
      width: 110,
      render: (value: boolean) => <BooleanTag value={value} trueLabel="Yes" falseLabel="No" />,
    },
    { title: 'Age', dataIndex: 'ageSeconds', width: 104, render: formatAgeSeconds },
  ]
  return (
    <StorageListPage
      clusterScoped
      columns={columns}
      createDefaultTemplate={DEFAULT_TEMPLATE}
      emptyLabel={{
        zh_CN: '当前集群没有 StorageClass',
        en_US: 'No storage classes in this cluster',
      }}
      kind="StorageClass"
      listQuery={storageClassQueries.list}
      removeOptions={storageClassMutations.remove}
      resourceLabel="StorageClass"
      rowKey="name"
      searchPlaceholder={{
        zh_CN: '搜索 StorageClass / provisioner',
        en_US: 'Search StorageClass / provisioner',
      }}
      searchValues={(record) => [
        record.name,
        record.provisioner,
        record.reclaimPolicy,
        record.volumeBindingMode,
      ]}
    />
  )
}
