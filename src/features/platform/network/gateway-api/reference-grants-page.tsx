import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import type { TableColumnsType } from 'antd'
import { NetworkResourceListPage } from '../shared/list-page'
import { buildGatewayAPIRoutePath } from '../shared/paths'
import { renderNetworkTextList } from '../shared/renderers'
import { gatewayAPIQueries } from './queries'
import type { ReferenceGrant } from './types'

export function NetworkReferenceGrantsPage() {
  const { localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const query = useQuery(
    gatewayAPIQueries.list<ReferenceGrant>('referencegrants', toScopeKey(clusterId, namespace)),
  )
  const columns: TableColumnsType<ReferenceGrant> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      width: 260,
      render: (value: string, record) => (
        <Link to={buildGatewayAPIRoutePath('referencegrants', value, record.namespace)}>
          {value}
        </Link>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
    },
    {
      title: 'From',
      dataIndex: 'from',
      render: (value?: string[]) => renderNetworkTextList(value),
    },
    { title: 'To', dataIndex: 'to', render: (value?: string[]) => renderNetworkTextList(value) },
    {
      title: 'Age',
      dataIndex: 'ageSeconds',
      width: 104,
      render: (value: number) => formatAgeSeconds(value),
    },
  ]
  return (
    <NetworkResourceListPage
      buildAIPageContext={(items, searchKeyword) => ({
        sourceWorkbench: 'platform',
        sourceRoute: '/network/gateway-api/referencegrants',
        sourceTitle: 'ReferenceGrants',
        entityKind: 'kubernetes.referencegrant.list',
        entityName: 'ReferenceGrants',
        clusterId: clusterId ?? undefined,
        namespace: namespace ?? undefined,
        visibleFilters: { searchKeyword },
        pinnedData: { total: items.length },
      })}
      columns={columns}
      deletable={false}
      emptyDescription={{
        zh_CN: '当前范围没有 ReferenceGrant，或未安装 Gateway API CRD',
        en_US: 'No ReferenceGrants in the current scope, or Gateway API CRDs are not installed',
      }}
      kind="referencegrants"
      noMatchDescription={{ zh_CN: '没有匹配的资源', en_US: 'No matching resources' }}
      query={query}
      searchPlaceholder={{
        zh_CN: '搜索 ReferenceGrant / namespace / from / to',
        en_US: 'Search ReferenceGrant / namespace / from / to',
      }}
      searchValues={(record) => [
        record.name,
        record.namespace,
        ...(record.from ?? []),
        ...(record.to ?? []),
      ]}
    />
  )
}
