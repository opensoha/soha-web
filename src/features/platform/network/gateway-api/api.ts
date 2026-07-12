import type { ScopeKey } from '@/types'
import { listNetworkResources } from '../shared/api'
import type { GatewayAPIKind } from './types'

export function listGatewayAPIResources<T>(kind: GatewayAPIKind, scope: ScopeKey) {
  return listNetworkResources<T>(kind, scope)
}

export async function getGatewayAPIResource<T extends { name: string }>(
  kind: Extract<GatewayAPIKind, 'gatewayclasses' | 'gateways'>,
  scope: ScopeKey,
  name: string,
) {
  const items = await listGatewayAPIResources<T>(kind, scope)
  return items.find((item) => item.name === name.trim())
}
