export interface ReplicationController {
  ageSeconds: number
  allowedActions?: string[]
  availableReplicas: number
  currentReplicas: number
  desiredReplicas: number
  name: string
  namespace: string
  readyReplicas: number
}
