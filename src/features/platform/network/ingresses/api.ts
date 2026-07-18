import type { ScopeKey } from '@/types'
import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import { listNetworkResources } from '../shared/api'
import { buildNetworkDetailPath } from '../shared/paths'
import type { Ingress } from './types'

export function listIngresses(scope: ScopeKey) {
  return listNetworkResources<Ingress>('ingresses', scope)
}

export async function getIngress(scope: ScopeKey, name: string) {
  const response = await api.get<ApiResponse<Ingress>>(
    buildNetworkDetailPath('ingresses', scope, name),
  )
  return response.data
}
