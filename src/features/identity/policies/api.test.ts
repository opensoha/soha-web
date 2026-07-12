import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getIdentityPolicy, listIdentityPolicies, updateIdentityPolicy } from './api'
import type { IdentityApplicationPolicy, IdentityApplicationPolicyInput } from './types'

const apiMocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

const policy: IdentityApplicationPolicy = {
  applicationId: 'grafana/id',
  applicationSlug: 'grafana',
  applicationName: 'Grafana',
  providerType: 'oidc',
  portalVisible: true,
  status: 'enabled',
  assignments: [{ subjectType: 'role', subjectId: 'admin', effect: 'allow' }],
  updatedAt: '2026-07-10T00:00:00Z',
}

const input: IdentityApplicationPolicyInput = { assignments: policy.assignments }

describe('identity policies api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('normalizes backend list filters and unwraps policy data', async () => {
    apiMocks.get.mockResolvedValueOnce({ data: [policy] })

    await expect(
      listIdentityPolicies({
        query: ' Grafana ',
        status: 'enabled',
        limit: 25.9,
        offset: 50,
      }),
    ).resolves.toEqual([policy])
    expect(apiMocks.get).toHaveBeenCalledWith(
      '/identity/policies?q=Grafana&status=enabled&limit=25&offset=50',
    )
  })

  it('tolerates an empty list envelope', async () => {
    apiMocks.get.mockResolvedValueOnce({})

    await expect(listIdentityPolicies()).resolves.toEqual([])
    expect(apiMocks.get).toHaveBeenCalledWith('/identity/policies')
  })

  it('unwraps detail/update values and encodes trimmed application ids', async () => {
    apiMocks.get.mockResolvedValueOnce({ data: policy })
    apiMocks.put.mockResolvedValueOnce({ data: policy })

    await expect(getIdentityPolicy(' grafana/id ')).resolves.toBe(policy)
    await expect(updateIdentityPolicy({ applicationId: ' grafana/id ', input })).resolves.toBe(
      policy,
    )

    expect(apiMocks.get).toHaveBeenCalledWith('/identity/policies/grafana%2Fid')
    expect(apiMocks.put).toHaveBeenCalledWith('/identity/policies/grafana%2Fid', input)
  })
})
