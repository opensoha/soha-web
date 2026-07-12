import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'

import type {
  WorkbenchAgentRun,
  WorkbenchCatalog,
  WorkbenchMessage,
  WorkbenchSession,
  WorkbenchSessionScope,
} from './types'

export interface CreateWorkbenchSessionInput {
  title: string
  mode: NonNullable<NonNullable<WorkbenchSession['metadata']>['mode']>
  agentProviderId: string
  scope: WorkbenchSessionScope
  tags: string[]
}

export interface PatchWorkbenchSessionInput {
  sessionId: string
  body: Record<string, unknown>
}

export interface CreateInspectionTaskInput {
  sessionId: string
  body: {
    title: string
    scopeType: string
    clusterId?: string
    namespace?: string
    checks: string[]
    enabled: boolean
    intervalMinutes: number
    metadata: Record<string, unknown>
  }
}

export const workbenchApi = {
  sessions: {
    all: () => api.get<ApiResponse<WorkbenchSession[]>>('/copilot/sessions'),
    detail: (sessionId: string) =>
      api.get<ApiResponse<WorkbenchSession>>(`/copilot/sessions/${sessionId}`),
    messages: (sessionId: string) =>
      api.get<ApiResponse<WorkbenchMessage[]>>(`/copilot/sessions/${sessionId}/messages`),
    create: (input: CreateWorkbenchSessionInput) =>
      api.post<ApiResponse<WorkbenchSession>>('/copilot/sessions', input),
    patch: (input: PatchWorkbenchSessionInput) =>
      api.patch<ApiResponse<WorkbenchSession>>(`/copilot/sessions/${input.sessionId}`, input.body),
    archive: (sessionId: string) => api.delete<void>(`/copilot/sessions/${sessionId}`),
    createInspectionTask: (input: CreateInspectionTaskInput) =>
      api.post<void>(`/copilot/sessions/${input.sessionId}/inspection-task`, input.body),
  },
  catalog: () => api.get<ApiResponse<WorkbenchCatalog>>('/copilot/workbench/catalog'),
  agentRuns: {
    all: () => api.get<ApiResponse<WorkbenchAgentRun[]>>('/copilot/agent-runs'),
  },
}
