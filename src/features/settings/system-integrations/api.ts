import type {
  SystemIntegrationEnvelope,
  SystemIntegrationListEnvelope,
  SystemIntegrationTestResultEnvelope,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { api } from '@/services/api-client'
import type {
  SystemIntegrationCreateRequest,
  SystemIntegrationFilters,
  UpdateSystemIntegrationInput,
} from './types'

function listPath(filters: SystemIntegrationFilters = {}) {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.providerType) params.set('providerType', filters.providerType)
  if (filters.enabled !== undefined) params.set('enabled', String(filters.enabled))
  const query = params.toString()
  return query ? `/system-integrations?${query}` : '/system-integrations'
}

export const systemIntegrationsApi = {
  list: async (filters: SystemIntegrationFilters = {}) =>
    (await api.getEnvelope<SystemIntegrationListEnvelope>(listPath(filters))).items,
  get: async (id: string) =>
    (await api.get<SystemIntegrationEnvelope>(`/system-integrations/${encodeURIComponent(id)}`))
      .data,
  create: async (values: SystemIntegrationCreateRequest) =>
    (await api.post<SystemIntegrationEnvelope>('/system-integrations', values)).data,
  update: async ({ id, values }: UpdateSystemIntegrationInput) =>
    (
      await api.patch<SystemIntegrationEnvelope>(
        `/system-integrations/${encodeURIComponent(id)}`,
        values,
      )
    ).data,
  remove: (id: string) => api.delete<void>(`/system-integrations/${encodeURIComponent(id)}`),
  test: async (id: string) =>
    (
      await api.post<SystemIntegrationTestResultEnvelope>(
        `/system-integrations/${encodeURIComponent(id)}/test`,
      )
    ).data,
}
