import { api } from '@/services/api-client'
import type { Namespace } from '@/types'
import { resourceCreationPaths } from './paths'
import type {
  ResourceCreateRequest,
  ResourceCreateResult,
  ResourceCreateScopeDecision,
  ResourceCreateScopeDecisionRequest,
  ResourcePreflight,
} from './types'

interface Envelope<T> {
  readonly data: T
}

function unwrap<T>(response: Envelope<T>) {
  return response.data
}

export async function decideResourceCreateScope(
  clusterId: string,
  request: ResourceCreateScopeDecisionRequest,
) {
  return unwrap(
    await api.post<Envelope<ResourceCreateScopeDecision>>(
      resourceCreationPaths.scopeDecision(clusterId),
      request,
    ),
  )
}

export async function preflightResourceCreate(clusterId: string, request: ResourceCreateRequest) {
  return unwrap(
    await api.post<Envelope<ResourcePreflight>>(
      resourceCreationPaths.preflight(clusterId),
      request,
    ),
  )
}

export async function executeResourceCreate(
  clusterId: string,
  request: ResourceCreateRequest,
  idempotencyKey: string,
) {
  return unwrap(
    await api.postWithHeaders<Envelope<ResourceCreateResult>>(
      resourceCreationPaths.execute(clusterId),
      request,
      { 'Idempotency-Key': idempotencyKey },
    ),
  )
}

export async function listAuthorizedNamespaces(clusterId: string) {
  const normalized = clusterId.trim()
  if (!normalized) return []
  return unwrap(
    await api.get<Envelope<Namespace[]>>(`/clusters/${encodeURIComponent(normalized)}/namespaces`),
  )
}
