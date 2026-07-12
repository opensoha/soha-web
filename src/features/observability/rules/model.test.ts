import { describe, expect, it } from 'vitest'
import { buildAlertRulePayload } from './model'

describe('alert rule model', () => {
  it('parses JSON form fields and comma-separated group labels', () => {
    expect(
      buildAlertRulePayload({
        name: 'CPU High',
        ruleType: 'metrics',
        datasourceSelector: '{"source":"prometheus"}',
        querySpec: '{"metricKey":"cpu_usage"}',
        thresholdSpec: '{"operator":"gt","value":90}',
        forSeconds: 60,
        groupBy: 'cluster, namespace',
        labels: '{"severity":"critical"}',
        annotations: '{"summary":"CPU high"}',
        healingPolicyIds: ['heal-1'],
        enabled: true,
      }),
    ).toMatchObject({
      datasourceSelector: { source: 'prometheus' },
      groupBy: ['cluster', 'namespace'],
      labels: { severity: 'critical' },
    })
  })
})
