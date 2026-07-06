import type {
  InstalledPlugin,
  MarketplacePlugin,
  MarketplacePluginVersion,
  PluginConfigRequest,
  PluginExtensionPoints,
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
  MarketplacePluginVersion,
  PluginExtensionPoints,
}

export interface PluginMarketplaceFilters {
  marketplaceUrl?: string
  publisher?: string
  query?: string
  sourceId?: string
  type?: string
  version?: string
}

export interface PluginExtensionRecord {
  id: string
  pluginId: string
  pluginName: string
  pluginVersion: string
  point: string
  scope: string
  label?: string
  description?: string
  actionRef?: string
  resourceKinds?: string[]
  permissionKeys?: string[]
  runtimeMode?: string
  status: string
  configured: boolean
  metadata?: Record<string, unknown>
}

export const pluginQueryKeys = {
  marketplace: (filters: PluginMarketplaceFilters) => ['plugins', 'marketplace', filters] as const,
  marketplaceDetail: (pluginId?: string, filters?: PluginMarketplaceFilters) => ['plugins', 'marketplace', pluginId, filters] as const,
  installed: ['plugins', 'installed'] as const,
  installedDetail: (pluginId?: string) => ['plugins', 'installed', pluginId] as const,
  manifest: (pluginId?: string) => ['plugins', 'manifest', pluginId] as const,
  extensions: (scope: string) => ['plugins', 'extensions', scope] as const,
}

export const pluginTypeOptions = [
  { value: 'skill', label: 'Skill' },
  { value: 'skill-pack', label: 'Skill Pack' },
  { value: 'mcp-preset', label: 'MCP Preset' },
  { value: 'connector', label: 'Connector' },
  { value: 'ai-provider-adapter', label: 'AI Provider' },
  { value: 'agent-profile', label: 'Agent Profile' },
  { value: 'gateway-policy-pack', label: 'Policy Pack' },
  { value: 'diagnostic', label: 'Diagnostic' },
  { value: 'resource-extension', label: 'Resource Extension' },
  { value: 'metric-extension', label: 'Metric Extension' },
  { value: 'notification-channel', label: 'Notification Channel' },
  { value: 'identity-template', label: 'Identity Template' },
  { value: 'ui-extension', label: 'UI Extension' },
]

export const pluginRiskLabels: Record<string, string> = {
  read: '只读',
  write: '写入',
  execute: '执行',
  high: '高风险',
  mutate: '变更',
}

function queryString(filters: PluginMarketplaceFilters) {
  const params = new URLSearchParams()
  if (filters.query?.trim()) params.set('q', filters.query.trim())
  if (filters.type?.trim()) params.set('type', filters.type.trim())
  if (filters.publisher?.trim()) params.set('publisher', filters.publisher.trim())
  if (filters.sourceId?.trim()) params.set('sourceId', filters.sourceId.trim())
  if (filters.marketplaceUrl?.trim()) params.set('marketplaceUrl', filters.marketplaceUrl.trim())
  if (filters.version?.trim()) params.set('version', filters.version.trim())
  const suffix = params.toString()
  return suffix ? `?${suffix}` : ''
}

export function listMarketplacePlugins(filters: PluginMarketplaceFilters) {
  return api
    .get<ApiResponse<MarketplacePlugin[]>>(`/plugins/marketplace${queryString(filters)}`)
    .then((res) => res.data ?? [])
}

export function getMarketplacePlugin(pluginId: string, filters: PluginMarketplaceFilters = {}) {
  return api
    .get<ApiResponse<MarketplacePlugin>>(`/plugins/marketplace/${encodeURIComponent(pluginId)}${queryString(filters)}`)
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

export function listPluginExtensions(scope = 'runtime') {
  return api
    .get<ApiResponse<PluginExtensionRecord[]>>(`/extensions/${encodeURIComponent(scope)}`)
    .then((res) => res.data ?? [])
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

export function manifestExtensionCount(manifest?: PluginManifest | null) {
  const points = manifest?.extensionPoints
  if (!points) return 0
  return Object.values(points).reduce<number>((total, group) => {
    if (!group || typeof group !== 'object') return total
    return total + Object.values(group as Record<string, unknown>).reduce<number>((groupTotal, contributions) => (
      groupTotal + (Array.isArray(contributions) ? contributions.length : 0)
    ), 0)
  }, 0)
}

export function latestMarketplaceVersion(plugin: MarketplacePlugin): MarketplacePluginVersion | undefined {
  const target = plugin.latestVersion || plugin.version
  return plugin.versions?.find((item) => item.version === target) ?? plugin.versions?.[0]
}
