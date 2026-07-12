import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type { IdentityApplication, IdentityApplicationLaunch } from '@/features/identity'
import type { PortalBootstrap, PortalLaunchDecision, PortalSecuritySummary } from './shared/types'

const PORTAL_BASE = '/portal'

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request
  return response.data
}

export const providerPortalApi = {
  bootstrap: () => unwrap(api.get<ApiResponse<PortalBootstrap>>(`${PORTAL_BASE}/bootstrap`)),
  applications: async () => {
    const response = await api.get<ApiResponse<IdentityApplication[]>>(
      `${PORTAL_BASE}/applications`,
    )
    return response.data ?? []
  },
  application: (applicationId: string) =>
    unwrap(
      api.get<ApiResponse<IdentityApplication>>(
        `${PORTAL_BASE}/applications/${encodeURIComponent(applicationId)}`,
      ),
    ),
  launch: (applicationId: string) =>
    unwrap(
      api.post<ApiResponse<PortalLaunchDecision>>(
        `${PORTAL_BASE}/applications/${encodeURIComponent(applicationId)}/launch`,
      ),
    ),
  favorite: (applicationId: string) =>
    unwrap(
      api.post<ApiResponse<IdentityApplication>>(
        `${PORTAL_BASE}/applications/${encodeURIComponent(applicationId)}/favorite`,
      ),
    ),
  unfavorite: async (applicationId: string): Promise<void> => {
    await api.delete<ApiResponse<{ status: string }>>(
      `${PORTAL_BASE}/applications/${encodeURIComponent(applicationId)}/favorite`,
    )
  },
  recent: async (limit = 10) => {
    const response = await api.get<ApiResponse<IdentityApplicationLaunch[]>>(
      `${PORTAL_BASE}/recent?limit=${limit}`,
    )
    return response.data ?? []
  },
  security: () => unwrap(api.get<ApiResponse<PortalSecuritySummary>>(`${PORTAL_BASE}/security`)),
}
