import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workloadKeys } from '../shared/keys'
import { podQueries } from './queries'

const apiMocks = vi.hoisted(() => ({
  getPodDetail: vi.fn(),
  getPodMetrics: vi.fn(),
  listPodEvents: vi.fn(),
  listPods: vi.fn(),
}))

vi.mock('./api', () => apiMocks)

const scope = { clusterId: 'cluster-a', namespace: 'team-a' }

describe('pod query options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses workload keys and permits all-namespace list scope', () => {
    expect(podQueries.list(scope).queryKey).toEqual(workloadKeys.list('pods', scope))
    expect(podQueries.list({ clusterId: 'cluster-a', namespace: null }).enabled).toBe(true)
    expect(podQueries.list({ clusterId: null, namespace: null }).enabled).toBe(false)
    expect(podQueries.detail(scope, 'api-pod').enabled).toBe(true)
    expect(podQueries.detail({ clusterId: 'cluster-a', namespace: null }, 'api-pod').enabled).toBe(
      false,
    )
  })

  it('keeps range and target scope in the metrics query', async () => {
    apiMocks.getPodMetrics.mockResolvedValueOnce({ rangeMinutes: 30 })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    await expect(queryClient.fetchQuery(podQueries.metrics(scope, 'api-pod', 30))).resolves.toEqual(
      { rangeMinutes: 30 },
    )
    expect(apiMocks.getPodMetrics).toHaveBeenCalledWith({ scope, name: 'api-pod' }, 30)
    expect(podQueries.metrics(scope, 'api-pod', 30).queryKey).toEqual(
      workloadKeys.metrics('pods', scope, 'api-pod', 30),
    )
  })

  it('binds events to the pod target', async () => {
    apiMocks.listPodEvents.mockResolvedValueOnce([{ name: 'scheduled' }])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    await expect(queryClient.fetchQuery(podQueries.events(scope, 'api-pod'))).resolves.toEqual([
      { name: 'scheduled' },
    ])
    expect(apiMocks.listPodEvents).toHaveBeenCalledWith({ scope, name: 'api-pod' })
  })
})
