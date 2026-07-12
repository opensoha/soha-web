import { Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import type { TableColumnsType } from 'antd'
import { NetworkResourceListPage } from '../shared/list-page'
import { buildNetworkRoutePath } from '../shared/paths'
import { renderNetworkTextList } from '../shared/renderers'
import { networkCoreQueries } from './queries'
import type { NetworkPolicy } from './types'

export function NetworkPoliciesPage() {
  const navigate = useNavigate()
  const { clusterId, namespace } = usePlatformScopeStore()
  const query = useQuery(
    networkCoreQueries.list<NetworkPolicy>('networkpolicies', toScopeKey(clusterId, namespace)),
  )
  const columns: TableColumnsType<NetworkPolicy> = [
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 280,
      render: (value: string, record) => (
        <Button
          type="text"
          onClick={() =>
            navigate(buildNetworkRoutePath('networkpolicies', value, record.namespace))
          }
        >
          {value}
        </Button>
      ),
    },
    { title: 'Namespace', dataIndex: 'namespace', width: 160 },
    {
      title: 'Policy Types',
      dataIndex: 'policyTypes',
      render: (value?: string[]) => renderNetworkTextList(value),
    },
    { title: 'Ingress Rules', dataIndex: 'ingressRules', width: 120 },
    { title: 'Egress Rules', dataIndex: 'egressRules', width: 120 },
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
        sourceRoute: '/network/networkpolicies',
        sourceTitle: 'NetworkPolicies',
        entityKind: 'kubernetes.networkpolicy.list',
        entityName: 'NetworkPolicies',
        clusterId: clusterId ?? undefined,
        namespace: namespace ?? undefined,
        visibleFilters: { searchKeyword },
        pinnedData: { total: items.length },
      })}
      columns={columns}
      emptyDescription={{
        zh_CN: '当前范围没有 NetworkPolicy',
        en_US: 'No NetworkPolicies in the current scope',
      }}
      kind="networkpolicies"
      noMatchDescription={{ zh_CN: '没有匹配的资源', en_US: 'No matching resources' }}
      query={query}
      searchPlaceholder={{
        zh_CN: '搜索 NetworkPolicy / namespace / type',
        en_US: 'Search NetworkPolicy / namespace / type',
      }}
      searchValues={(record) => [record.name, record.namespace, ...(record.policyTypes ?? [])]}
    />
  )
}
