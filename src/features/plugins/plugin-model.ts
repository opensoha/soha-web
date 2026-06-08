import type {
  InstalledPlugin,
  MarketplacePlugin,
  PluginConfigRequest,
  PluginInstallRequest,
  PluginManifest,
  PluginPermissionRequest,
  PluginSecretRequirement,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'

export type {
  InstalledPlugin,
  MarketplacePlugin,
  PluginConfigRequest,
  PluginInstallRequest,
  PluginManifest,
  PluginPermissionRequest,
  PluginSecretRequirement,
}

export interface PluginMarketplaceFilters {
  publisher?: string
  query?: string
  type?: string
}

export const pluginQueryKeys = {
  marketplace: (filters: PluginMarketplaceFilters) => ['plugins', 'marketplace', filters] as const,
  marketplaceDetail: (pluginId?: string) => ['plugins', 'marketplace', pluginId] as const,
  installed: ['plugins', 'installed'] as const,
  installedDetail: (pluginId?: string) => ['plugins', 'installed', pluginId] as const,
  manifest: (pluginId?: string) => ['plugins', 'manifest', pluginId] as const,
}

export const pluginTypeOptions = [
  { value: 'skill', label: 'Skill' },
  { value: 'skill-pack', label: 'Skill Pack' },
  { value: 'mcp-preset', label: 'MCP Preset' },
  { value: 'connector', label: 'Connector' },
  { value: 'ai-provider-adapter', label: 'AI Provider' },
  { value: 'agent-profile', label: 'Agent Profile' },
  { value: 'gateway-policy-pack', label: 'Policy Pack' },
]

export const pluginRiskLabels: Record<string, string> = {
  read: '只读',
  write: '写入',
  execute: '执行',
  high: '高风险',
}

function queryString(filters: PluginMarketplaceFilters) {
  const params = new URLSearchParams()
  if (filters.query?.trim()) params.set('q', filters.query.trim())
  if (filters.type?.trim()) params.set('type', filters.type.trim())
  if (filters.publisher?.trim()) params.set('publisher', filters.publisher.trim())
  const suffix = params.toString()
  return suffix ? `?${suffix}` : ''
}

export function listMarketplacePlugins(filters: PluginMarketplaceFilters) {
  return api
    .get<ApiResponse<MarketplacePlugin[]>>(`/plugins/marketplace${queryString(filters)}`)
    .then((res) => res.data ?? [])
}

export function getMarketplacePlugin(pluginId: string) {
  return api
    .get<ApiResponse<MarketplacePlugin>>(`/plugins/marketplace/${encodeURIComponent(pluginId)}`)
    .then((res) => res.data)
}

export function listInstalledPlugins() {
  return api
    .get<ApiResponse<InstalledPlugin[]>>('/plugins/installed')
    .then((res) => res.data ?? [])
}

export function getInstalledPlugin(pluginId: string) {
  return api
    .get<ApiResponse<InstalledPlugin>>(`/plugins/${encodeURIComponent(pluginId)}`)
    .then((res) => res.data)
}

export function getInstalledPluginManifest(pluginId: string) {
  return api
    .get<ApiResponse<PluginManifest>>(`/plugins/${encodeURIComponent(pluginId)}/manifest`)
    .then((res) => res.data)
}

export function installPlugin(input: PluginInstallRequest) {
  return api
    .post<ApiResponse<InstalledPlugin>>('/plugins/install', input)
    .then((res) => res.data)
}

export function enablePlugin(pluginId: string) {
  return api
    .post<ApiResponse<InstalledPlugin>>(`/plugins/${encodeURIComponent(pluginId)}/enable`)
    .then((res) => res.data)
}

export function disablePlugin(pluginId: string) {
  return api
    .post<ApiResponse<InstalledPlugin>>(`/plugins/${encodeURIComponent(pluginId)}/disable`)
    .then((res) => res.data)
}

export function upgradePlugin(pluginId: string, input: PluginInstallRequest) {
  return api
    .post<ApiResponse<InstalledPlugin>>(`/plugins/${encodeURIComponent(pluginId)}/upgrade`, input)
    .then((res) => res.data)
}

export function configurePlugin(pluginId: string, input: PluginConfigRequest) {
  return api
    .put<ApiResponse<InstalledPlugin>>(`/plugins/${encodeURIComponent(pluginId)}/config`, input)
    .then((res) => res.data)
}

export function removePlugin(pluginId: string) {
  return api.delete<ApiResponse<{ status: string }>>(`/plugins/${encodeURIComponent(pluginId)}`)
}

export function pluginTypeLabel(type?: string) {
  const value = String(type ?? '').trim()
  return pluginTypeOptions.find((item) => item.value === value)?.label ?? (value || '-')
}

export function requestedPermissionValues(permissions?: PluginPermissionRequest | null) {
  return [
    ...(permissions?.required ?? []),
    ...(permissions?.domain ?? []),
  ].filter(Boolean)
}

export function requiredSecretValues(secrets?: { required?: PluginSecretRequirement[] } | null) {
  return (secrets?.required ?? []).filter((item) => item?.name)
}

export function manifestAssetCount(manifest?: PluginManifest | null) {
  const assets = manifest?.assets
  return [
    assets?.skills,
    assets?.mcpPresets,
    assets?.connectors,
    assets?.agentProfiles,
    assets?.gatewayPolicyPacks,
  ].reduce((total, values) => total + (values?.length ?? 0), 0)
}

export function manifestCapabilityCount(manifest?: PluginManifest | null) {
  const capabilities = manifest?.capabilities
  return [
    capabilities?.tools,
    capabilities?.resources,
    capabilities?.prompts,
    capabilities?.skills,
  ].reduce((total, values) => total + (values?.length ?? 0), 0)
}
