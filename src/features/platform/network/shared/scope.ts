import { toScopeKey, type ScopeKey } from '@/types'
import type { NetworkResourceRecord, NetworkTarget } from './types'

export function normalizeNetworkScope(scope: ScopeKey): ScopeKey {
  return toScopeKey(scope.clusterId, scope.namespace)
}

export function hasNetworkCluster(scope: ScopeKey) {
  return Boolean(normalizeNetworkScope(scope).clusterId)
}

export function hasNamespacedNetworkScope(scope: ScopeKey) {
  const normalized = normalizeNetworkScope(scope)
  return Boolean(normalized.clusterId && normalized.namespace)
}

export function requireNetworkClusterId(scope: ScopeKey) {
  const clusterId = normalizeNetworkScope(scope).clusterId
  if (!clusterId) throw new Error('A cluster is required for network requests')
  return clusterId
}

export function requireNetworkNamespace(scope: ScopeKey) {
  const namespace = normalizeNetworkScope(scope).namespace
  if (!namespace) throw new Error('A namespace is required for this network request')
  return namespace
}

export function resolveNetworkNamespace(
  selectedNamespace: string | null | undefined,
  searchNamespace: string | null | undefined,
  recordNamespace?: string | null,
) {
  return selectedNamespace?.trim() || searchNamespace?.trim() || recordNamespace?.trim() || ''
}

export function networkTargetFromRecord(
  clusterId: string | null | undefined,
  record: Pick<NetworkResourceRecord, 'name' | 'namespace'>,
): NetworkTarget {
  return { scope: toScopeKey(clusterId, record.namespace), name: record.name }
}
