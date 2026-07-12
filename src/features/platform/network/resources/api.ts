import type { ScopeKey } from '@/types'
import { listNetworkResources } from '../shared/api'
import type { NetworkCoreKind } from './types'

export function listNetworkCoreResources<T>(kind: NetworkCoreKind, scope: ScopeKey) {
  return listNetworkResources<T>(kind, scope)
}

export async function getNetworkCoreResource<T extends { name: string }>(
  kind: NetworkCoreKind,
  scope: ScopeKey,
  name: string,
) {
  const items = await listNetworkCoreResources<T>(kind, scope)
  return items.find((item) => item.name === name.trim())
}
