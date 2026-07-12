import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workloadKeys } from '@/features/platform/workloads/shared/keys'
import { statefulSetQueries } from './queries'

const apiMocks = vi.hoisted(() => ({
  getStatefulSetDetail: vi.fn(),
  getStatefulSetMetrics: vi.fn(),
  listStatefulSetEvents: vi.fn(),
  listStatefulSetPods: vi.fn(),
  listStatefulSets: vi.fn(),
}))

vi.mock('./api', () => apiMocks)

const scope = { clusterId: 'cluster-a', namespace: 'team-a' }

describe('statefulset query options', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses canonical keys and scope guards', () => {
    expect(statefulSetQueries.list(scope).queryKey).toEqual(
      workloadKeys.list('statefulsets', scope),
    )
    expect(statefulSetQueries.list({ clusterId: null, namespace: null }).enabled).toBe(false)
    expect(statefulSetQueries.detail(scope, 'db').enabled).toBe(true)
    expect(
      statefulSetQueries.detail({ clusterId: 'cluster-a', namespace: null }, 'db').enabled,
    ).toBe(false)
    expect(statefulSetQueries.pods(scope, 'db', {}).enabled).toBe(false)
  })

  it('keeps selector and target in the related pods query', async () => {
    apiMocks.listStatefulSetPods.mockResolvedValueOnce([{ name: 'db-0' }])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const selector = { app: 'db' }

    await expect(
      queryClient.fetchQuery(statefulSetQueries.pods(scope, 'db', selector)),
    ).resolves.toEqual([{ name: 'db-0' }])
    expect(apiMocks.listStatefulSetPods).toHaveBeenCalledWith({ scope, name: 'db' }, selector)
    expect(statefulSetQueries.pods(scope, 'db', selector).queryKey).toEqual(
      workloadKeys.relatedPods('statefulsets', scope, 'db', selector),
    )
  })
})
