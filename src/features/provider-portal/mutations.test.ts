import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IdentityApplication } from '@/features/identity'
import { providerPortalApi } from './api'
import { providerPortalKeys } from './keys'
import { invalidateProviderPortalQueries, providerPortalMutations } from './mutations'

const application = { id: 'app-1', favorite: false } as IdentityApplication

function queryClientWithInvalidationSpy() {
  const queryClient = new QueryClient()
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
  return { invalidateQueries, queryClient }
}

describe('providerPortalMutations', () => {
  afterEach(() => vi.restoreAllMocks())

  it('invalidates through the stable domain root', async () => {
    const { invalidateQueries, queryClient } = queryClientWithInvalidationSpy()

    await invalidateProviderPortalQueries(queryClient)

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: providerPortalKeys.all })
  })

  it('invalidates successful launches only when a launch URL exists', async () => {
    vi.spyOn(providerPortalApi, 'launch')
      .mockResolvedValueOnce({ launchUrl: '' } as never)
      .mockResolvedValueOnce({ launchUrl: 'https://console.example.test' } as never)
    const { invalidateQueries, queryClient } = queryClientWithInvalidationSpy()
    const observer = new MutationObserver(queryClient, providerPortalMutations.launch(queryClient))

    await observer.mutate(application)
    expect(invalidateQueries).not.toHaveBeenCalled()
    await observer.mutate(application)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: providerPortalKeys.all })
  })

  it('maps favorite state to the matching API and invalidates after success', async () => {
    const favorite = vi.spyOn(providerPortalApi, 'favorite').mockResolvedValue(application)
    const unfavorite = vi.spyOn(providerPortalApi, 'unfavorite').mockResolvedValue(undefined)
    const { invalidateQueries, queryClient } = queryClientWithInvalidationSpy()
    const observer = new MutationObserver(
      queryClient,
      providerPortalMutations.toggleFavorite(queryClient),
    )

    await observer.mutate(application)
    await observer.mutate({ ...application, favorite: true })

    expect(favorite).toHaveBeenCalledWith('app-1')
    expect(unfavorite).toHaveBeenCalledWith('app-1')
    expect(invalidateQueries).toHaveBeenCalledTimes(2)
  })
})
