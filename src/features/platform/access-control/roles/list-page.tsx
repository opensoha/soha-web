import { useI18n } from '@/i18n'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { AccessControlResourceListPage } from '../shared/list-page'
import { AccessControlNameLink } from '../shared/relationships'
import { ROLE_DEFAULT_TEMPLATE } from '../shared/templates'
import type { RoleResource } from './types'

export function PlatformAccessControlRolesPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<RoleResource> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      render: (value: string, record) => (
        <AccessControlNameLink kind="roles" name={value} namespace={record.namespace} />
      ),
    },
    { title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace', dataIndex: 'namespace' },
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
      defaultTemplate={ROLE_DEFAULT_TEMPLATE}
      emptyDescription={{ zh_CN: '当前范围没有 Roles', en_US: 'No roles in the current scope' }}
      kind="roles"
      label="Roles"
      rowKey={(record) => `${record.namespace}/${record.name}`}
      searchValues={(record) => [record.name, record.namespace]}
    />
  )
}
