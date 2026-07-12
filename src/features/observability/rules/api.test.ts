import { beforeEach, describe, expect, it, vi } from 'vitest'
import { observabilityRuleApi } from './api'

const apiMocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/services/api-client', () => ({ api: apiMocks }))

describe('alert rule api', () => {
  beforeEach(() => vi.clearAllMocks())
  it('preserves list, dependent option and encoded runs endpoints', async () => {
    apiMocks.get.mockResolvedValue({ data: [] })
    await Promise.all([
      observabilityRuleApi.list(),
      observabilityRuleApi.runs('rule/a'),
      observabilityRuleApi.notificationPolicies(),
      observabilityRuleApi.healingPolicies(),
    ])
    expect(apiMocks.get.mock.calls.map(([path]) => path)).toEqual([
      '/alert-rules',
      '/alert-rule-runs?ruleId=rule%2Fa',
      '/notification-policies',
      '/healing-policies',
    ])
  })
})
