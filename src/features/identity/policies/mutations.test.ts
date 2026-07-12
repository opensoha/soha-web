import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { providerPortalKeys } from '@/features/provider-portal'
import { identityApplicationKeys } from '../applications/keys'
import { identityPolicyKeys, identityPolicyMutationKeys } from './keys'
import { identityPolicyMutations } from './mutations'
import type { IdentityApplicationPolicyInput } from './types'

const apiMocks = vi.hoisted(() => ({ updateIdentityPolicy: vi.fn() }))

vi.mock('./api', () => apiMocks)

const input = {
  assignments: [{ subjectType: 'role', subjectId: 'admin', effect: 'allow' }],
} as IdentityApplicationPolicyInput

function queryClientWithInvalidationSpy() {
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
  return { invalidate, queryClient }
}

describe('identity policy mutation options', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses factory keys for every policy consumer invalidation', async () => {
    const policy = { applicationId: 'grafana' }
    apiMocks.updateIdentityPolicy.mockResolvedValueOnce(policy)
    const { invalidate, queryClient } = queryClientWithInvalidationSpy()
    const options = identityPolicyMutations.update(queryClient)
    const observer = new MutationObserver(queryClient, options)
    const variables = { applicationId: 'grafana', input }

    await expect(observer.mutate(variables)).resolves.toBe(policy)
    expect(options.mutationKey).toEqual(identityPolicyMutationKeys.update)
    expect(apiMocks.updateIdentityPolicy).toHaveBeenCalledWith(variables, expect.anything())
    expect(invalidate).toHaveBeenCalledTimes(4)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: identityPolicyKeys.lists() })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: identityPolicyKeys.detail('grafana') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: identityApplicationKeys.all })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: providerPortalKeys.all })
  })

  it('does not invalidate any consumer cache on update failure', async () => {
    const failure = new Error('update failed')
    apiMocks.updateIdentityPolicy.mockRejectedValueOnce(failure)
    const { invalidate, queryClient } = queryClientWithInvalidationSpy()
    const observer = new MutationObserver(queryClient, identityPolicyMutations.update(queryClient))

    await expect(observer.mutate({ applicationId: 'grafana', input })).rejects.toBe(failure)
    expect(invalidate).not.toHaveBeenCalled()
  })
})
