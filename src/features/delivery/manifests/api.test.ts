import { beforeEach, describe, expect, it, vi } from 'vitest'
import { manifestApi } from './api'
import type { ManifestPackageInput } from './types'

const apiMocks = vi.hoisted(() => ({ delete: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/services/api-client', () => ({ api: apiMocks }))

describe('manifestApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('encodes scope filters and identifiers', async () => {
    apiMocks.get.mockResolvedValue({ data: [] })
    await manifestApi.list({
      applicationId: 'app/a',
      clusterId: 'dev cluster',
      namespace: 'team-a',
    })
    await manifestApi.revisions('package/a')

    expect(apiMocks.get.mock.calls.map(([path]) => path)).toEqual([
      '/delivery/manifest-packages?applicationId=app%2Fa&clusterId=dev+cluster&namespace=team-a',
      '/delivery/manifest-packages/package%2Fa/revisions',
    ])
  })

  it('preserves package and publish payloads', async () => {
    apiMocks.post.mockResolvedValue({ data: { id: 'manifest-1' } })
    const input = {
      name: 'Ingress',
      applicationId: 'app-1',
      renderer: 'raw_yaml',
      files: [],
      bindings: [],
    } satisfies ManifestPackageInput

    await manifestApi.create(input)
    await manifestApi.publish('manifest/1', 'promote host')

    expect(apiMocks.post).toHaveBeenNthCalledWith(1, '/delivery/manifest-packages', input)
    expect(apiMocks.post).toHaveBeenNthCalledWith(
      2,
      '/delivery/manifest-packages/manifest%2F1/publish',
      { note: 'promote host' },
    )
  })
})
