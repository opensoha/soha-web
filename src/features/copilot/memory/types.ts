import type { ProductionRecord } from '../production/operations-page'
export interface MemoryRecord extends ProductionRecord {
  ownerType: string
  ownerId: string
  fact: string
  confidence: number
  expiresAt?: string
  policyVer: string
}
export interface MemoryPolicy extends ProductionRecord {
  consentMode: string
  ttlDays: number
  status: string
}
export interface CreateMemoryPolicyInput {
  id: string
  name: string
  consentMode: 'explicit' | 'disabled'
  ttlDays: number
}
