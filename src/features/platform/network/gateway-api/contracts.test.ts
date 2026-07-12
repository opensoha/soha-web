import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toScopeKey } from '@/types'
import { getGatewayAPIResource, listGatewayAPIResources } from './api'
import { gatewayAPIKeys } from './keys'

const apiMocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/services/api-client', () => ({ api: apiMocks }))

describe('Gateway API contracts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps GatewayClass cluster-scoped and unwraps domain data', async () => {
    const scope = toScopeKey('cluster-a', null)
    apiMocks.get.mockResolvedValue({ data: [{ name: 'traefik' }] })

    await expect(
      listGatewayAPIResources<{ name: string }>('gatewayclasses', scope),
    ).resolves.toEqual([{ name: 'traefik' }])
    expect(apiMocks.get).toHaveBeenCalledWith('/clusters/cluster-a/network/gatewayclasses')
    expect(gatewayAPIKeys.list('gatewayclasses', scope)).toEqual([
      'platform',
      'network',
      'gatewayclasses',
      'list',
      { clusterId: 'cluster-a', namespace: null },
    ])
  })

  it('keeps namespaced Gateway detail on the list wire endpoint', async () => {
    const scope = toScopeKey('cluster-a', 'team-a')
    apiMocks.get.mockResolvedValue({ data: [{ name: 'edge' }, { name: 'internal' }] })

    await expect(
      getGatewayAPIResource<{ name: string }>('gateways', scope, 'edge'),
    ).resolves.toEqual({ name: 'edge' })
    expect(apiMocks.get).toHaveBeenCalledWith(
      '/clusters/cluster-a/network/gateways?namespace=team-a',
    )
  })
})
