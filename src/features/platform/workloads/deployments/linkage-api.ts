import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type {
  ApplicationEnvironment,
  ApplicationSummary,
  BuildRecord,
  ReleaseRecord,
  WorkflowRecord,
} from './types'

async function listLinkageRecords<T>(path: string): Promise<T[]> {
  const response = await api.get<ApiResponse<T[]>>(path)
  return response.data ?? []
}

export function listApplicationEnvironments(): Promise<ApplicationEnvironment[]> {
  return listLinkageRecords<ApplicationEnvironment>('/application-environments')
}

export function listApplications(): Promise<ApplicationSummary[]> {
  return listLinkageRecords<ApplicationSummary>('/applications')
}

export function listBuilds(): Promise<BuildRecord[]> {
  return listLinkageRecords<BuildRecord>('/builds')
}

export function listWorkflows(): Promise<WorkflowRecord[]> {
  return listLinkageRecords<WorkflowRecord>('/workflows')
}

export function listReleases(): Promise<ReleaseRecord[]> {
  return listLinkageRecords<ReleaseRecord>('/releases')
}
