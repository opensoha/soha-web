import { queryOptions } from '@tanstack/react-query'
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
}
