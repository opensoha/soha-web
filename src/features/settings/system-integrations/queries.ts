import { queryOptions } from '@tanstack/react-query'
import { systemIntegrationsApi } from './api'
import { systemIntegrationKeys } from './keys'
import type { SystemIntegrationFilters } from './types'

export const systemIntegrationQueries = {
  list: (filters: SystemIntegrationFilters = {}, enabled = true) =>
    queryOptions({
      queryKey: systemIntegrationKeys.list(filters),
      queryFn: () => systemIntegrationsApi.list(filters),
      enabled,
    }),
  detail: (id: string, enabled = true) =>
    queryOptions({
      queryKey: systemIntegrationKeys.detail(id),
      queryFn: () => systemIntegrationsApi.get(id),
      enabled: enabled && Boolean(id.trim()),
    }),
}
