import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type {
  AccessRoleOption,
  Announcement,
  AuditLog,
  MenuItem,
  OnlineUser,
  OperationLog,
} from './system-model'

export type SystemEndpointScope = 'system' | 'identity'

export interface LogFilters {
  metadataKey?: string
  metadataValue?: string
  result?: string
}

export interface AuditLogFilters extends LogFilters {
  action?: string
}

export interface OperationLogFilters extends LogFilters {
  operationType?: string
}

interface SessionWireRecord {
  createdAt: string
  email: string
  expiresAt: string
  id: string
  lastSeenAt: string
  metadata?: {
    source?: string
    sourceIp?: string
    userAgent?: string
  }
  providerType: string
  status: string
  userId: string
  userName: string
}

export interface UpdateRecordVariables {
  id: string
  values: Record<string, unknown>
}

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request
  return response.data
}

function withQuery(path: string, filters: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    const normalized = value?.trim()
    if (normalized) search.set(key, normalized)
  })
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

function sessionBasePath(scope: SystemEndpointScope) {
  return scope === 'identity' ? '/identity/sessions' : '/auth/sessions'
}

function auditEventsPath(scope: SystemEndpointScope) {
  return scope === 'identity' ? '/identity/audit/events' : '/audit/logs'
}

export function resolveSystemEndpointScope(pathname: string): SystemEndpointScope {
  return pathname.startsWith('/identity/') ? 'identity' : 'system'
}

export const systemApi = {
  sessions: {
    list: async (scope: SystemEndpointScope): Promise<OnlineUser[]> => {
      const records = await unwrap(
        api.get<ApiResponse<SessionWireRecord[]>>(sessionBasePath(scope)),
      )
      return records.map((item) => ({
        id: item.id,
        userId: item.userId,
        userName: item.userName,
        email: item.email,
        providerType: item.providerType,
        status: item.status,
        loginTime: item.createdAt,
        lastSeenAt: item.lastSeenAt,
        expiry: item.expiresAt,
        source: item.metadata?.source,
        sourceIp: item.metadata?.sourceIp,
        userAgent: item.metadata?.userAgent,
      }))
    },
    revoke: (scope: SystemEndpointScope, sessionId: string) =>
      api.post<void>(`${sessionBasePath(scope)}/${encodeURIComponent(sessionId)}/revoke`),
    revokeMany: (scope: SystemEndpointScope, sessionIds: string[]) =>
      Promise.allSettled(
        sessionIds.map((sessionId) => systemApi.sessions.revoke(scope, sessionId)),
      ),
  },
  announcements: {
    list: () => unwrap(api.get<ApiResponse<Announcement[]>>('/announcements')),
    create: (values: Record<string, unknown>) =>
      unwrap(api.post<ApiResponse<Announcement>>('/announcements', values)),
    update: ({ id, values }: UpdateRecordVariables) =>
      unwrap(
        api.put<ApiResponse<Announcement>>(`/announcements/${encodeURIComponent(id)}`, values),
      ),
    publish: (id: string) =>
      unwrap(
        api.post<ApiResponse<Announcement>>(`/announcements/${encodeURIComponent(id)}/publish`),
      ),
    withdraw: (id: string) =>
      unwrap(
        api.post<ApiResponse<Announcement>>(`/announcements/${encodeURIComponent(id)}/withdraw`),
      ),
    remove: (id: string) => api.delete<void>(`/announcements/${encodeURIComponent(id)}`),
  },
  menus: {
    list: () => unwrap(api.get<ApiResponse<MenuItem[]>>('/menus')),
    accessRoles: () => unwrap(api.get<ApiResponse<AccessRoleOption[]>>('/access/roles')),
    create: (values: Record<string, unknown>) =>
      unwrap(api.post<ApiResponse<MenuItem>>('/menus', values)),
    update: ({ id, values }: UpdateRecordVariables) =>
      unwrap(api.put<ApiResponse<MenuItem>>(`/menus/${encodeURIComponent(id)}`, values)),
    remove: (id: string) => api.delete<void>(`/menus/${encodeURIComponent(id)}`),
  },
  audit: {
    list: (scope: SystemEndpointScope, filters: AuditLogFilters = {}) =>
      unwrap(
        api.get<ApiResponse<AuditLog[]>>(
          withQuery(auditEventsPath(scope), {
            action: filters.action,
            result: filters.result,
            metadataKey: filters.metadataKey,
            metadataValue: filters.metadataValue,
          }),
        ),
      ),
  },
  operationLogs: {
    list: (filters: OperationLogFilters = {}) =>
      unwrap(
        api.get<ApiResponse<OperationLog[]>>(
          withQuery('/operations/logs', {
            operationType: filters.operationType,
            result: filters.result,
            metadataKey: filters.metadataKey,
            metadataValue: filters.metadataValue,
          }),
        ),
      ),
  },
}
