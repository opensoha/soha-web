export interface ReplicaSet {
  ageSeconds: number
  allowedActions?: string[]
  availableReplicas: number
  desiredReplicas: number
  name: string
  namespace: string
  readyReplicas: number
}
