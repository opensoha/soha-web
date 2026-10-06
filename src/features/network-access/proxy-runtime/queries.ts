import { queryOptions } from '@tanstack/react-query'
import type { InstanceFilters } from './api'
import { getConnections, getTraffic, listInstances } from './api'

export const proxyKeys = {
  all: ['network-access', 'proxy-instances'] as const,
  list: (filters: InstanceFilters) =>
    [...proxyKeys.all, 'list', filters.search?.trim() ?? '', filters.engine ?? ''] as const,
  traffic: (id: string) => [...proxyKeys.all, id, 'traffic'] as const,
  connections: (id: string) => [...proxyKeys.all, id, 'connections'] as const,
}

export const proxyQueries = {
  instances: (filters: InstanceFilters = {}, enabled = true) =>
    queryOptions({
      queryKey: proxyKeys.list(filters),
      queryFn: () => listInstances(filters),
      enabled,
      refetchInterval: 15_000,
      retry: false,
    }),
  traffic: (id: string | undefined, enabled = true) =>
    queryOptions({
      queryKey: proxyKeys.traffic(id ?? ''),
      queryFn: () => getTraffic(id!),
      enabled: enabled && Boolean(id),
      refetchInterval: 15_000,
      retry: false,
    }),
  connections: (id: string | undefined, enabled = true) =>
    queryOptions({
      queryKey: proxyKeys.connections(id ?? ''),
      queryFn: () => getConnections(id!),
      enabled: enabled && Boolean(id),
      refetchInterval: 10_000,
      retry: false,
    }),
}
