import { api } from '@/services/api-client'
import type { ApiResponse, ResourceMetrics, ScopeKey } from '@/types'
import {
  buildNetworkEventsPath,
  buildNetworkPodsPath,
  buildServiceMetricsPath,
} from '../shared/paths'
import { listNetworkResources } from '../shared/api'
import type { Service, ServiceBackendPod, ServiceEvent } from './types'

function selectorMatchesLabels(selector?: Record<string, string>, labels?: Record<string, string>) {
  const entries = Object.entries(selector ?? {})
  if (entries.length === 0) return false
  return entries.every(([key, value]) => (labels ?? {})[key] === value)
}

export function listServices(scope: ScopeKey) {
  return listNetworkResources<Service>('services', scope)
}

export async function getService(scope: ScopeKey, name: string) {
  const services = await listServices(scope)
  return services.find((service) => service.name === name.trim())
}

export async function listServiceBackendPods(
  scope: ScopeKey,
  selector?: Record<string, string>,
): Promise<ServiceBackendPod[]> {
  const response = await api.get<ApiResponse<ServiceBackendPod[]>>(buildNetworkPodsPath(scope))
  return (response.data ?? []).filter((pod) => selectorMatchesLabels(selector, pod.labels))
}

export async function getServiceMetrics(scope: ScopeKey, name: string): Promise<ResourceMetrics> {
  const response = await api.get<ApiResponse<ResourceMetrics>>(buildServiceMetricsPath(scope, name))
  return response.data
}

export async function listServiceEvents(
  scope: ScopeKey,
  name: string,
  limit = 100,
): Promise<ServiceEvent[]> {
  const response = await api.get<ApiResponse<ServiceEvent[]>>(buildNetworkEventsPath(scope, limit))
  const normalizedName = name.trim()
  return (response.data ?? []).filter(
    (event) =>
      event.involvedName === normalizedName &&
      (!event.involvedKind || event.involvedKind.toLowerCase() === 'service'),
  )
}
