import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryMetrics, queryTraces } from './api'

const post = vi.hoisted(() => vi.fn())
vi.mock('@/services/api-client', () => ({ api: { post } }))

describe('observability signal api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the normalized Core query gateways', async () => {
    const metricInput = {
      metricKey: 'cpu_usage' as const,
      timeFrom: '2026-08-03T00:00:00Z',
      timeTo: '2026-08-03T00:15:00Z',
      stepSeconds: 60,
    }
    const traceInput = {
      timeFrom: '2026-08-03T00:00:00Z',
      timeTo: '2026-08-03T00:15:00Z',
      minDurationMs: 100,
      limit: 100,
    }
    post.mockResolvedValueOnce({ data: { series: [] } })
    post.mockResolvedValueOnce({ data: { services: [], spans: [] } })

    await queryMetrics(metricInput)
    await queryTraces(traceInput)

    expect(post).toHaveBeenNthCalledWith(1, '/observability/metrics/query', metricInput)
    expect(post).toHaveBeenNthCalledWith(2, '/observability/traces/query', traceInput)
  })
})
