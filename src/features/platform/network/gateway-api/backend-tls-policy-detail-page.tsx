import { renderNetworkTextList } from '../shared/renderers'
import { ConditionsSection } from './detail-sections'
import { GatewayAPIResourceDetail } from './resource-detail'
import type { BackendTLSPolicyDetail } from './types'

export function BackendTLSPolicyDetailPage() {
  return (
    <GatewayAPIResourceDetail<BackendTLSPolicyDetail>
      kind="backendtlspolicies"
      label="BackendTLSPolicy"
      facts={(detail) => [
        { key: 'Targets', value: renderNetworkTextList(detail.targetRefs) },
        { key: 'Hostname', value: detail.hostname || '-' },
        { key: 'CA Refs', value: renderNetworkTextList(detail.caCertificateRefs) },
        { key: 'Well-known CA', value: detail.wellKnownCACertificates || '-' },
      ]}
      content={(detail) => <ConditionsSection conditions={detail.conditions} />}
    />
  )
}
