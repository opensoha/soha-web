export interface AlertSummary {
  totalCount: number
  firingCount: number
  resolvedCount: number
  criticalCount: number
  warningCount: number
  infoCount: number
  channelCount: number
  lastReceivedAt?: string
}

export interface WorkloadOverviewNamespace {
  namespace: string
  totalPods: number
  runningPods: number
  atRiskPods: number
  restartingPods: number
}

export interface WorkloadOverviewPod {
  name: string
  namespace: string
  phase: string
  readyContainers: string
  restarts: number
  nodeName?: string
  ageSeconds: number
}

export interface WorkloadOverview {
  clusterId: string
  namespace?: string
  source: string
  generatedAt: string
  totalPods: number
  runningPods: number
  pendingPods: number
  succeededPods: number
  failedPods: number
  unknownPods: number
  restartingPods: number
  atRiskPods: number
  namespaceBreakdown?: WorkloadOverviewNamespace[]
  problematicPods?: WorkloadOverviewPod[]
}

export interface AggregatedNamespaceBreakdown extends WorkloadOverviewNamespace {
  clusterId: string
  clusterName: string
}

export interface AggregatedProblematicPod extends WorkloadOverviewPod {
  clusterId: string
  clusterName: string
}

export interface AggregatedWorkloadOverview extends Omit<
  WorkloadOverview,
  'clusterId' | 'namespace' | 'generatedAt' | 'source' | 'namespaceBreakdown' | 'problematicPods'
> {
  generatedAt: string
  source: string
  namespaceBreakdown: AggregatedNamespaceBreakdown[]
  problematicPods: AggregatedProblematicPod[]
}
