import type { ObservabilityPayloadMap } from '../shared/types'

export type AlertRuleDatasourceSelector = ObservabilityPayloadMap
export type AlertRuleQuerySpec = ObservabilityPayloadMap
export type AlertRuleThresholdSpec = ObservabilityPayloadMap
export type AlertRuleTestResult = ObservabilityPayloadMap

export interface AlertRuleTextMap {
  [key: string]: string
}

export interface AlertRule {
  id: string
  name: string
  ruleType: string
  datasourceSelector?: AlertRuleDatasourceSelector
  querySpec?: AlertRuleQuerySpec
  thresholdSpec?: AlertRuleThresholdSpec
  forSeconds: number
  groupBy?: string[]
  labels?: AlertRuleTextMap
  annotations?: AlertRuleTextMap
  notificationPolicyId?: string
  healingPolicyIds?: string[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AlertRuleRun {
  id: string
  status: string
  matched: boolean
  summary?: string
  durationMs: number
  error?: string
  createdAt: string
}

export interface AlertRuleFormValues {
  id?: string
  name: string
  ruleType: string
  datasourceSelector: string
  querySpec: string
  thresholdSpec: string
  forSeconds: number
  groupBy: string
  labels: string
  annotations: string
  notificationPolicyId?: string
  healingPolicyIds: string[]
  enabled: boolean
}

export interface AlertRulePayload {
  id?: string
  name: string
  ruleType: string
  datasourceSelector: AlertRuleDatasourceSelector
  querySpec: AlertRuleQuerySpec
  thresholdSpec: AlertRuleThresholdSpec
  forSeconds: number
  groupBy: string[]
  labels: ObservabilityPayloadMap
  annotations: ObservabilityPayloadMap
  notificationPolicyId: string
  healingPolicyIds: string[]
  enabled: boolean
}

export interface NotificationPolicyOption {
  id: string
  name: string
  enabled: boolean
}

export interface HealingPolicyOption {
  id: string
  name: string
  enabled: boolean
}

export interface UpdateAlertRuleInput {
  id: string
  payload: AlertRulePayload
}

export interface TestAlertRuleInput {
  id: string
  payload: AlertRulePayload
}
