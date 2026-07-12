import { BooleanTag } from '@/components/status-tag'
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
    { title: 'Secrets', dataIndex: 'secrets', width: 88 },
    {
      title: localeCode === 'zh_CN' ? '镜像拉取密钥' : 'Image Pull Secrets',
      dataIndex: 'imagePullSecrets',
      width: 138,
    },
    {
      title: localeCode === 'zh_CN' ? '自动挂载 Token' : 'Automount Token',
      dataIndex: 'automountServiceAccountToken',
      width: 132,
      render: (value: boolean) => (
        <BooleanTag
          falseLabel={localeCode === 'zh_CN' ? '否' : 'No'}
          trueLabel={localeCode === 'zh_CN' ? '是' : 'Yes'}
          value={value}
        />
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
