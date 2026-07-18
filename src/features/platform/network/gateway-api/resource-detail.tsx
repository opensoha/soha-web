import { useState } from 'react'
import type { ReactNode } from 'react'
import { Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { NetworkDetailShell } from '../shared/detail-shell'
import { resolveNetworkNamespace } from '../shared/scope'
import type { NetworkResourceRecord } from '../shared/types'
import { gatewayAPIQueries } from './queries'
import type { GatewayAPIKind } from './types'

export function GatewayAPIResourceDetail<T extends NetworkResourceRecord>({
  content,
  facts,
  kind,
  label,
}: {
  content?: (detail: T) => ReactNode
  facts?: (detail: T) => Array<{ key: string; value: ReactNode }>
  kind: GatewayAPIKind
  label: string
}) {
  const { localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const name = (useParams().name as string | undefined) ?? ''
  const [searchParams] = useSearchParams()
  const detailNamespace = resolveNetworkNamespace(namespace, searchParams.get('namespace'))
  const scope = toScopeKey(clusterId, detailNamespace)
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const query = useQuery(gatewayAPIQueries.detail<T>(kind, scope, name))
  const detail = query.data

  if (!clusterId || !detailNamespace)
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
  if (query.isLoading) return <Card loading className="soha-detail-card" />
  if (!detail)
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={`${label} ${localeCode === 'zh_CN' ? '未找到' : 'not found'}`}
        />
      </div>
    )

  return (
    <NetworkDetailShell
      activeTabKey={activeTabKey}
      detail={detail}
      kind={kind}
      label={label}
      onTabChange={setActiveTabKey}
      overviewContent={content?.(detail)}
      overviewExtra={facts?.(detail)}
      target={{ scope, name }}
    />
  )
}
