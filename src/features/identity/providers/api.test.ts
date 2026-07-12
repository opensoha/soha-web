import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createIdentityOIDCClient,
  createIdentityProvider,
  deleteIdentityOIDCClient,
  deleteIdentityProvider,
  getIdentityProvider,
  listIdentityOIDCClients,
  listIdentityProviders,
  updateIdentityOIDCClient,
  updateIdentityProvider,
} from './api'
import type {
  IdentityOIDCClient,
  IdentityOIDCClientInput,
  IdentityProvider,
  IdentityProviderInput,
} from './types'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

const provider: IdentityProvider = {
  id: 'provider/id',
  applicationId: 'grafana',
  name: 'Grafana OIDC',
  type: 'oidc',
  enabled: true,
  status: 'enabled',
  createdAt: '2026-07-10T00:00:00Z',
  updatedAt: '2026-07-10T00:00:00Z',
}

const providerInput: IdentityProviderInput = {
  applicationId: provider.applicationId,
  name: provider.name,
  type: provider.type,
  enabled: provider.enabled,
  config: {},
  secretRefs: {},
  status: provider.status,
}

const client: IdentityOIDCClient = {
  id: 'client/id',
  providerId: provider.id,
  clientId: 'grafana',
  redirectUris: ['https://grafana.example/login'],
  allowedScopes: ['openid'],
  allowedGrantTypes: ['authorization_code'],
  requirePkce: true,
  accessTokenTtlSeconds: 3600,
  idTokenTtlSeconds: 300,
  refreshTokenTtlSeconds: 0,
  status: 'enabled',
  createdAt: '2026-07-10T00:00:00Z',
  updatedAt: '2026-07-10T00:00:00Z',
}

const clientInput: IdentityOIDCClientInput = {
  clientId: client.clientId,
  redirectUris: client.redirectUris,
  allowedScopes: client.allowedScopes,
  allowedGrantTypes: client.allowedGrantTypes,
  requirePkce: client.requirePkce,
  accessTokenTtlSeconds: client.accessTokenTtlSeconds,
  idTokenTtlSeconds: client.idTokenTtlSeconds,
  refreshTokenTtlSeconds: client.refreshTokenTtlSeconds,
  status: client.status,
}

describe('identity providers api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('normalizes every backend list filter and unwraps provider data', async () => {
    apiMocks.get.mockResolvedValueOnce({ data: [provider] })

    await expect(
      listIdentityProviders({
        applicationId: ' grafana ',
        type: 'oidc',
        status: 'enabled',
        limit: 25.9,
        offset: 50,
      }),
    ).resolves.toEqual([provider])
    expect(apiMocks.get).toHaveBeenCalledWith(
      '/identity/providers?applicationId=grafana&type=oidc&status=enabled&limit=25&offset=50',
    )
  })

  it('tolerates empty provider and OIDC client list envelopes', async () => {
    apiMocks.get.mockResolvedValueOnce({}).mockResolvedValueOnce({})

    await expect(listIdentityProviders()).resolves.toEqual([])
    await expect(listIdentityOIDCClients(' provider/id ')).resolves.toEqual([])
    expect(apiMocks.get).toHaveBeenNthCalledWith(1, '/identity/providers')
    expect(apiMocks.get).toHaveBeenNthCalledWith(
      2,
      '/identity/providers/provider%2Fid/oidc-clients',
    )
  })

  it('unwraps provider detail/create/update and encodes trimmed ids', async () => {
    apiMocks.get.mockResolvedValueOnce({ data: provider })
    apiMocks.post.mockResolvedValueOnce({ data: provider })
    apiMocks.put.mockResolvedValueOnce({ data: provider })

    await expect(getIdentityProvider(' provider/id ')).resolves.toBe(provider)
    await expect(createIdentityProvider(providerInput)).resolves.toBe(provider)
    await expect(
      updateIdentityProvider({ providerId: ' provider/id ', input: providerInput }),
    ).resolves.toBe(provider)

    expect(apiMocks.get).toHaveBeenCalledWith('/identity/providers/provider%2Fid')
    expect(apiMocks.post).toHaveBeenCalledWith('/identity/providers', providerInput)
    expect(apiMocks.put).toHaveBeenCalledWith('/identity/providers/provider%2Fid', providerInput)
  })

  it('preserves the one-time OIDC secret and unwraps client updates', async () => {
    const created = { client, clientSecret: 'shown-once' }
    apiMocks.post.mockResolvedValueOnce({ data: created })
    apiMocks.put.mockResolvedValueOnce({ data: client })

    await expect(
      createIdentityOIDCClient({ providerId: ' provider/id ', input: clientInput }),
    ).resolves.toBe(created)
    await expect(
      updateIdentityOIDCClient({
        providerId: provider.id,
        clientId: ' client/id ',
        input: clientInput,
      }),
    ).resolves.toBe(client)

    expect(apiMocks.post).toHaveBeenCalledWith(
      '/identity/providers/provider%2Fid/oidc-clients',
      clientInput,
    )
    expect(apiMocks.put).toHaveBeenCalledWith('/identity/oidc-clients/client%2Fid', clientInput)
  })

  it('keeps provider and client delete transport results out of the domain', async () => {
    apiMocks.delete.mockResolvedValue({ data: { status: 'ok' } })

    await expect(deleteIdentityProvider(' provider/id ')).resolves.toBeUndefined()
    await expect(
      deleteIdentityOIDCClient({ providerId: provider.id, clientId: ' client/id ' }),
    ).resolves.toBeUndefined()

    expect(apiMocks.delete).toHaveBeenNthCalledWith(1, '/identity/providers/provider%2Fid')
    expect(apiMocks.delete).toHaveBeenNthCalledWith(2, '/identity/oidc-clients/client%2Fid')
  })
})
