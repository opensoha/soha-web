import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import { normalizeIdentityProviderFilters } from './keys'
import type {
  CreateIdentityOIDCClientVariables,
  DeleteIdentityOIDCClientVariables,
  IdentityOIDCClient,
  IdentityOIDCClientCreated,
  IdentityProvider,
  IdentityProviderFilters,
  IdentityProviderInput,
  UpdateIdentityOIDCClientVariables,
  UpdateIdentityProviderVariables,
} from './types'

function queryString(filters: IdentityProviderFilters) {
  const normalized = normalizeIdentityProviderFilters(filters)
  const params = new URLSearchParams()
  if (normalized.applicationId) params.set('applicationId', normalized.applicationId)
  if (normalized.type) params.set('type', normalized.type)
  if (normalized.status) params.set('status', normalized.status)
  if (normalized.limit !== undefined) params.set('limit', String(normalized.limit))
  if (normalized.offset !== undefined) params.set('offset', String(normalized.offset))
  const suffix = params.toString()
  return suffix ? `?${suffix}` : ''
}

export async function listIdentityProviders(
  filters: IdentityProviderFilters = {},
): Promise<IdentityProvider[]> {
  const response = await api.get<ApiResponse<IdentityProvider[]>>(
    `/identity/providers${queryString(filters)}`,
  )
  return response.data ?? []
}

export async function getIdentityProvider(providerId: string): Promise<IdentityProvider> {
  const response = await api.get<ApiResponse<IdentityProvider>>(
    `/identity/providers/${encodeURIComponent(providerId.trim())}`,
  )
  return response.data
}

export async function createIdentityProvider(
  input: IdentityProviderInput,
): Promise<IdentityProvider> {
  const response = await api.post<ApiResponse<IdentityProvider>>('/identity/providers', input)
  return response.data
}

export async function updateIdentityProvider({
  providerId,
  input,
}: UpdateIdentityProviderVariables): Promise<IdentityProvider> {
  const response = await api.put<ApiResponse<IdentityProvider>>(
    `/identity/providers/${encodeURIComponent(providerId.trim())}`,
    input,
  )
  return response.data
}

export async function deleteIdentityProvider(providerId: string): Promise<void> {
  await api.delete<ApiResponse<{ status: string }>>(
    `/identity/providers/${encodeURIComponent(providerId.trim())}`,
  )
}

export async function listIdentityOIDCClients(providerId: string): Promise<IdentityOIDCClient[]> {
  const response = await api.get<ApiResponse<IdentityOIDCClient[]>>(
    `/identity/providers/${encodeURIComponent(providerId.trim())}/oidc-clients`,
  )
  return response.data ?? []
}

export async function createIdentityOIDCClient({
  providerId,
  input,
}: CreateIdentityOIDCClientVariables): Promise<IdentityOIDCClientCreated> {
  const response = await api.post<ApiResponse<IdentityOIDCClientCreated>>(
    `/identity/providers/${encodeURIComponent(providerId.trim())}/oidc-clients`,
    input,
  )
  return response.data
}

export async function updateIdentityOIDCClient({
  clientId,
  input,
}: UpdateIdentityOIDCClientVariables): Promise<IdentityOIDCClient> {
  const response = await api.put<ApiResponse<IdentityOIDCClient>>(
    `/identity/oidc-clients/${encodeURIComponent(clientId.trim())}`,
    input,
  )
  return response.data
}

export async function deleteIdentityOIDCClient({
  clientId,
}: DeleteIdentityOIDCClientVariables): Promise<void> {
  await api.delete<ApiResponse<{ status: string }>>(
    `/identity/oidc-clients/${encodeURIComponent(clientId.trim())}`,
  )
}
