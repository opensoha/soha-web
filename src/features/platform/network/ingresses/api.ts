import type { ScopeKey } from '@/types'
import { listNetworkResources } from '../shared/api'
import type { Ingress } from './types'

export function listIngresses(scope: ScopeKey) {
  return listNetworkResources<Ingress>('ingresses', scope)
}

export async function getIngress(scope: ScopeKey, name: string) {
  const ingresses = await listIngresses(scope)
  return ingresses.find((ingress) => ingress.name === name.trim())
}
