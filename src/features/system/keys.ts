import type { AuditLogFilters, OperationLogFilters, SystemEndpointScope } from './api'

function normalizeFilters<T extends object>(filters: T) {
  return Object.fromEntries(
    Object.entries(filters as Record<string, string | undefined>)
      .map(([key, value]) => [key, value?.trim() ?? ''] as const)
      .filter(([, value]) => Boolean(value)),
  )
}

export const systemKeys = {
  sessions: {
    all: ['online-users'] as const,
    list: () => ['online-users', 'list'] as const,
  },
  announcements: {
    all: ['announcements'] as const,
    list: () => ['announcements', 'admin'] as const,
    inbox: () => ['announcements', 'inbox'] as const,
  },
  menus: {
    all: ['menus'] as const,
    list: () => ['menus', 'tree'] as const,
    accessRoles: () => ['menus', 'access-roles'] as const,
  },
  audit: {
    all: ['audit-logs'] as const,
    list: (scope: SystemEndpointScope, filters: AuditLogFilters = {}) =>
      ['audit-logs', scope, normalizeFilters(filters)] as const,
  },
  operationLogs: {
    all: ['operation-logs'] as const,
    list: (filters: OperationLogFilters = {}) =>
      ['operation-logs', normalizeFilters(filters)] as const,
  },
}

export const systemMutationKeys = {
  sessions: (action: 'revoke' | 'revoke-many') =>
    ['online-users', 'mutation', action] as const,
  announcements: (action: 'create' | 'update' | 'publish' | 'withdraw' | 'remove') =>
    ['announcements', 'mutation', action] as const,
  menus: (action: 'create' | 'update' | 'remove') => ['menus', 'mutation', action] as const,
}
