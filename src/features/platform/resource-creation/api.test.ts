import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decideResourceCreateScope, executeResourceCreate, preflightResourceCreate } from './api'

const apiMocks = vi.hoisted(() => ({
  post: vi.fn(),
  postWithHeaders: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

describe('resource creation api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the cluster-scoped decision and preflight endpoints', async () => {
    apiMocks.post
      .mockResolvedValueOnce({ data: { allowed: true } })
      .mockResolvedValueOnce({ data: { ready: true, contentHash: 'hash', items: [] } })

    await decideResourceCreateScope('cluster/a', {
      namespace: 'minio',
      resourceGroup: 'configuration',
      apiVersion: 'v1',
      kind: 'ConfigMap',
      action: 'create',
    })
    await preflightResourceCreate('cluster/a', {
      source: 'list',
      defaultNamespace: 'minio',
      resourceGroup: 'configuration',
      expectedKind: 'ConfigMap',
      content: 'kind: ConfigMap',
    })

    expect(apiMocks.post).toHaveBeenNthCalledWith(
      1,
      '/clusters/cluster%2Fa/resource-creation/scope-decision',
      expect.objectContaining({ kind: 'ConfigMap', action: 'create' }),
    )
    expect(apiMocks.post).toHaveBeenNthCalledWith(
      2,
      '/clusters/cluster%2Fa/resource-creation/preflight',
      expect.objectContaining({ source: 'list', defaultNamespace: 'minio' }),
    )
  })

  it('sends execute idempotency as a header instead of expanding the request body', async () => {
    apiMocks.postWithHeaders.mockResolvedValue({
      data: { operationId: 'op-1', status: 'succeeded', contentHash: 'hash', items: [] },
    })
    const request = { source: 'global_yaml' as const, content: 'kind: ConfigMap' }

    await executeResourceCreate('cluster-a', request, 'request-123')

    expect(apiMocks.postWithHeaders).toHaveBeenCalledWith(
      '/clusters/cluster-a/resource-creation/execute',
      request,
      { 'Idempotency-Key': 'request-123' },
    )
  })
})
