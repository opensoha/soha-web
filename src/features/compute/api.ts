import type {
  ComputeAccessSourceListEnvelope,
  ComputeAccessSourceType,
  ComputeOverviewEnvelope,
  ComputeTaskCategory,
  ComputeTaskDomain,
  ComputeTaskListEnvelope,
  ComputeTaskStatus,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { api } from '@/services/api-client'

interface ComputeAccessFilters {
  sourceType?: ComputeAccessSourceType
  providerKey?: string
  cursor?: string
  limit?: number
}

interface ComputeTaskFilters {
  domain?: ComputeTaskDomain
  providerKey?: string
  status?: ComputeTaskStatus
  category?: ComputeTaskCategory
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
  accessSources: (filters: ComputeAccessFilters = {}) =>
    api.getEnvelope<ComputeAccessSourceListEnvelope>(
      `/compute/access-sources${queryString(filters)}`,
    ),
  tasks: (filters: ComputeTaskFilters = {}) =>
    api.getEnvelope<ComputeTaskListEnvelope>(`/compute/tasks${queryString(filters)}`),
}

export type { ComputeAccessFilters, ComputeTaskFilters }
