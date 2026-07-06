import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'

export type IdentityRuntimeProviderType = 'oidc' | 'proxy'
export type IdentityRuntimeProviderStatus = 'enabled' | 'disabled'
export type IdentityOIDCClientStatus = 'enabled' | 'disabled'

export interface IdentityProvider {
  id: string
  applicationId: string
  name: string
  type: IdentityRuntimeProviderType
  enabled: boolean
  config?: Record<string, unknown>
  secretRefs?: Record<string, unknown>
  status: IdentityRuntimeProviderStatus
  createdBy?: string
  updatedBy?: string
  createdAt: string
  updatedAt: string
}

export interface IdentityProviderInput {
  applicationId: string
  name: string
  type: IdentityRuntimeProviderType
  enabled: boolean
  config: Record<string, unknown>
  secretRefs: Record<string, unknown>
  status: IdentityRuntimeProviderStatus
}

export interface IdentityOIDCClient {
  id: string
  providerId: string
  clientId: string
  redirectUris: string[]
  allowedScopes: string[]
  allowedGrantTypes: string[]
  requirePkce: boolean
  accessTokenTtlSeconds: number
  idTokenTtlSeconds: number
  refreshTokenTtlSeconds: number
  status: IdentityOIDCClientStatus
  createdAt: string
  updatedAt: string
}

export interface IdentityOIDCClientInput {
  providerId?: string
  clientId: string
  clientSecret?: string
  redirectUris: string[]
  allowedScopes: string[]
  allowedGrantTypes: string[]
  requirePkce: boolean
  accessTokenTtlSeconds: number
  idTokenTtlSeconds: number
  refreshTokenTtlSeconds: number
  status: IdentityOIDCClientStatus
}

export interface IdentityOIDCClientCreated {
  client: IdentityOIDCClient
  clientSecret?: string
}

export interface IdentityProviderFilters {
  type?: string
  status?: string
}

export const identityProviderQueryKeys = {
  providers: (filters: IdentityProviderFilters) => ['identity', 'providers', filters] as const,
  oidcClients: (providerId: string) => ['identity', 'providers', providerId, 'oidc-clients'] as const,
}

function queryString(filters: IdentityProviderFilters) {
  const params = new URLSearchParams()
  if (filters.type?.trim()) params.set('type', filters.type.trim())
  if (filters.status?.trim()) params.set('status', filters.status.trim())
  const suffix = params.toString()
  return suffix ? `?${suffix}` : ''
}

export function listIdentityProviders(filters: IdentityProviderFilters) {
  return api
    .get<ApiResponse<IdentityProvider[]>>(`/identity/providers${queryString(filters)}`)
    .then((res) => res.data ?? [])
}

export function createIdentityProvider(input: IdentityProviderInput) {
  return api
    .post<ApiResponse<IdentityProvider>>('/identity/providers', input)
    .then((res) => res.data)
}

export function updateIdentityProvider(providerId: string, input: IdentityProviderInput) {
  return api
    .put<ApiResponse<IdentityProvider>>(`/identity/providers/${encodeURIComponent(providerId)}`, input)
    .then((res) => res.data)
}

export function deleteIdentityProvider(providerId: string) {
  return api.delete<ApiResponse<{ status: string }>>(
    `/identity/providers/${encodeURIComponent(providerId)}`,
  )
}

export function listIdentityOIDCClients(providerId: string) {
  return api
    .get<ApiResponse<IdentityOIDCClient[]>>(
      `/identity/providers/${encodeURIComponent(providerId)}/oidc-clients`,
    )
    .then((res) => res.data ?? [])
}

export function createIdentityOIDCClient(providerId: string, input: IdentityOIDCClientInput) {
  return api
    .post<ApiResponse<IdentityOIDCClientCreated>>(
      `/identity/providers/${encodeURIComponent(providerId)}/oidc-clients`,
      input,
    )
    .then((res) => res.data)
}

export function updateIdentityOIDCClient(clientId: string, input: IdentityOIDCClientInput) {
  return api
    .put<ApiResponse<IdentityOIDCClient>>(
      `/identity/oidc-clients/${encodeURIComponent(clientId)}`,
      input,
    )
    .then((res) => res.data)
}

export function deleteIdentityOIDCClient(clientId: string) {
  return api.delete<ApiResponse<{ status: string }>>(
    `/identity/oidc-clients/${encodeURIComponent(clientId)}`,
  )
}
