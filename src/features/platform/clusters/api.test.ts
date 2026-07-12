import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCluster,
  deleteCluster,
  getClusterDetail,
  listClusterNodes,
  listClusters,
  updateCluster,
} from './api'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

const scope = { clusterId: 'cluster/a', namespace: null }

describe('cluster api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('unwraps list, detail, and node snapshot responses', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: [{ id: 'cluster/a' }] })
      .mockResolvedValueOnce({ data: { summary: { id: 'cluster/a' } } })
      .mockResolvedValueOnce({ data: [{ name: 'node-a' }] })

    await expect(listClusters()).resolves.toEqual([{ id: 'cluster/a' }])
    await expect(getClusterDetail({ scope })).resolves.toMatchObject({
      summary: { id: 'cluster/a' },
    })
    await expect(listClusterNodes({ scope })).resolves.toEqual([{ name: 'node-a' }])

    expect(apiMocks.get).toHaveBeenNthCalledWith(1, '/clusters')
    expect(apiMocks.get).toHaveBeenNthCalledWith(2, '/clusters/cluster%2Fa/detail')
    expect(apiMocks.get).toHaveBeenNthCalledWith(3, '/clusters/cluster%2Fa/infrastructure/nodes')
  })

  it('preserves create and update payloads while unwrapping entities', async () => {
    const values = { name: 'demo', labels: { provider: 'gke' } }
    apiMocks.post.mockResolvedValueOnce({ data: { id: 'created' } })
    apiMocks.put.mockResolvedValueOnce({ data: { id: 'cluster/a' } })

    await expect(createCluster(values)).resolves.toEqual({ id: 'created' })
    await expect(updateCluster({ scope, values })).resolves.toEqual({ id: 'cluster/a' })
    expect(apiMocks.post).toHaveBeenCalledWith('/clusters', values)
    expect(apiMocks.put).toHaveBeenCalledWith('/clusters/cluster%2Fa', values)
  })

  it('returns void for deletes and rejects an empty cluster scope', async () => {
    apiMocks.delete.mockResolvedValueOnce({ data: { deleted: true } })

    await expect(deleteCluster({ scope })).resolves.toBeUndefined()
    expect(apiMocks.delete).toHaveBeenCalledWith('/clusters/cluster%2Fa')
    await expect(getClusterDetail({ scope: { clusterId: null, namespace: null } })).rejects.toThrow(
      'A cluster is required',
    )
  })
})
