import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toScopeKey } from '@/types'
import { getServiceMetrics, listServiceBackendPods, listServiceEvents } from './api'

const apiMocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

describe('service API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unwraps and filters backend pods by the Service selector', async () => {
    const scope = toScopeKey('cluster-a', 'team-a')
    apiMocks.get.mockResolvedValue({
      data: [
        { name: 'api-1', labels: { app: 'api', tier: 'web' } },
        { name: 'worker-1', labels: { app: 'worker', tier: 'jobs' } },
      ],
    })

    await expect(listServiceBackendPods(scope, { app: 'api', tier: 'web' })).resolves.toEqual([
      { name: 'api-1', labels: { app: 'api', tier: 'web' } },
    ])
    expect(apiMocks.get).toHaveBeenCalledWith('/clusters/cluster-a/workloads/pods?namespace=team-a')
  })

  it('uses the existing metrics and events endpoints and returns domain values', async () => {
    const scope = toScopeKey('cluster-a', 'team-a')
    const metrics = { resourceKind: 'Service', resourceName: 'api', rangeMinutes: 60 }
    apiMocks.get.mockResolvedValueOnce({ data: metrics }).mockResolvedValueOnce({
      data: [
        { name: 'a', involvedKind: 'Service', involvedName: 'api' },
        { name: 'b', involvedKind: 'Ingress', involvedName: 'api' },
      ],
    })

    await expect(getServiceMetrics(scope, 'api')).resolves.toBe(metrics)
    await expect(listServiceEvents(scope, 'api')).resolves.toEqual([
      { name: 'a', involvedKind: 'Service', involvedName: 'api' },
    ])
    expect(apiMocks.get).toHaveBeenNthCalledWith(
      1,
      '/clusters/cluster-a/network/services/api/metrics?namespace=team-a',
    )
    expect(apiMocks.get).toHaveBeenNthCalledWith(
      2,
      '/clusters/cluster-a/events?namespace=team-a&limit=100',
    )
  })
})
