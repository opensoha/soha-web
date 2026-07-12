import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type { WorkbenchCatalog, WorkbenchSession } from '../workbench/types'
import type {
  AutomationPolicy,
  Insight,
  InspectionRun,
  InspectionRunSummary,
  InspectionTask,
  PatchSessionInput,
  RootCauseRun,
} from './types'

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request
  return response.data
}

export const observeApi = {
  overview: {
    sessions: () => unwrap(api.get<ApiResponse<WorkbenchSession[]>>('/copilot/sessions')),
    insights: () => unwrap(api.get<ApiResponse<Insight[]>>('/copilot/insights')),
    analysisRuns: () => unwrap(api.get<ApiResponse<RootCauseRun[]>>('/copilot/analysis/runs')),
    inspectionRuns: () =>
      unwrap(api.get<ApiResponse<InspectionRunSummary[]>>('/copilot/inspection-runs')),
  },
  operations: {
    tasks: () => unwrap(api.get<ApiResponse<InspectionTask[]>>('/copilot/inspection-tasks')),
    runs: () => unwrap(api.get<ApiResponse<InspectionRun[]>>('/copilot/inspection-runs')),
    policies: () =>
      unwrap(api.get<ApiResponse<AutomationPolicy[]>>('/copilot/automation-policies')),
    catalog: () => unwrap(api.get<ApiResponse<WorkbenchCatalog>>('/copilot/workbench/catalog')),
    createSession: (runId: string) =>
      unwrap(api.post<ApiResponse<WorkbenchSession>>(`/copilot/inspection-runs/${runId}/session`)),
    createTask: (values: Record<string, unknown>) =>
      unwrap(api.post<ApiResponse<InspectionTask>>('/copilot/inspection-tasks', values)),
    updateTask: ({ taskId, values }: { taskId: string; values: Record<string, unknown> }) =>
      unwrap(api.put<ApiResponse<InspectionTask>>(`/copilot/inspection-tasks/${taskId}`, values)),
    deleteTask: (taskId: string) => api.delete(`/copilot/inspection-tasks/${taskId}`),
    createPolicy: (values: Record<string, unknown>) =>
      unwrap(api.post<ApiResponse<AutomationPolicy>>('/copilot/automation-policies', values)),
    updatePolicy: ({ policyId, values }: { policyId: string; values: Record<string, unknown> }) =>
      unwrap(
        api.put<ApiResponse<AutomationPolicy>>(`/copilot/automation-policies/${policyId}`, values),
      ),
    deletePolicy: (policyId: string) => api.delete(`/copilot/automation-policies/${policyId}`),
    executeTask: (taskId: string) => api.post(`/copilot/inspection-tasks/${taskId}/execute`),
  },
  tools: {
    catalog: () => unwrap(api.get<ApiResponse<WorkbenchCatalog>>('/copilot/workbench/catalog')),
    session: (sessionId: string) =>
      unwrap(api.get<ApiResponse<WorkbenchSession>>(`/copilot/sessions/${sessionId}`)),
    patchSession: ({ sessionId, body }: PatchSessionInput) =>
      unwrap(api.patch<ApiResponse<WorkbenchSession>>(`/copilot/sessions/${sessionId}`, body)),
  },
}
