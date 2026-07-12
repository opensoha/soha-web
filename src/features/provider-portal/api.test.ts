import { beforeEach, describe, expect, it, vi } from 'vitest'
import { providerPortalApi } from './api'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

describe('providerPortalApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('unwraps bootstrap, application lists, and application detail responses', async () => {
    const bootstrap = { applications: [], categories: [] }
    const applications = [{ id: 'app-1', name: 'Console' }]
    const application = { id: 'app/1', name: 'Console' }
    apiMocks.get
      .mockResolvedValueOnce({ data: bootstrap })
      .mockResolvedValueOnce({ data: applications })
      .mockResolvedValueOnce({ data: application })

    await expect(providerPortalApi.bootstrap()).resolves.toBe(bootstrap)
    await expect(providerPortalApi.applications()).resolves.toBe(applications)
    await expect(providerPortalApi.application('app/1')).resolves.toBe(application)

    expect(apiMocks.get).toHaveBeenNthCalledWith(1, '/portal/bootstrap')
    expect(apiMocks.get).toHaveBeenNthCalledWith(2, '/portal/applications')
    expect(apiMocks.get).toHaveBeenNthCalledWith(3, '/portal/applications/app%2F1')
  })

  it('unwraps launch and favorite responses while returning void for unfavorite', async () => {
    const decision = { launchUrl: 'https://console.example.test' }
    const favorite = { id: 'app/1', favorite: true }
    apiMocks.post
      .mockResolvedValueOnce({ data: decision })
      .mockResolvedValueOnce({ data: favorite })
    apiMocks.delete.mockResolvedValueOnce({ data: { status: 'ok' } })

    await expect(providerPortalApi.launch('app/1')).resolves.toBe(decision)
    await expect(providerPortalApi.favorite('app/1')).resolves.toBe(favorite)
    await expect(providerPortalApi.unfavorite('app/1')).resolves.toBeUndefined()

    expect(apiMocks.post).toHaveBeenNthCalledWith(1, '/portal/applications/app%2F1/launch')
    expect(apiMocks.post).toHaveBeenNthCalledWith(2, '/portal/applications/app%2F1/favorite')
    expect(apiMocks.delete).toHaveBeenCalledWith('/portal/applications/app%2F1/favorite')
  })

  it('preserves recent and security wire paths and normalizes missing lists', async () => {
    const security = { activeSession: 2 }
    apiMocks.get.mockResolvedValueOnce({}).mockResolvedValueOnce({ data: security })

    await expect(providerPortalApi.recent(6)).resolves.toEqual([])
    await expect(providerPortalApi.security()).resolves.toBe(security)

    expect(apiMocks.get).toHaveBeenNthCalledWith(1, '/portal/recent?limit=6')
    expect(apiMocks.get).toHaveBeenNthCalledWith(2, '/portal/security')
  })
})
