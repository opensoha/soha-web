import { renderNetworkTextList } from '../shared/renderers'
import { ReferenceGrantRefsSection } from './detail-sections'
import { GatewayAPIResourceDetail } from './resource-detail'
import type { ReferenceGrantDetail } from './types'

export function ReferenceGrantDetailPage() {
  return (
    <GatewayAPIResourceDetail<ReferenceGrantDetail>
      kind="referencegrants"
      label="ReferenceGrant"
      facts={(detail) => [
        { key: 'From', value: renderNetworkTextList(detail.from) },
        { key: 'To', value: renderNetworkTextList(detail.to) },
      ]}
      content={(detail) => <ReferenceGrantRefsSection from={detail.fromRefs} to={detail.toRefs} />}
    />
  )
}
