import { useState } from 'react'
import { Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useAIPageContext } from '@/features/copilot'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { NetworkDetailShell } from '../shared/detail-shell'
import { renderNetworkTextList } from '../shared/renderers'
import { resolveNetworkNamespace } from '../shared/scope'
import { ingressQueries } from './queries'

export function IngressDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const { clusterId, namespace } = usePlatformScopeStore()
  const name = (params.name as string | undefined) ?? ''
  const detailNamespace = resolveNetworkNamespace(namespace, searchParams.get('namespace'))
  const scope = toScopeKey(clusterId, detailNamespace)
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const detailQuery = useQuery(ingressQueries.detail(scope, name))
  const ingress = detailQuery.data

  useAIPageContext({
    sourceWorkbench: 'platform',
    sourceTitle: `Ingress ${ingress?.name ?? name}`,
    entityKind: 'kubernetes.ingress',
    entityName: ingress?.name ?? name,
    clusterId: clusterId ?? undefined,
    namespace: detailNamespace || ingress?.namespace,
    timeRangeMinutes: 60,
    pinnedData: {
      className: ingress?.className,
      hosts: ingress?.hosts,
      address: ingress?.address,
      backendServices: ingress?.backendServices,
      activeTab: activeTabKey,
    },
    promptHint: `排查 Ingress ${ingress?.name ?? name} 的域名、地址、IngressClass 和后端 Service。`,
  })

  if (!clusterId || !detailNamespace) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="select-scope"
          description={
            localeCode === 'zh_CN' ? '请选择集群和命名空间' : 'Select a cluster and namespace'
          }
        />
      </div>
    )
  }
  if (detailQuery.isLoading) return <Card loading className="soha-detail-card" />
  if (!ingress) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? 'Ingress 未找到' : 'Ingress not found'}
        />
      </div>
    )
  }

  return (
    <NetworkDetailShell
      activeTabKey={activeTabKey}
      detail={ingress}
      kind="ingresses"
      label="Ingress"
      onTabChange={setActiveTabKey}
      overviewExtra={[
        { key: 'IngressClass', value: ingress.className || '-' },
        { key: 'Hosts', value: renderNetworkTextList(ingress.hosts) },
        { key: 'Address', value: ingress.address || '-' },
        { key: 'Backend Services', value: renderNetworkTextList(ingress.backendServices) },
      ]}
      target={{ scope, name }}
    />
  )
}
