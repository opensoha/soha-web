import type {
  ComputeOverviewEnvelope,
  ComputeTaskCategory,
  ComputeTaskDomain,
  ComputeTaskEnvelope,
  ComputeTaskLogListEnvelope,
  ComputeTaskListEnvelope,
  ComputeTaskStatus,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { api } from '@/services/api-client'

interface ComputeTaskFilters {
  domain?: ComputeTaskDomain
  providerKey?: string
  status?: ComputeTaskStatus
  category?: ComputeTaskCategory
  resourceKind?: string
  resourceId?: string
  cursor?: string
  limit?: number
}

function queryString(filters: object) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const computeApi = {
  overview: () => api.getEnvelope<ComputeOverviewEnvelope>('/compute/overview'),
  tasks: (filters: ComputeTaskFilters = {}) =>
    api.getEnvelope<ComputeTaskListEnvelope>(`/compute/tasks${queryString(filters)}`),
  task: (domain: ComputeTaskDomain, taskId: string) =>
    api.getEnvelope<ComputeTaskEnvelope>(taskPath(domain, taskId)),
  taskLogs: (domain: ComputeTaskDomain, taskId: string) =>
    api.getEnvelope<ComputeTaskLogListEnvelope>(`${taskPath(domain, taskId)}/logs`),
  cancelTask: (domain: ComputeTaskDomain, taskId: string) =>
    api.post<ComputeTaskEnvelope>(`${taskPath(domain, taskId)}/cancel`),
  retryTask: (domain: ComputeTaskDomain, taskId: string) =>
    api.post<ComputeTaskEnvelope>(`${taskPath(domain, taskId)}/retry`),
}

function taskPath(domain: ComputeTaskDomain, taskId: string) {
  return `/compute/tasks/${encodeURIComponent(domain)}/${encodeURIComponent(taskId)}`
}

export type { ComputeTaskFilters }
