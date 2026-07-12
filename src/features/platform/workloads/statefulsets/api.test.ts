import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteStatefulSet,
  getStatefulSetDetail,
  getStatefulSetMetrics,
  listStatefulSetEvents,
  listStatefulSetPods,
  listStatefulSets,
  restartStatefulSet,
  scaleStatefulSet,
} from './api'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

const scope = { clusterId: 'cluster-a', namespace: 'team/a' }
const target = { scope, name: 'db/server' }

describe('statefulset api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('unwraps list, detail, and metrics endpoints', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: [{ name: 'db/server' }] })
      .mockResolvedValueOnce({ data: { name: 'db/server', namespace: 'team/a' } })
      .mockResolvedValueOnce({ data: { resourceKind: 'StatefulSet' } })

    await expect(listStatefulSets(scope)).resolves.toEqual([{ name: 'db/server' }])
    await expect(getStatefulSetDetail(target)).resolves.toMatchObject({ name: 'db/server' })
    await expect(getStatefulSetMetrics(target)).resolves.toMatchObject({
      resourceKind: 'StatefulSet',
    })

    expect(apiMocks.get.mock.calls[0][0]).toBe(
      '/clusters/cluster-a/workloads/statefulsets?namespace=team%2Fa',
    )
    expect(apiMocks.get.mock.calls[1][0]).toContain('/statefulsets/db%2Fserver/detail?')
    expect(apiMocks.get.mock.calls[2][0]).toContain('/statefulsets/db%2Fserver/metrics?')
  })

  it('filters shared events and pods by kind and selector', async () => {
    apiMocks.get
      .mockResolvedValueOnce({
        data: [
          { involvedKind: 'StatefulSet', involvedName: 'db/server' },
          { involvedKind: 'Pod', involvedName: 'db/server' },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          { name: 'matched', labels: { app: 'db', tier: 'data' } },
          { name: 'other', labels: { app: 'api' } },
        ],
      })

    await expect(listStatefulSetEvents(target)).resolves.toEqual([
      { involvedKind: 'StatefulSet', involvedName: 'db/server' },
    ])
    await expect(listStatefulSetPods(target, { app: 'db', tier: 'data' })).resolves.toEqual([
      { name: 'matched', labels: { app: 'db', tier: 'data' } },
    ])
    expect(apiMocks.get.mock.calls[0][0]).toContain('/events?namespace=team%2Fa&limit=100')
    expect(apiMocks.get.mock.calls[1][0]).toBe(
      '/clusters/cluster-a/workloads/pods?namespace=team%2Fa',
    )
  })

  it('preserves action request bodies and encoded delete paths', async () => {
    apiMocks.post.mockResolvedValue({ data: null })
    apiMocks.delete.mockResolvedValue({ data: null })

    await expect(restartStatefulSet(target)).resolves.toBeUndefined()
    await expect(scaleStatefulSet({ ...target, replicas: 3 })).resolves.toBeUndefined()
    await expect(deleteStatefulSet(target)).resolves.toBeUndefined()

    expect(apiMocks.post).toHaveBeenNthCalledWith(
      1,
      '/clusters/cluster-a/workloads/statefulsets/restart',
      { namespace: 'team/a', name: 'db/server' },
    )
    expect(apiMocks.post).toHaveBeenNthCalledWith(
      2,
      '/clusters/cluster-a/workloads/statefulsets/scale',
      { namespace: 'team/a', name: 'db/server', replicas: 3 },
    )
    expect(apiMocks.delete).toHaveBeenCalledWith(
      '/clusters/cluster-a/workloads/statefulsets/db%2Fserver?namespace=team%2Fa',
    )
  })

  it('requires a namespace for actions', async () => {
    await expect(
      restartStatefulSet({ scope: { clusterId: 'cluster-a', namespace: null }, name: 'db' }),
    ).rejects.toThrow('A namespace is required')
    expect(apiMocks.post).not.toHaveBeenCalled()
  })
})
