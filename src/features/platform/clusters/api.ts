import { api } from '@/services/api-client'
import type { ApiResponse, ClusterCapabilityMatrixEntry, ScopeKey } from '@/types'
import type {
  Cluster,
  ClusterDetail,
  ClusterPayload,
  ClusterTarget,
  Node,
  UpdateClusterVariables,
} from './types'

function requireClusterId(scope: ScopeKey) {
  const clusterId = scope.clusterId?.trim()
  if (!clusterId) throw new Error('A cluster is required')
  return clusterId
}

function clusterPath(scope: ScopeKey, suffix = '') {
  return `/clusters/${encodeURIComponent(requireClusterId(scope))}${suffix}`
}

export async function listClusters(): Promise<Cluster[]> {
  const response = await api.get<ApiResponse<Cluster[]>>('/clusters')
  return response.data ?? []
}

export async function listClusterCapabilities(): Promise<ClusterCapabilityMatrixEntry[]> {
  const response =
    await api.get<ApiResponse<ClusterCapabilityMatrixEntry[]>>('/clusters/capabilities')
  return response.data ?? []
}

export async function getClusterDetail(target: ClusterTarget): Promise<ClusterDetail> {
  const response = await api.get<ApiResponse<ClusterDetail>>(clusterPath(target.scope, '/detail'))
  return response.data
}

export async function listClusterNodes(target: ClusterTarget): Promise<Node[]> {
  const response = await api.get<ApiResponse<Node[]>>(
    clusterPath(target.scope, '/infrastructure/nodes'),
  )
  return response.data ?? []
}

export async function createCluster(values: ClusterPayload): Promise<Cluster> {
  const response = await api.post<ApiResponse<Cluster>>('/clusters', values)
  return response.data
}

export async function updateCluster({ scope, values }: UpdateClusterVariables): Promise<Cluster> {
  const response = await api.put<ApiResponse<Cluster>>(clusterPath(scope), values)
  return response.data
}

export async function deleteCluster(target: ClusterTarget): Promise<void> {
  await api.delete<unknown>(clusterPath(target.scope))
}
