import { useI18n } from '@/i18n'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { AccessControlResourceListPage } from '../shared/list-page'
import { AccessControlNameLink } from '../shared/relationships'
import { SERVICE_ACCOUNT_DEFAULT_TEMPLATE } from '../shared/templates'
import type { ServiceAccountResource } from './types'

export function PlatformAccessControlServiceAccountsPage() {
  const { localeCode } = useI18n()
  const columns: TableColumnsType<ServiceAccountResource> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      render: (value: string, record) => (
        <AccessControlNameLink kind="serviceaccounts" name={value} namespace={record.namespace} />
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
      defaultTemplate={SERVICE_ACCOUNT_DEFAULT_TEMPLATE}
      emptyDescription={{
        zh_CN: '当前范围没有 ServiceAccounts',
        en_US: 'No service accounts in the current scope',
      }}
      kind="serviceaccounts"
      label="ServiceAccounts"
      rowKey={(record) => `${record.namespace}/${record.name}`}
      searchValues={(record) => [record.name, record.namespace]}
    />
  )
}
