import { useI18n } from '@/i18n'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { AccessControlResourceListPage } from '../shared/list-page'
import { AccessControlNameLink, AccessControlRoleRefNameLink } from '../shared/relationships'
import { CLUSTER_ROLE_BINDING_DEFAULT_TEMPLATE } from '../shared/templates'
import type { ClusterRoleBindingResource } from './types'

export function PlatformAccessControlClusterRoleBindingsPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<ClusterRoleBindingResource> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 310,
      render: (value: string) => <AccessControlNameLink kind="clusterrolebindings" name={value} />,
    },
    {
      title: 'RoleRef',
      dataIndex: 'roleRef',
      ellipsis: { showTitle: false },
      width: 280,
      render: (value: string | undefined) => <AccessControlRoleRefNameLink value={value} />,
    },
    {
      ...tableColumnPresets.datetime,
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <AccessControlResourceListPage
      columns={columns}
      defaultTemplate={CLUSTER_ROLE_BINDING_DEFAULT_TEMPLATE}
      emptyDescription={{
        zh_CN: '当前集群没有 ClusterRoleBinding',
        en_US: 'No cluster role bindings in this cluster',
      }}
      kind="clusterrolebindings"
      label="ClusterRoleBindings"
      rowKey="name"
      searchValues={(record) => [record.name, record.roleRef]}
    />
  )
}
