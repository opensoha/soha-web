import { queryOptions } from '@tanstack/react-query'
import {
  systemApi,
  type AuditLogFilters,
  type OperationLogFilters,
  type SystemEndpointScope,
} from './api'
import { systemKeys } from './keys'

export const systemQueries = {
  sessions: (scope: SystemEndpointScope) =>
    queryOptions({
      queryKey: systemKeys.sessions.list(scope),
      queryFn: () => systemApi.sessions.list(scope),
      refetchInterval: 10_000,
    }),
  announcements: () =>
    queryOptions({
      queryKey: systemKeys.announcements.list(),
      queryFn: systemApi.announcements.list,
    }),
  menus: () =>
    queryOptions({
      queryKey: systemKeys.menus.list(),
      queryFn: systemApi.menus.list,
    }),
  menuAccessRoles: (enabled: boolean) =>
    queryOptions({
      queryKey: systemKeys.menus.accessRoles(),
      queryFn: systemApi.menus.accessRoles,
      enabled,
      retry: false,
    }),
  audit: (scope: SystemEndpointScope, filters: AuditLogFilters = {}) =>
    queryOptions({
      queryKey: systemKeys.audit.list(scope, filters),
      queryFn: () => systemApi.audit.list(scope, filters),
    }),
  operationLogs: (filters: OperationLogFilters = {}) =>
    queryOptions({
      queryKey: systemKeys.operationLogs.list(filters),
      queryFn: () => systemApi.operationLogs.list(filters),
    }),
}
