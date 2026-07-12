import { api } from '@/services/api-client'
import type { ApiResponse, BrandingSettings } from '@/types'
import type { LLMModelRoute, WorkbenchAgentRun, WorkbenchCatalog } from '@/features/copilot'
import type {
  AISettings,
  AISkillSetting,
  AIWorkbenchModelSettings,
  AnalysisProfile,
  AutomationPolicy,
  DataSource,
} from './ai-settings-model'
import type {
  DataSourceCapability,
  IdentitySettingsResponse,
  MonitoringSettingsResponse,
  PrometheusSettings,
  SaveIdentitySettingsInput,
} from './types'

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request
  return response.data
}

export interface UpsertSettingsRecordInput {
  id?: string
  values: Record<string, unknown>
}

export const settingsApi = {
  branding: {
    get: () => unwrap(api.get<ApiResponse<BrandingSettings>>('/settings/branding')),
    save: (values: BrandingSettings) => api.put<void>('/settings/branding', values),
    upload: (formData: FormData) =>
      unwrap(api.upload<ApiResponse<{ url: string }>>('/settings/branding/upload', formData)),
  },
  identity: {
    get: () => unwrap(api.get<ApiResponse<IdentitySettingsResponse>>('/settings/identity')),
    save: (input: SaveIdentitySettingsInput) =>
      api.put<void>('/settings/identity/providers', input.values),
  },
  monitoring: {
    get: () => unwrap(api.get<ApiResponse<MonitoringSettingsResponse>>('/settings/monitoring')),
    savePrometheus: (values: PrometheusSettings) =>
      api.put<void>('/settings/monitoring/prometheus', values),
  },
  ai: {
    get: () => unwrap(api.get<ApiResponse<AISettings>>('/settings/ai')),
    modelRoutes: () =>
      unwrap(
        api.get<ApiResponse<LLMModelRoute[]>>(
          '/ai-gateway/relay/model-routes?includeDisabled=true',
        ),
      ),
    dataSources: () => unwrap(api.get<ApiResponse<DataSource[]>>('/copilot/data-sources')),
    analysisProfiles: () =>
      unwrap(api.get<ApiResponse<AnalysisProfile[]>>('/copilot/analysis-profiles')),
    automationPolicies: () =>
      unwrap(api.get<ApiResponse<AutomationPolicy[]>>('/copilot/automation-policies')),
    dataSourceCapabilities: () =>
      unwrap(api.get<ApiResponse<DataSourceCapability[]>>('/copilot/data-source-capabilities')),
    workbenchCatalog: () =>
      unwrap(api.get<ApiResponse<WorkbenchCatalog>>('/copilot/workbench/catalog')),
    agentRuns: () => unwrap(api.get<ApiResponse<WorkbenchAgentRun[]>>('/copilot/agent-runs')),
    saveWorkbenchModel: (workbenchModel: AIWorkbenchModelSettings) =>
      api.put<void>('/settings/ai/workbench-model', { workbenchModel }),
    saveSkills: (skillsRegistry: AISkillSetting[]) =>
      api.put<void>('/settings/ai/skills', { skillsRegistry }),
    upsertDataSource: ({ id, values }: UpsertSettingsRecordInput) =>
      id
        ? api.put<void>(`/copilot/data-sources/${encodeURIComponent(id)}`, values)
        : api.post<void>('/copilot/data-sources', values),
    validateDataSource: (id: string) =>
      unwrap(
        api.post<ApiResponse<DataSource>>(
          `/copilot/data-sources/${encodeURIComponent(id)}/validate`,
        ),
      ),
    upsertAnalysisProfile: ({ id, values }: UpsertSettingsRecordInput) =>
      id
        ? api.put<void>(`/copilot/analysis-profiles/${encodeURIComponent(id)}`, values)
        : api.post<void>('/copilot/analysis-profiles', values),
    upsertAutomationPolicy: ({ id, values }: UpsertSettingsRecordInput) =>
      id
        ? api.put<void>(`/copilot/automation-policies/${encodeURIComponent(id)}`, values)
        : api.post<void>('/copilot/automation-policies', values),
  },
}
