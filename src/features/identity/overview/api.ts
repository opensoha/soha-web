import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type { AuditLog, OnlineUser } from '@/features/system'

export const IDENTITY_OVERVIEW_AUDIT_LIMIT = 8

export async function listIdentityOverviewSessions(): Promise<OnlineUser[]> {
  const response = await api.get<ApiResponse<OnlineUser[]>>('/auth/sessions')
  return response.data ?? []
}

export async function listIdentityOverviewAudit(): Promise<AuditLog[]> {
  const response = await api.get<ApiResponse<AuditLog[]>>(
    `/identity/audit/events?limit=${IDENTITY_OVERVIEW_AUDIT_LIMIT}`,
  )
  return response.data ?? []
}
