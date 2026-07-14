import { queryOptions } from '@tanstack/react-query'

import { workbenchApi } from './api'
import { workbenchKeys } from './keys'

export const workbenchQueries = {
  sessions: {
    all: () =>
      queryOptions({
        queryKey: workbenchKeys.sessions.all(),
        queryFn: workbenchApi.sessions.all,
      }),
    detail: (sessionId?: string) =>
      queryOptions({
        queryKey: workbenchKeys.sessions.detail(sessionId),
        queryFn: () => workbenchApi.sessions.detail(sessionId!),
        enabled: Boolean(sessionId),
      }),
    messages: (sessionId?: string) =>
      queryOptions({
        queryKey: workbenchKeys.sessions.messages(sessionId),
        queryFn: () => workbenchApi.sessions.messages(sessionId!),
        enabled: Boolean(sessionId),
      }),
  },
  catalog: () =>
    queryOptions({
      queryKey: workbenchKeys.catalog(),
      queryFn: workbenchApi.catalog,
    }),
  agentRuns: {
    all: () =>
      queryOptions({
        queryKey: workbenchKeys.agentRuns.all(),
        queryFn: workbenchApi.agentRuns.all,
      }),
    session: (sessionId?: string) =>
      queryOptions({
        queryKey: workbenchKeys.agentRuns.session(sessionId),
        queryFn: workbenchApi.agentRuns.all,
        enabled: Boolean(sessionId),
      }),
  },
}
