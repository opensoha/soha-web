import type {
  IdentityOIDCClient,
  IdentityOIDCClientInput,
  IdentityOIDCClientStatus,
  IdentityProvider,
  IdentityProviderInput,
  IdentityRuntimeProviderStatus,
  IdentityRuntimeProviderType,
} from './types'

export type ProxyMode = 'forward_auth' | 'reverse_proxy'

export interface ProviderFormValues {
  applicationId: string
  configJson: string
  enabled: boolean
  name: string
  proxyCookieDomain: string
  proxyExternalHosts: string[]
  proxyHeaderEmail: string
  proxyHeaderGroups: string
  proxyHeaderRoles: string
  proxyHeaderTeams: string
  proxyHeaderUser: string
  proxyHeaderUserId: string
  proxyMode: ProxyMode
  proxyOutpostId: string
  proxyPathPrefix: string
  proxySkipAuthPaths: string[]
  proxyUpstreamUrl: string
  proxyWebsocketEnabled: boolean
  secretRefsJson: string
  status: IdentityRuntimeProviderStatus
  type: IdentityRuntimeProviderType
}

export interface OIDCClientFormValues {
  accessTokenTtlSeconds: number
  allowedGrantTypes: string[]
  allowedScopes: string[]
  clientId: string
  clientSecret: string
  idTokenTtlSeconds: number
  redirectUris: string[]
  refreshTokenTtlSeconds: number
  requirePkce: boolean
  status: IdentityOIDCClientStatus
}

export const providerTypeOptions: Array<{
  label: string
  value: IdentityRuntimeProviderType
}> = [
  { label: 'OIDC', value: 'oidc' },
  { label: 'Proxy', value: 'proxy' },
]

export const providerStatusOptions: Array<{
  label: string
  value: IdentityRuntimeProviderStatus
}> = [
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
]

export const proxyModeOptions: Array<{ disabled?: boolean; label: string; value: ProxyMode }> = [
  { label: 'Forward auth', value: 'forward_auth' },
  { disabled: true, label: 'Reverse proxy (planned)', value: 'reverse_proxy' },
]

export const oidcClientStatusOptions: Array<{
  label: string
  value: IdentityOIDCClientStatus
}> = [
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
]

export const defaultScopes = ['openid', 'profile', 'email']
export const defaultGrantTypes = ['authorization_code']
export const oidcGrantTypeOptions = [{ label: 'authorization_code', value: 'authorization_code' }]
export const defaultProxyHeaders = {
  email: 'X-Soha-Email',
  groups: 'X-Soha-Groups',
  roles: 'X-Soha-Roles',
  teams: 'X-Soha-Teams',
  user: 'X-Soha-User',
  userId: 'X-Soha-User-ID',
}

const knownProxyConfigKeys = [
  'cookieDomain',
  'cookie_domain',
  'externalHost',
  'externalHosts',
  'external_host',
  'external_hosts',
  'headerMappings',
  'header_mappings',
  'host',
  'hosts',
  'mode',
  'outpostId',
  'outpost_id',
  'pathPrefix',
  'path_prefix',
  'protectedPathPrefix',
  'protected_path_prefix',
  'skipAuthPaths',
  'skip_auth_paths',
  'upstreamURL',
  'upstreamUrl',
  'upstream_url',
  'websocketEnabled',
  'websocket_enabled',
]

export function compactStrings(values: string[] = []) {
  const seen = new Set<string>()
  const out: string[] = []
  values.forEach((value) => {
    const normalized = String(value ?? '').trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    out.push(normalized)
  })
  return out
}

function jsonText(value?: Record<string, unknown>) {
  return JSON.stringify(value ?? {}, null, 2)
}

