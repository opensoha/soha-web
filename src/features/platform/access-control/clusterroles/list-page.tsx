import { useI18n } from '@/i18n'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { AccessControlResourceListPage } from '../shared/list-page'
import { AccessControlNameLink } from '../shared/relationships'
import { CLUSTER_ROLE_DEFAULT_TEMPLATE } from '../shared/templates'
import type { ClusterRoleResource } from './types'

export function PlatformAccessControlClusterRolesPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<ClusterRoleResource> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      render: (value: string) => <AccessControlNameLink kind="clusterroles" name={value} />,
    },
    { title: localeCode === 'zh_CN' ? '规则数' : 'Rules', dataIndex: 'rules', width: 88 },
    {
      title: localeCode === 'zh_CN' ? '聚合规则' : 'Aggregation',
      dataIndex: 'aggregationRules',
      width: 108,
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
      defaultTemplate={CLUSTER_ROLE_DEFAULT_TEMPLATE}
      emptyDescription={{
        zh_CN: '当前集群没有 ClusterRole',
        en_US: 'No cluster roles in this cluster',
      }}
      kind="clusterroles"
      label="ClusterRoles"
      rowKey="name"
      searchValues={(record) => [record.name]}
    />
  )
}
