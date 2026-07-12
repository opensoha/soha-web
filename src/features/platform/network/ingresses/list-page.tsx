import { Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { formatAgeSeconds } from '@/utils/time'
import type { TableColumnsType } from 'antd'
import { buildNetworkRoutePath } from '../shared/paths'
import { NetworkResourceListPage } from '../shared/list-page'
import { renderNetworkTextList } from '../shared/renderers'
import { ingressQueries } from './queries'
import type { Ingress } from './types'

export function NetworkIngressesPage() {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const { clusterId, namespace } = usePlatformScopeStore()
  const scope = toScopeKey(clusterId, namespace)
  const query = useQuery(ingressQueries.list(scope))
  const columns: TableColumnsType<Ingress> = [
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      ellipsis: { showTitle: false },
      width: 260,
      render: (value: string, record) => (
        <Button
          type="text"
          onClick={() => navigate(buildNetworkRoutePath('ingresses', value, record.namespace))}
        >
          {value}
        </Button>
      ),
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
    },
    {
      title: 'IngressClass',
      dataIndex: 'className',
      width: 160,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Hosts',
      dataIndex: 'hosts',
      render: (value?: string[]) => renderNetworkTextList(value),
    },
    { title: 'Address', dataIndex: 'address', render: (value?: string) => value || '-' },
    {
      title: 'Backend Services',
      dataIndex: 'backendServices',
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
        sourceRoute: '/network/ingresses',
        sourceTitle: localeCode === 'zh_CN' ? 'Ingresses 列表' : 'Ingresses',
        entityKind: 'kubernetes.ingress.list',
        entityName: 'Ingresses',
        clusterId: clusterId ?? undefined,
        namespace: namespace ?? undefined,
        timeRangeMinutes: 60,
        visibleFilters: { searchKeyword },
        pinnedData: { total: items.length },
        promptHint: '分析当前 Ingress 列表的域名、地址、IngressClass 和后端 Service 风险。',
      })}
      columns={columns}
      emptyDescription={{
        zh_CN: '当前范围没有 Ingress',
        en_US: 'No ingresses in the current scope',
      }}
      kind="ingresses"
      noMatchDescription={{ zh_CN: '没有匹配的资源', en_US: 'No matching resources' }}
      query={query}
      searchPlaceholder={{
        zh_CN: '搜索 Ingress / namespace / host / service',
        en_US: 'Search ingress / namespace / host / service',
      }}
      searchValues={(record) => [
        record.name,
        record.namespace,
        record.className,
        record.address,
        ...record.hosts,
        ...(record.backendServices ?? []),
      ]}
    />
  )
}
