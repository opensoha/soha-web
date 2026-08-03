import { describe, expect, it } from 'vitest'
import { observabilityScope, summarizeServices } from './model'

describe('observability signal model', () => {
  it('normalizes optional scope and summarizes services by operational impact', () => {
    expect(observabilityScope(' cluster ', '', ' checkout ', '')).toEqual({
      clusterId: 'cluster',
      namespace: undefined,
      service: 'checkout',
      workload: undefined,
    })
    expect(observabilityScope(null, null)).toBeUndefined()
    expect(
      summarizeServices([
        {
          traceId: 'trace-1',
          spanId: 'span-1',
          operation: 'GET',
          service: 'catalog',
          durationMs: 120,
          startTime: '2026-08-03T00:00:00Z',
          tags: {},
          error: false,
        },
        {
          traceId: 'trace-2',
          spanId: 'span-2',
          operation: 'POST',
          service: 'checkout',
          durationMs: 300,
          startTime: '2026-08-03T00:00:01Z',
          tags: {},
          error: true,
        },
        {
          traceId: 'trace-3',
          spanId: 'span-3',
          operation: 'POST',
          service: 'checkout',
          durationMs: 180,
          startTime: '2026-08-03T00:00:02Z',
          tags: {},
          error: false,
        },
      ]),
    ).toEqual([
      { errorSpans: 1, key: 'checkout', maxDurationMs: 300, service: 'checkout', spans: 2 },
      { errorSpans: 0, key: 'catalog', maxDurationMs: 120, service: 'catalog', spans: 1 },
    ])
  })
})
