import { renderNetworkTextList } from '../shared/renderers'
import { ConditionsSection, ParentStatusesSection, RouteRulesSection } from './detail-sections'
import { GatewayAPIResourceDetail } from './resource-detail'
import type { GRPCRouteDetail } from './types'

export function GRPCRouteDetailPage() {
  return (
    <GatewayAPIResourceDetail<GRPCRouteDetail>
      kind="grpcroutes"
      label="GRPCRoute"
      facts={(detail) => [
        { key: 'Hostnames', value: renderNetworkTextList(detail.hostnames) },
        { key: 'Parents', value: renderNetworkTextList(detail.parentRefs) },
        { key: 'Backends', value: renderNetworkTextList(detail.backendServices) },
        { key: 'Rules', value: detail.ruleCount },
      ]}
      content={(detail) => (
        <>
          <RouteRulesSection rules={detail.rules} />
          <ParentStatusesSection statuses={detail.parentStatuses} />
          <ConditionsSection conditions={detail.conditions} />
        </>
      )}
    />
  )
}
