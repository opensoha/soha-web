import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workloadKeys } from '@/features/platform/workloads/shared/keys'
import { daemonSetQueries } from './queries'

const apiMocks = vi.hoisted(() => ({
  getDaemonSetDetail: vi.fn(),
  getDaemonSetMetrics: vi.fn(),
  listDaemonSetEvents: vi.fn(),
  listDaemonSetPods: vi.fn(),
  listDaemonSets: vi.fn(),
}))

vi.mock('./api', () => apiMocks)

const scope = { clusterId: 'cluster-a', namespace: 'team-a' }

describe('daemonset query options', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses canonical keys and scope guards', () => {
    expect(daemonSetQueries.list(scope).queryKey).toEqual(workloadKeys.list('daemonsets', scope))
    expect(daemonSetQueries.list({ clusterId: null, namespace: null }).enabled).toBe(false)
    expect(daemonSetQueries.detail(scope, 'agent').enabled).toBe(true)
    expect(
      daemonSetQueries.detail({ clusterId: 'cluster-a', namespace: null }, 'agent').enabled,
    ).toBe(false)
    expect(daemonSetQueries.pods(scope, 'agent', {}).enabled).toBe(false)
  })

  it('keeps selector and target in the related pods query', async () => {
    apiMocks.listDaemonSetPods.mockResolvedValueOnce([{ name: 'agent-1' }])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const selector = { app: 'agent' }

    await expect(
      queryClient.fetchQuery(daemonSetQueries.pods(scope, 'agent', selector)),
    ).resolves.toEqual([{ name: 'agent-1' }])
    expect(apiMocks.listDaemonSetPods).toHaveBeenCalledWith({ scope, name: 'agent' }, selector)
    expect(daemonSetQueries.pods(scope, 'agent', selector).queryKey).toEqual(
      workloadKeys.relatedPods('daemonsets', scope, 'agent', selector),
    )
  })
})
