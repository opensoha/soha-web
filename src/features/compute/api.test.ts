import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({ getEnvelope: vi.fn() }))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

import { computeApi } from './api'

describe('compute api', () => {
  beforeEach(() => apiMocks.getEnvelope.mockReset())

  it('uses canonical contract endpoints and omits empty filters', async () => {
    apiMocks.getEnvelope.mockResolvedValue({ items: [] })

    await computeApi.overview()
    await computeApi.accessSources({ sourceType: 'runtime_host', providerKey: '', limit: 50 })
    await computeApi.tasks({
      domain: 'container_runtime',
      status: 'failed',
      category: 'operation',
    })

    expect(apiMocks.getEnvelope).toHaveBeenNthCalledWith(1, '/compute/overview')
    expect(apiMocks.getEnvelope).toHaveBeenNthCalledWith(
      2,
      '/compute/access-sources?sourceType=runtime_host&limit=50',
    )
    expect(apiMocks.getEnvelope).toHaveBeenNthCalledWith(
      3,
      '/compute/tasks?domain=container_runtime&status=failed&category=operation',
    )
  })
})
