import { queryOptions } from '@tanstack/react-query'
import type {
  ComputeDomain,
  ComputeProviderDomain,
  ComputeResourceKind,
  ComputeTaskDomain,
} from '@opensoha/contracts/gen/ts/sohaapi'
import {
  computeApi,
  type ComputeProviderInstanceFilters,
  type ComputeTaskFilters,
} from './api'
import { computeKeys } from './keys'

export const computeQueries = {
  overview: (enabled = true) =>
    queryOptions({
      queryKey: computeKeys.overview(),
      queryFn: computeApi.overview,
      enabled,
      staleTime: 15_000,
      refetchInterval: 15_000,
    }),
  providerInstances: (filters: ComputeProviderInstanceFilters = {}, enabled = true) =>
    queryOptions({
      queryKey: computeKeys.providerInstances(filters),
      queryFn: () => computeApi.providerInstances(filters),
      enabled,
      staleTime: 15_000,
      refetchInterval: 30_000,
    }),
  providerInstance: (
    domain: ComputeProviderDomain,
    providerKey: string,
    instanceRef: string,
    enabled = true,
  ) =>
    queryOptions({
      queryKey: computeKeys.providerInstance(domain, providerKey, instanceRef),
      queryFn: () => computeApi.providerInstance(domain, providerKey, instanceRef),
      select: (response) => response.data,
      enabled: enabled && Boolean(providerKey.trim()) && Boolean(instanceRef.trim()),
    }),
  resourceRelations: (
    domain: ComputeDomain,
    kind: ComputeResourceKind,
    id: string,
    enabled = true,
  ) =>
    queryOptions({
      queryKey: computeKeys.resourceRelations(domain, kind, id),
      queryFn: () => computeApi.resourceRelations(domain, kind, id),
      select: (response) => response.data,
      enabled: enabled && Boolean(id.trim()),
    }),
  tasks: (filters: ComputeTaskFilters = {}) =>
    queryOptions({
      queryKey: computeKeys.tasks(filters),
      queryFn: () => computeApi.tasks(filters),
      refetchInterval: 10_000,
    }),
  task: (domain: ComputeTaskDomain, taskId: string) =>
    queryOptions({
      queryKey: computeKeys.task(domain, taskId),
      queryFn: () => computeApi.task(domain, taskId),
      select: (response) => response.data,
      enabled: Boolean(taskId),
      refetchInterval: 15_000,
    }),
  taskLogs: (domain: ComputeTaskDomain, taskId: string) =>
    queryOptions({
      queryKey: computeKeys.taskLogs(domain, taskId),
      queryFn: () => computeApi.taskLogs(domain, taskId),
      select: (response) => response.items,
      enabled: Boolean(taskId),
      refetchInterval: 15_000,
    }),
}
