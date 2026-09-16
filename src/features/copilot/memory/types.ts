import type { ProductionRecord } from '../production/operations-page'
export interface MemoryRecord extends ProductionRecord {
  ownerType: string
  ownerId: string
  scopeHash: string
  fact: string
  sourceType: 'explicit_user' | 'curated_extractor'
  sourceRefs: string[]
  confidence: number
  validFrom: string
  expiresAt?: string
  policyVersion: string
  policyId?: string
  status: string
  createdAt: string
}
export interface MemoryPolicy extends ProductionRecord {
  version: string
  ownerTypes: string[]
  defaultTtl: number
  maximumTtl: number
  minimumConfidence: number
  explicitWriteOnly: boolean
  enabled: boolean
}
export interface CreateMemoryPolicyInput {
  id: string
  name: string
  consentMode: 'explicit' | 'disabled'
  ttlDays: number
}
