import type {
  DeploymentDetail,
  DeploymentRolloutStatus,
  ResourceMetrics,
  RolloutHistory,
  ScopeKey,
} from '@/types'

export interface Deployment {
  name: string
  namespace: string
  labels?: Record<string, string>
  desiredReplicas: number
  readyReplicas: number
  updatedReplicas: number
  available: number
  ageSeconds: number
  allowedActions?: string[]
}

export interface DeploymentTarget {
  readonly scope: ScopeKey
  readonly name: string
}

export interface ApplicationEnvironment {
  id: string
  applicationId: string
  environmentId: string
  environmentKey?: string
  workflowTemplate?: {
    id: string
    name: string
    category?: string
  }
  targets?: Array<{
    id: string
    clusterId: string
    namespace: string
    workloadKind: string
    workloadName: string
    containerName?: string
    enabled: boolean
  }>
}

export interface ApplicationSummary {
  id: string
  name: string
  businessLineId?: string
}

export interface BuildRecord {
  id: string
  applicationId: string
  status: string
  createdAt: string
}

export interface WorkflowRecord {
  id: string
  applicationId: string
  clusterId: string
  namespace: string
  deploymentName: string
  status: string
  updatedAt: string
}

export interface ReleaseRecord {
  id: string
  applicationId: string
  clusterId: string
  namespace: string
  deploymentName: string
  status: string
  createdAt: string
}

export interface ScaleDeploymentVariables extends DeploymentTarget {
  readonly replicas: number
}

export interface RollbackDeploymentVariables extends DeploymentTarget {
  readonly revision?: string
}

export type { DeploymentDetail, DeploymentRolloutStatus, ResourceMetrics, RolloutHistory }
