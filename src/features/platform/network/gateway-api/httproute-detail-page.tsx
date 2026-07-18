import { renderNetworkTextList } from '../shared/renderers'
import { ConditionsSection, ParentStatusesSection, RouteRulesSection } from './detail-sections'
import { GatewayAPIResourceDetail } from './resource-detail'
import type { HTTPRouteDetail } from './types'

export function HTTPRouteDetailPage() {
  return (
    <GatewayAPIResourceDetail<HTTPRouteDetail>
      kind="httproutes"
      label="HTTPRoute"
      facts={(detail) => [
        { key: 'Hostnames', value: renderNetworkTextList(detail.hostnames) },
        { key: 'Parents', value: renderNetworkTextList(detail.parentRefs) },
        { key: 'Backends', value: renderNetworkTextList(detail.backendServices) },
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
