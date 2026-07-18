import { useState } from 'react'
import { Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { NetworkDetailShell } from '../shared/detail-shell'
import { ConditionsSection, GatewaysSection } from './detail-sections'
import { gatewayAPIQueries } from './queries'
import type { GatewayClassDetail } from './types'

export function GatewayClassDetailPage() {
  const { localeCode } = useI18n()
  const { clusterId } = usePlatformScopeStore()
  const name = (useParams().name as string | undefined) ?? ''
  const scope = toScopeKey(clusterId, null)
  const [activeTabKey, setActiveTabKey] = useState('overview')
  const query = useQuery(
    gatewayAPIQueries.detail<GatewayClassDetail>('gatewayclasses', scope, name, true),
  )
  const detail = query.data

  if (!clusterId)
    return (
      <div className="soha-page">
        <ManagementState
          kind="select-scope"
          description={localeCode === 'zh_CN' ? '请选择集群' : 'Select a cluster'}
        />
      </div>
    )
  if (query.isLoading) return <Card loading className="soha-detail-card" />
  if (!detail)
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? 'GatewayClass 未找到' : 'GatewayClass not found'}
        />
      </div>
    )

  return (
    <NetworkDetailShell
      activeTabKey={activeTabKey}
      clusterScoped
      detail={detail}
      kind="gatewayclasses"
      label="GatewayClass"
      onTabChange={setActiveTabKey}
      overviewExtra={[
        { key: 'Controller', value: detail.controllerName || '-' },
        { key: 'Accepted', value: detail.accepted ? <StatusTag value={detail.accepted} /> : '-' },
        { key: 'Parameters', value: detail.parametersRef || '-' },
      ]}
      overviewContent={
        <>
          <GatewaysSection gateways={detail.gateways} />
          <ConditionsSection conditions={detail.conditions} />
        </>
      }
      target={{ scope, name }}
    />
  )
}
