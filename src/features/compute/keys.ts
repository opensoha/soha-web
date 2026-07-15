import type { ComputeAccessFilters, ComputeTaskFilters } from './api'

export const computeKeys = {
  all: ['compute'] as const,
  overview: () => [...computeKeys.all, 'overview'] as const,
  accessSources: (filters: ComputeAccessFilters = {}) =>
    [...computeKeys.all, 'access-sources', filters] as const,
  tasks: (filters: ComputeTaskFilters = {}) => [...computeKeys.all, 'tasks', filters] as const,
}
