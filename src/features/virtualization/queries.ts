import { queryOptions } from '@tanstack/react-query'
import { virtualizationApi } from './virtualization-api'
import {
  normalizeVirtualizationListParams,
  normalizeVirtualizationOperationParams,
  normalizeVirtualizationVMMetricsParams,
  virtualizationKeys,
  type VirtualizationVMMetricsQueryParams,
} from './keys'
import type {
  VirtualizationListParams,
  VirtualizationOperationListParams,
} from './virtualization-types'

function hasId(id: string) {
  return Boolean(id.trim())
}

export const virtualizationQueries = {
  vms: (params: VirtualizationListParams = {}, enabled = true) => {
    const normalized = normalizeVirtualizationListParams(params)
    return queryOptions({
      queryKey: virtualizationKeys.vmList(normalized),
      queryFn: () => virtualizationApi.vms(normalized),
      enabled,
    })
  },
  vmDetail: (id: string, enabled = true) => {
    const vmId = id.trim()
    return queryOptions({
      queryKey: virtualizationKeys.vmDetail(vmId),
      queryFn: () => virtualizationApi.vmDetail(vmId),
      enabled: enabled && hasId(vmId),
    })
  },
  vmMetrics: (id: string, params: VirtualizationVMMetricsQueryParams = {}, enabled = true) => {
    const vmId = id.trim()
    const normalized = normalizeVirtualizationVMMetricsParams(params)
    return queryOptions({
      queryKey: virtualizationKeys.vmMetrics(vmId, normalized),
      queryFn: () =>
        virtualizationApi.vmMetrics(vmId, normalized.rangeMinutes, normalized.stepSeconds),
      enabled: enabled && hasId(vmId),
      refetchInterval: 30_000,
    })
  },
  vmConsole: (id: string, enabled = true) => {
    const vmId = id.trim()
    return queryOptions({
      queryKey: virtualizationKeys.vmConsole(vmId),
      queryFn: () => virtualizationApi.vmConsoleURL(vmId),
      enabled: enabled && hasId(vmId),
    })
  },
  clusters: (enabled = true) =>
    queryOptions({
      queryKey: virtualizationKeys.clusterList(),
      queryFn: virtualizationApi.clusters,
      enabled,
    }),
  platformClusterOptions: (enabled = true) =>
    queryOptions({
      queryKey: virtualizationKeys.platformClusterOptions(),
      queryFn: virtualizationApi.platformClusters,
      enabled,
    }),
  images: (params: VirtualizationListParams = {}, enabled = true) => {
    const normalized = normalizeVirtualizationListParams(params)
    return queryOptions({
      queryKey: virtualizationKeys.imageList(normalized),
      queryFn: () => virtualizationApi.images(normalized),
      enabled,
    })
  },
  imageOptions: (enabled = true) =>
    queryOptions({
      queryKey: virtualizationKeys.imageOptions(),
      queryFn: () => virtualizationApi.images(),
      enabled,
    }),
  flavors: (enabled = true) =>
    queryOptions({
      queryKey: virtualizationKeys.flavorList(),
      queryFn: virtualizationApi.flavors,
      enabled,
    }),
  operations: (params: VirtualizationOperationListParams = {}, enabled = true) => {
    const normalized = normalizeVirtualizationOperationParams(params)
    return queryOptions({
      queryKey: virtualizationKeys.operationList(normalized),
      queryFn: () => virtualizationApi.operations(normalized),
      enabled,
    })
  },
  operationLogs: (id: string, enabled = true) => {
    const operationId = id.trim()
    return queryOptions({
      queryKey: virtualizationKeys.operationLogs(operationId),
      queryFn: () => virtualizationApi.operationLogs(operationId),
      enabled: enabled && hasId(operationId),
    })
  },
}
