import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api-client'
import type { ApiResponse, WorkbenchModuleStatus } from '@/types'

export const moduleStatusQueryKey = ['modules'] as const

type ModuleStatusMap = Record<string, { enabled?: boolean } | boolean | undefined>

type ModuleStatusEnvelope =
  | ApiResponse<WorkbenchModuleStatus[]>
  | WorkbenchModuleStatus[]
  | {
    data?: WorkbenchModuleStatus[] | { modules?: ModuleStatusMap }
    items?: WorkbenchModuleStatus[]
    modules?: ModuleStatusMap
  }

function moduleItems(response: ModuleStatusEnvelope | undefined): WorkbenchModuleStatus[] {
  if (!response) return []
  if (Array.isArray(response)) return response
  if (Array.isArray(response.data)) return response.data
  if ('items' in response && Array.isArray(response.items)) return response.items
  return []
}

function moduleMap(response: ModuleStatusEnvelope | undefined): ModuleStatusMap | undefined {
  if (!response || Array.isArray(response)) return undefined
  if ('modules' in response && response.modules) return response.modules
  if (response.data && !Array.isArray(response.data) && response.data.modules) {
    return response.data.modules
  }
  return undefined
}

export function getWorkbenchModuleEnabled(response: ModuleStatusEnvelope | undefined, moduleId: string) {
  const mapped = moduleMap(response)?.[moduleId]
  if (typeof mapped === 'boolean') return mapped
  if (mapped && typeof mapped === 'object' && typeof mapped.enabled === 'boolean') return mapped.enabled

  const item = moduleItems(response).find((status) => status.descriptor.id === moduleId)
  return item?.enabled === true
}

export function useModuleStatuses() {
  return useQuery({
    queryKey: moduleStatusQueryKey,
    queryFn: () => api.get<ModuleStatusEnvelope>('/modules'),
    staleTime: 30_000,
  })
}

export function useWorkbenchModuleEnabled(moduleId: string) {
  const query = useModuleStatuses()
  return {
    ...query,
    moduleEnabled: getWorkbenchModuleEnabled(query.data, moduleId),
  }
}
