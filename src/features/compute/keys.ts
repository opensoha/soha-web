import type { ComputeAccessFilters, ComputeTaskFilters } from './api'
import type { ComputeTaskDomain } from '@opensoha/contracts/gen/ts/sohaapi'

export const computeKeys = {
  all: ['compute'] as const,
  overview: () => [...computeKeys.all, 'overview'] as const,
  accessSources: (filters: ComputeAccessFilters = {}) =>
    [...computeKeys.all, 'access-sources', filters] as const,
  tasks: (filters: ComputeTaskFilters = {}) => [...computeKeys.all, 'tasks', filters] as const,
  task: (domain: ComputeTaskDomain, taskId: string) =>
    [...computeKeys.all, 'tasks', domain, taskId] as const,
  taskLogs: (domain: ComputeTaskDomain, taskId: string) =>
    [...computeKeys.task(domain, taskId), 'logs'] as const,
}

export const computeMutationKeys = {
  task: (action: 'cancel' | 'retry') => [...computeKeys.all, 'mutation', 'task', action] as const,
}
