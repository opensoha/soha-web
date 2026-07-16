import { queryOptions } from '@tanstack/react-query'
import type { ComputeTaskDomain } from '@opensoha/contracts/gen/ts/sohaapi'
import { computeApi, type ComputeAccessFilters, type ComputeTaskFilters } from './api'
import { computeKeys } from './keys'

export const computeQueries = {
  overview: () =>
    queryOptions({
      queryKey: computeKeys.overview(),
      queryFn: computeApi.overview,
      staleTime: 15_000,
    }),
  accessSources: (filters: ComputeAccessFilters = {}) =>
    queryOptions({
      queryKey: computeKeys.accessSources(filters),
      queryFn: () => computeApi.accessSources(filters),
      staleTime: 15_000,
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
      refetchInterval: 5_000,
    }),
  taskLogs: (domain: ComputeTaskDomain, taskId: string) =>
    queryOptions({
      queryKey: computeKeys.taskLogs(domain, taskId),
      queryFn: () => computeApi.taskLogs(domain, taskId),
      select: (response) => response.items,
      enabled: Boolean(taskId),
      refetchInterval: 5_000,
    }),
}