function parseRecordJSON(value: string, label: string): Record<string, unknown> {
  const text = String(value ?? '').trim()
  if (!text) return {}
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON object`)
  }
  return parsed as Record<string, unknown>
}

function configString(config: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = config?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function configStringArray(config: Record<string, unknown> | undefined, ...keys: string[]) {
  const values: string[] = []
  keys.forEach((key) => {
    const value = config?.[key]
    if (typeof value === 'string') {
      values.push(...value.split(','))
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string') values.push(item)
      })
    }
  })
  return compactStrings(values)
}

function configBoolean(config: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = config?.[key]
    if (typeof value === 'boolean') return value
  }
  return false
}

function configStringMap(config: Record<string, unknown> | undefined, ...keys: string[]) {
  const out: Record<string, string> = {}
  keys.forEach((key) => {
    const value = config?.[key]
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    Object.entries(value as Record<string, unknown>).forEach(([itemKey, itemValue]) => {
      if (typeof itemValue === 'string') out[itemKey] = itemValue.trim()
    })
  })
  return out
}

function stripKnownProxyConfig(config?: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...(config ?? {}) }
  knownProxyConfigKeys.forEach((key) => delete out[key])
  return out
}

function setStringConfig(config: Record<string, unknown>, key: string, value?: string) {
  const normalized = String(value ?? '').trim()
  if (normalized) config[key] = normalized
}

function proxyConfigFromValues(
  values: ProviderFormValues,
  advancedConfig: Record<string, unknown>,
) {
  const config = stripKnownProxyConfig(advancedConfig)
  const externalHosts = compactStrings(values.proxyExternalHosts)
  if (externalHosts.length) config.externalHosts = externalHosts
  setStringConfig(config, 'upstreamUrl', values.proxyUpstreamUrl)
  setStringConfig(config, 'mode', values.proxyMode || 'forward_auth')
  setStringConfig(config, 'cookieDomain', values.proxyCookieDomain)
  setStringConfig(config, 'pathPrefix', values.proxyPathPrefix)
  setStringConfig(config, 'outpostId', values.proxyOutpostId)
  const skipAuthPaths = compactStrings(values.proxySkipAuthPaths)
  if (skipAuthPaths.length) config.skipAuthPaths = skipAuthPaths
  config.websocketEnabled = Boolean(values.proxyWebsocketEnabled)

  const headerMappings: Record<string, string> = {}
  const headerValues = {
    email: values.proxyHeaderEmail,
    groups: values.proxyHeaderGroups,
    roles: values.proxyHeaderRoles,
    teams: values.proxyHeaderTeams,
    user: values.proxyHeaderUser,
    userId: values.proxyHeaderUserId,
  }
  Object.entries(headerValues).forEach(([claim, headerName]) => {
    const normalized = String(headerName ?? '').trim()
    if (normalized) headerMappings[claim] = normalized
  })
  if (Object.keys(headerMappings).length) config.headerMappings = headerMappings
  return config
}

export function defaultProviderValues(): ProviderFormValues {
  return {
    applicationId: '',
    configJson: '{}',
    enabled: true,
    name: '',
    proxyCookieDomain: '',
    proxyExternalHosts: [],
    proxyHeaderEmail: defaultProxyHeaders.email,
    proxyHeaderGroups: defaultProxyHeaders.groups,
    proxyHeaderRoles: defaultProxyHeaders.roles,
    proxyHeaderTeams: defaultProxyHeaders.teams,
    proxyHeaderUser: defaultProxyHeaders.user,
    proxyHeaderUserId: defaultProxyHeaders.userId,
    proxyMode: 'forward_auth',
    proxyOutpostId: '',
    proxyPathPrefix: '/',
    proxySkipAuthPaths: [],
    proxyUpstreamUrl: '',
    proxyWebsocketEnabled: true,
    secretRefsJson: '{}',
    status: 'enabled',
    type: 'oidc',
  }
}

export function providerValuesFor(item: IdentityProvider): ProviderFormValues {
  const config = item.config ?? {}
  const headerMappings = configStringMap(config, 'headerMappings', 'header_mappings')
  return {
    applicationId: item.applicationId,
    configJson: item.type === 'proxy' ? jsonText(stripKnownProxyConfig(config)) : jsonText(config),
    enabled: item.enabled,
    name: item.name,
    proxyCookieDomain: configString(config, 'cookieDomain', 'cookie_domain'),
    proxyExternalHosts: configStringArray(
      config,
      'externalHosts',
      'external_hosts',
      'hosts',
      'externalHost',
      'external_host',
      'host',
    ),
    proxyHeaderEmail: headerMappings.email || defaultProxyHeaders.email,
    proxyHeaderGroups: headerMappings.groups || defaultProxyHeaders.groups,
    proxyHeaderRoles: headerMappings.roles || defaultProxyHeaders.roles,
    proxyHeaderTeams: headerMappings.teams || defaultProxyHeaders.teams,
    proxyHeaderUser: headerMappings.user || defaultProxyHeaders.user,
    proxyHeaderUserId: headerMappings.userId || defaultProxyHeaders.userId,
    proxyMode: configString(config, 'mode') === 'reverse_proxy' ? 'reverse_proxy' : 'forward_auth',
    proxyOutpostId: configString(config, 'outpostId', 'outpost_id'),
    proxyPathPrefix:
      configString(
        config,
        'pathPrefix',
        'path_prefix',
        'protectedPathPrefix',
        'protected_path_prefix',
      ) || '/',
    proxySkipAuthPaths: configStringArray(config, 'skipAuthPaths', 'skip_auth_paths'),
    proxyUpstreamUrl: configString(config, 'upstreamUrl', 'upstreamURL', 'upstream_url'),
    proxyWebsocketEnabled: configBoolean(config, 'websocketEnabled', 'websocket_enabled'),
    secretRefsJson: jsonText(item.secretRefs),
    status: item.status,
    type: item.type,
  }
}

export function providerInputFromValues(values: ProviderFormValues): IdentityProviderInput {
  const advancedConfig = parseRecordJSON(values.configJson, 'Config')
  return {
    applicationId: values.applicationId.trim(),
    config:
      values.type === 'proxy' ? proxyConfigFromValues(values, advancedConfig) : advancedConfig,
    enabled: Boolean(values.enabled),
    name: values.name.trim(),
    secretRefs: parseRecordJSON(values.secretRefsJson, 'Secret refs'),
    status: values.status || 'disabled',
    type: values.type || 'oidc',
  }
}

export function defaultOIDCClientValues(): OIDCClientFormValues {
  return {
    accessTokenTtlSeconds: 3600,
    allowedGrantTypes: defaultGrantTypes,
    allowedScopes: defaultScopes,
    clientId: '',
    clientSecret: '',
    idTokenTtlSeconds: 300,
    redirectUris: [],
    refreshTokenTtlSeconds: 0,
    requirePkce: true,
    status: 'enabled',
  }
}

export function oidcClientValuesFor(client: IdentityOIDCClient): OIDCClientFormValues {
  return {
    accessTokenTtlSeconds: client.accessTokenTtlSeconds,
    allowedGrantTypes: defaultGrantTypes,
    allowedScopes: client.allowedScopes ?? defaultScopes,
    clientId: client.clientId,
    clientSecret: '',
    idTokenTtlSeconds: client.idTokenTtlSeconds,
    redirectUris: client.redirectUris ?? [],
    refreshTokenTtlSeconds: 0,
    requirePkce: client.requirePkce,
    status: client.status,
  }
}

export function oidcClientInputFromValues(
  providerId: string,
  values: OIDCClientFormValues,
): IdentityOIDCClientInput {
  const clientSecret = values.clientSecret.trim()
  return {
    accessTokenTtlSeconds: Number(values.accessTokenTtlSeconds || 3600),
    allowedGrantTypes: defaultGrantTypes,
    allowedScopes: compactStrings(values.allowedScopes),
    clientId: values.clientId.trim(),
    clientSecret: clientSecret || undefined,
    idTokenTtlSeconds: Number(values.idTokenTtlSeconds || 300),
    providerId,
    redirectUris: compactStrings(values.redirectUris),
    refreshTokenTtlSeconds: 0,
    requirePkce: Boolean(values.requirePkce),
    status: values.status || 'enabled',
  }
}
