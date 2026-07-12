import { queryOptions } from '@tanstack/react-query'
import { directorySyncApi } from './api'

export const directorySyncKeys = {
  all: ['access', 'directory-sync'] as const,
  connections: () => [...directorySyncKeys.all, 'connections'] as const,
  runs: (connectionId: string) => [...directorySyncKeys.all, 'runs', connectionId] as const,
  conflicts: () => [...directorySyncKeys.all, 'conflicts'] as const,
}

export const directorySyncQueries = {
  connections: (enabled = true) =>
    queryOptions({
      queryKey: directorySyncKeys.connections(),
      queryFn: directorySyncApi.listConnections,
      enabled,
    }),
  runs: (connectionId: string) =>
    queryOptions({
      queryKey: directorySyncKeys.runs(connectionId),
      queryFn: () => directorySyncApi.listRuns(connectionId),
      enabled: Boolean(connectionId),
      refetchInterval: (query) =>
        query.state.data?.some((run) => run.status === 'queued' || run.status === 'running')
          ? 3000
          : false,
    }),
  conflicts: (enabled = true) =>
    queryOptions({
      queryKey: directorySyncKeys.conflicts(),
      queryFn: directorySyncApi.listConflicts,
      enabled,
    }),
}
