import {
  emptyPayloadMap,
  isObservabilityPayloadMap,
  parseObservabilityJson,
  toText,
} from '../shared/json'
import type { AlertRule, AlertRuleFormValues, AlertRulePayload } from './types'

function payloadMapFromField(value: unknown) {
  if (typeof value === 'string') return parseObservabilityJson(value, emptyPayloadMap())
  if (isObservabilityPayloadMap(value)) return value
  return emptyPayloadMap()
}

function stringListFromField(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export function prettyObservabilityJson(value: unknown) {
  if (value == null) return ''
  return JSON.stringify(value, null, 2)
}

export function buildAlertRulePayload(
  values: Partial<AlertRuleFormValues> | Partial<AlertRule>,
): AlertRulePayload {
  return {
    id: typeof values.id === 'string' ? values.id : undefined,
    name: toText(values.name),
    ruleType: toText(values.ruleType || 'metrics'),
    datasourceSelector: payloadMapFromField(values.datasourceSelector),
    querySpec: payloadMapFromField(values.querySpec),
    thresholdSpec: payloadMapFromField(values.thresholdSpec),
    forSeconds: Number(values.forSeconds ?? 0),
    groupBy: stringListFromField(values.groupBy),
    labels: payloadMapFromField(values.labels),
    annotations: payloadMapFromField(values.annotations),
    notificationPolicyId: toText(values.notificationPolicyId),
    healingPolicyIds: stringListFromField(values.healingPolicyIds),
    enabled: Boolean(values.enabled),
  }
}
