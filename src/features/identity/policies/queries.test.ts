import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { identityPolicyKeys } from './keys'
import { identityPolicyQueries } from './queries'

const apiMocks = vi.hoisted(() => ({
  getIdentityPolicy: vi.fn(),
  listIdentityPolicies: vi.fn(),
}))

vi.mock('./api', () => apiMocks)

describe('identity policy query options', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps normalized list filters with their key and query function', async () => {
    apiMocks.listIdentityPolicies.mockResolvedValueOnce([{ applicationId: 'grafana' }])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const options = identityPolicyQueries.list({ query: ' Grafana ', limit: 10.9 })

    await expect(queryClient.fetchQuery(options)).resolves.toEqual([{ applicationId: 'grafana' }])
    expect(options.queryKey).toEqual(identityPolicyKeys.list({ query: 'Grafana', limit: 10 }))
    expect(apiMocks.listIdentityPolicies).toHaveBeenCalledWith({ query: 'Grafana', limit: 10 })
  })

  it('normalizes detail ids and disables empty identifiers', async () => {
    apiMocks.getIdentityPolicy.mockResolvedValueOnce({ applicationId: 'grafana/id' })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    await expect(
      queryClient.fetchQuery(identityPolicyQueries.detail(' grafana/id ')),
    ).resolves.toEqual({ applicationId: 'grafana/id' })
    expect(apiMocks.getIdentityPolicy).toHaveBeenCalledWith('grafana/id')
    expect(identityPolicyQueries.detail(' ').enabled).toBe(false)
  })
})
