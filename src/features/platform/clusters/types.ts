import type { Cluster, ClusterDetail, Node, ScopeKey } from '@/types'

export type ConnectionMode = 'direct_kubeconfig' | 'agent'

export interface ClusterFormValues {
  name?: string
  provider?: string
  environment?: string
  connectionMode: ConnectionMode
  kubeconfig?: string
  agentEndpoint?: string
  agentToken?: string
  prometheusBaseUrl?: string
  prometheusBearerToken?: string
}

export interface ClusterTarget {
  readonly scope: ScopeKey
}

export type ClusterPayload = Record<string, unknown>

export interface UpdateClusterVariables extends ClusterTarget {
  readonly values: ClusterPayload
}

export interface DeleteClustersVariables {
  readonly scopes: ScopeKey[]
}

export type { Cluster, ClusterDetail, Node }
