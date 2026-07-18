import { buildClusterScopedPath } from '@/features/platform/platform-scope-query'
import type { ScopeKey } from '@/types'
import { normalizeNetworkScope, requireNetworkClusterId } from './scope'
import type { NetworkKind } from './types'

function normalizeName(name: string) {
  const normalized = name.trim()
  if (!normalized) throw new Error('A network resource name is required')
  return normalized
}

function networkPath(
  kind: NetworkKind,
  scope: ScopeKey,
  suffix = '',
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  const normalizedScope = normalizeNetworkScope(scope)
  return buildClusterScopedPath(
    requireNetworkClusterId(normalizedScope),
    `network/${kind}${suffix}`,
    normalizedScope.namespace,
    params,
  )
}

export function buildNetworkListPath(kind: NetworkKind, scope: ScopeKey) {
  return networkPath(kind, scope)
}

export function buildNetworkItemPath(kind: NetworkKind, scope: ScopeKey, name: string) {
  return networkPath(kind, scope, `/${encodeURIComponent(normalizeName(name))}`)
}

export function buildNetworkDetailPath(kind: NetworkKind, scope: ScopeKey, name: string) {
  return networkPath(kind, scope, `/${encodeURIComponent(normalizeName(name))}/detail`)
}

export function buildNetworkYAMLPath(kind: NetworkKind, scope: ScopeKey, name: string) {
  return networkPath(kind, scope, `/${encodeURIComponent(normalizeName(name))}/yaml`)
}

export function buildNetworkRoutePath(kind: NetworkKind, name: string, namespace: string) {
  const search = new URLSearchParams()
  if (namespace.trim()) search.set('namespace', namespace.trim())
  const query = search.toString()
  return `/network/${kind}/${encodeURIComponent(normalizeName(name))}${query ? `?${query}` : ''}`
}

export function buildGatewayAPIRoutePath(kind: NetworkKind, name: string, namespace = '') {
  const path = buildNetworkRoutePath(kind, name, namespace)
  return path.replace(`/network/${kind}/`, `/network/gateway-api/${kind}/`)
}

export function buildServiceMetricsPath(scope: ScopeKey, name: string) {
  return networkPath('services', scope, `/${encodeURIComponent(normalizeName(name))}/metrics`)
}

export function buildNetworkEventsPath(scope: ScopeKey, limit = 100) {
  const normalizedScope = normalizeNetworkScope(scope)
  return buildClusterScopedPath(
    requireNetworkClusterId(normalizedScope),
    'events',
    normalizedScope.namespace,
    { limit },
  )
}

export function buildNetworkPodsPath(scope: ScopeKey) {
  const normalizedScope = normalizeNetworkScope(scope)
  return buildClusterScopedPath(
    requireNetworkClusterId(normalizedScope),
    'workloads/pods',
    normalizedScope.namespace,
  )
}
