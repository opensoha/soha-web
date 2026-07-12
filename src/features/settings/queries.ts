import { queryOptions } from '@tanstack/react-query'
import { settingsApi } from './api'
import { settingsKeys } from './keys'
import { normalizeLoginProvider } from './identity/model'
import type { AISettings, AIWorkbenchModelSettings } from './ai-settings-model'

function normalizeWorkbenchModelSettings(
  item?: Partial<AIWorkbenchModelSettings> | null,
): AIWorkbenchModelSettings {
  return {
    defaultPublicModel: String(item?.defaultPublicModel || ''),
    defaultRouteId: String(item?.defaultRouteId || ''),
    defaultEndpoint: String(item?.defaultEndpoint || 'chat/completions'),
    enabled: item?.enabled ?? true,
  }
}

export const settingsQueries = {
  branding: (enabled = true) =>
    queryOptions({
      queryKey: settingsKeys.branding.detail(),
      queryFn: settingsApi.branding.get,
      enabled,
    }),
  identity: () =>
    queryOptions({
      queryKey: settingsKeys.identity.detail(),
      queryFn: async () => {
        const current = await settingsApi.identity.get()
        const providers = Array.isArray(current.providers)
          ? current.providers.map(normalizeLoginProvider)
          : []
        return {
          providers,
          defaultProviderId: current.defaultProviderId || providers[0]?.id || '',
          localPasswordLoginEnabled: current.localPasswordLoginEnabled ?? true,
        }
      },
    }),
  monitoring: () =>
    queryOptions({
      queryKey: settingsKeys.monitoring.detail(),
      queryFn: async () => (await settingsApi.monitoring.get()).prometheus,
    }),
  ai: {
    detail: () =>
      queryOptions({
        queryKey: settingsKeys.ai.detail(),
        queryFn: async () => {
          const current = await settingsApi.ai.get()
          return {
            workbenchModel: normalizeWorkbenchModelSettings(current.workbenchModel),
            skillsRegistry: current.skillsRegistry ?? [],
          } satisfies AISettings
        },
      }),
    modelRoutes: (enabled: boolean) =>
      queryOptions({
        queryKey: settingsKeys.ai.modelRoutes(),
        queryFn: settingsApi.ai.modelRoutes,
        enabled,
      }),
    dataSources: () =>
      queryOptions({
        queryKey: settingsKeys.ai.dataSources(),
        queryFn: settingsApi.ai.dataSources,
      }),
    analysisProfiles: () =>
      queryOptions({
        queryKey: settingsKeys.ai.analysisProfiles(),
        queryFn: settingsApi.ai.analysisProfiles,
      }),
    automationPolicies: () =>
      queryOptions({
        queryKey: settingsKeys.ai.automationPolicies(),
        queryFn: settingsApi.ai.automationPolicies,
      }),
    dataSourceCapabilities: () =>
      queryOptions({
        queryKey: settingsKeys.ai.dataSourceCapabilities(),
        queryFn: settingsApi.ai.dataSourceCapabilities,
      }),
    workbenchCatalog: (enabled: boolean) =>
      queryOptions({
        queryKey: settingsKeys.ai.workbenchCatalog(),
        queryFn: settingsApi.ai.workbenchCatalog,
        enabled,
      }),
    agentRuns: (enabled: boolean) =>
      queryOptions({
        queryKey: settingsKeys.ai.agentRuns(),
        queryFn: settingsApi.ai.agentRuns,
        enabled,
      }),
  },
}

export { normalizeWorkbenchModelSettings }
