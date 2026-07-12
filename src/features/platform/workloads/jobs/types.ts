import type { Pod, ScopeKey } from '@/types'

export interface Job {
  name: string
  namespace: string
  completions: number
  succeeded: number
  failed: number
  active: number
  completionMode?: string
  ageSeconds: number
  allowedActions?: string[]
}

export interface JobDetail extends Job {
  parallelism?: number
  createdAt?: string
  startTime?: string
  completionTime?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

export interface JobTarget {
  readonly scope: ScopeKey
  readonly name: string
}

export type { Pod }
