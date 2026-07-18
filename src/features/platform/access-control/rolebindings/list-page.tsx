import { useI18n } from '@/i18n'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { AccessControlResourceListPage } from '../shared/list-page'
import { AccessControlNameLink, AccessControlRoleRefNameLink } from '../shared/relationships'
import { ROLE_BINDING_DEFAULT_TEMPLATE } from '../shared/templates'
import type { RoleBindingResource } from './types'

export function PlatformAccessControlRoleBindingsPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<RoleBindingResource> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 310,
      render: (value: string, record) => (
        <AccessControlNameLink kind="rolebindings" name={value} namespace={record.namespace} />
      ),
    },
    { title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace', dataIndex: 'namespace' },
    {
      title: 'RoleRef',
      dataIndex: 'roleRef',
      ellipsis: { showTitle: false },
      width: 310,
      render: (value: string | undefined, record) => (
        <AccessControlRoleRefNameLink namespace={record.namespace} value={value} />
      ),
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
      defaultTemplate={ROLE_BINDING_DEFAULT_TEMPLATE}
      emptyDescription={{
        zh_CN: '当前范围没有 RoleBindings',
        en_US: 'No role bindings in the current scope',
      }}
      kind="rolebindings"
      label="RoleBindings"
      rowKey={(record) => `${record.namespace}/${record.name}`}
      searchValues={(record) => [record.name, record.namespace, record.roleRef]}
    />
  )
}
