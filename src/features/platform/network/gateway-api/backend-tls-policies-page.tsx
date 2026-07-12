import { useQuery } from '@tanstack/react-query'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import type { TableColumnsType } from 'antd'
import { NetworkResourceListPage } from '../shared/list-page'
import { renderNetworkTextList } from '../shared/renderers'
import { gatewayAPIQueries } from './queries'
import type { BackendTLSPolicy } from './types'

export function NetworkBackendTLSPoliciesPage() {
  const { localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const query = useQuery(
    gatewayAPIQueries.list<BackendTLSPolicy>(
      'backendtlspolicies',
      toScopeKey(clusterId, namespace),
    ),
  )
  const columns: TableColumnsType<BackendTLSPolicy> = [
    { title: localeCode === 'zh_CN' ? '名称' : 'Name', dataIndex: 'name', width: 260 },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
    },
    {
      title: 'Targets',
      dataIndex: 'targetRefs',
      render: (value?: string[]) => renderNetworkTextList(value),
    },
    { title: 'Hostname', dataIndex: 'hostname', render: (value?: string) => value || '-' },
    {
      title: 'CA Refs',
      dataIndex: 'caCertificateRefs',
      render: (value?: string[]) => renderNetworkTextList(value),
    },
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
        sourceRoute: '/network/gateway-api/backendtlspolicies',
        sourceTitle: 'BackendTLSPolicies',
        entityKind: 'kubernetes.backendtlspolicy.list',
        entityName: 'BackendTLSPolicies',
        clusterId: clusterId ?? undefined,
        namespace: namespace ?? undefined,
        visibleFilters: { searchKeyword },
        pinnedData: { total: items.length },
      })}
      columns={columns}
      deletable={false}
      emptyDescription={{
        zh_CN: '当前范围没有 BackendTLSPolicy，或未安装 Gateway API CRD',
        en_US: 'No BackendTLSPolicies in the current scope, or Gateway API CRDs are not installed',
      }}
      kind="backendtlspolicies"
      noMatchDescription={{ zh_CN: '没有匹配的资源', en_US: 'No matching resources' }}
      query={query}
      searchPlaceholder={{
        zh_CN: '搜索 BackendTLSPolicy / namespace / target / hostname',
        en_US: 'Search BackendTLSPolicy / namespace / target / hostname',
      }}
      searchValues={(record) => [
        record.name,
        record.namespace,
        record.hostname,
        record.wellKnownCACertificates,
        ...(record.targetRefs ?? []),
        ...(record.caCertificateRefs ?? []),
      ]}
    />
  )
}
