import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type {
  AlertRule,
  AlertRulePayload,
  AlertRuleRun,
  AlertRuleTestResult,
  HealingPolicyOption,
  NotificationPolicyOption,
  TestAlertRuleInput,
  UpdateAlertRuleInput,
} from './types'

async function unwrapList<T>(request: Promise<ApiResponse<T[]>>): Promise<T[]> {
  const response = await request
  return response.data ?? []
}

async function unwrapItem<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request
  return response.data
}

export const observabilityRuleApi = {
  list: () => unwrapList(api.get<ApiResponse<AlertRule[]>>('/alert-rules')),
  detail: (ruleId: string) =>
    unwrapItem(api.get<ApiResponse<AlertRule>>(`/alert-rules/${encodeURIComponent(ruleId)}`)),
  runs: (ruleId: string) =>
    unwrapList(
      api.get<ApiResponse<AlertRuleRun[]>>(`/alert-rule-runs?ruleId=${encodeURIComponent(ruleId)}`),
    ),
  notificationPolicies: () =>
    unwrapList(api.get<ApiResponse<NotificationPolicyOption[]>>('/notification-policies')),
  healingPolicies: () =>
    unwrapList(api.get<ApiResponse<HealingPolicyOption[]>>('/healing-policies')),
  create: (payload: AlertRulePayload) =>
    unwrapItem(api.post<ApiResponse<AlertRule>>('/alert-rules', payload)),
  update: ({ id, payload }: UpdateAlertRuleInput) =>
    unwrapItem(api.put<ApiResponse<AlertRule>>(`/alert-rules/${encodeURIComponent(id)}`, payload)),
  test: ({ id, payload }: TestAlertRuleInput) =>
    unwrapItem(
      api.post<ApiResponse<AlertRuleTestResult>>(
        `/alert-rules/${encodeURIComponent(id)}/test`,
        payload,
      ),
    ),
}
