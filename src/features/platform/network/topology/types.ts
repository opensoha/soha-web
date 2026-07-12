export type TopologyDataState = 'live' | 'pending' | 'demo'
export type TopologySourceType = 'ingress' | 'httproute' | 'gateway' | 'demo'
export type TopologyNodeKind =
  | 'entry'
  | 'ingress-route'
  | 'http-route'
  | 'pending-route'
  | 'service'
  | 'missing-service'
  | 'backend-group'
  | 'empty-backend'
  | 'pod'

export interface NetworkTopologySummaryView {
  readonly entryCount: number
  readonly routeCount: number
  readonly serviceCount: number
  readonly missingServiceCount: number
  readonly backendPodCount: number
  readonly pendingRouteCount: number
}

export interface NetworkTopologyNodeView {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly state: string
  readonly namespace?: string
  readonly resourceName?: string
  readonly subtitle?: string
  readonly badge?: string
}

export interface NetworkTopologyTraceView {
  readonly id: string
  readonly sourceType: string
  readonly state: string
  readonly entry: NetworkTopologyNodeView
  readonly route: NetworkTopologyNodeView
  readonly service?: NetworkTopologyNodeView
  readonly backendPods?: NetworkTopologyNodeView[]
  readonly note?: string
}

export interface NetworkTopologyView {
  readonly clusterId: string
  readonly namespace?: string
  readonly source: string
  readonly generatedAt: string
  readonly summary: NetworkTopologySummaryView
  readonly traces?: NetworkTopologyTraceView[]
  readonly warnings?: string[]
}

export interface TopologyNode {
  readonly id: string
  readonly name: string
  readonly kind: TopologyNodeKind
  readonly state: TopologyDataState
  readonly namespace?: string
  readonly resourceName?: string
  readonly subtitle?: string
  readonly badge?: string
}

export interface TopologyTrace {
  readonly id: string
  readonly entry: TopologyNode
  readonly route: TopologyNode
  readonly service?: TopologyNode
  readonly terminals: TopologyNode[]
  readonly sourceType: TopologySourceType
  readonly state: TopologyDataState
  readonly notes: string
}

export type TopologyTableRow = TopologyTrace

export interface TopologySelectionDetail {
  readonly notes: string[]
  readonly relatedEntries: TopologyNode[]
  readonly relatedRoutes: TopologyNode[]
  readonly relatedServices: TopologyNode[]
  readonly summary: string
  readonly terminalNodes: TopologyNode[]
}
