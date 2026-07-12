import { describe, expect, it } from 'vitest'
import {
  defaultOIDCClientValues,
  defaultProviderValues,
  oidcClientInputFromValues,
  oidcClientValuesFor,
  providerInputFromValues,
  providerValuesFor,
} from './provider-form-model'
import type { IdentityOIDCClient, IdentityProvider } from './types'

const proxyProvider: IdentityProvider = {
  id: 'proxy-1',
  applicationId: 'grafana',
  name: 'Grafana Proxy',
  type: 'proxy',
  enabled: true,
  status: 'enabled',
  config: {
    external_hosts: [' grafana.example.com ', 'grafana.example.com'],
    upstream_url: ' http://grafana:3000 ',
    protected_path_prefix: '/grafana',
    outpost_id: 'edge-1',
    skip_auth_paths: '/healthz, /public',
    websocket_enabled: true,
    header_mappings: {
      user: 'X-User',
      email: 'X-Email',
    },
    customSetting: 'preserved',
  },
  secretRefs: { clientSecret: 'secret-ref' },
  createdAt: '2026-07-10T00:00:00Z',
  updatedAt: '2026-07-10T00:00:00Z',
}

const client: IdentityOIDCClient = {
  id: 'client-1',
  providerId: 'provider-1',
  clientId: 'grafana',
  redirectUris: ['https://grafana.example/login'],
  allowedScopes: ['openid', 'email'],
  allowedGrantTypes: ['authorization_code'],
  requirePkce: true,
  accessTokenTtlSeconds: 3600,
  idTokenTtlSeconds: 300,
  refreshTokenTtlSeconds: 0,
  status: 'enabled',
  createdAt: '2026-07-10T00:00:00Z',
  updatedAt: '2026-07-10T00:00:00Z',
}

describe('provider form model', () => {
  it('keeps provider defaults aligned with current runtime behavior', () => {
    expect(defaultProviderValues()).toMatchObject({
      enabled: true,
      proxyMode: 'forward_auth',
      proxyPathPrefix: '/',
      proxyWebsocketEnabled: true,
      status: 'enabled',
      type: 'oidc',
    })
  })

  it('reads legacy proxy keys and writes one canonical config without losing advanced values', () => {
    const values = providerValuesFor(proxyProvider)
    expect(values).toMatchObject({
      proxyExternalHosts: ['grafana.example.com'],
      proxyHeaderEmail: 'X-Email',
      proxyHeaderUser: 'X-User',
      proxyOutpostId: 'edge-1',
      proxyPathPrefix: '/grafana',
      proxySkipAuthPaths: ['/healthz', '/public'],
      proxyUpstreamUrl: 'http://grafana:3000',
      proxyWebsocketEnabled: true,
      type: 'proxy',
    })

    expect(providerInputFromValues(values)).toEqual({
      applicationId: 'grafana',
      name: 'Grafana Proxy',
      type: 'proxy',
      enabled: true,
      status: 'enabled',
      secretRefs: { clientSecret: 'secret-ref' },
      config: expect.objectContaining({
        customSetting: 'preserved',
        externalHosts: ['grafana.example.com'],
        headerMappings: expect.objectContaining({ user: 'X-User', email: 'X-Email' }),
        outpostId: 'edge-1',
        pathPrefix: '/grafana',
        skipAuthPaths: ['/healthz', '/public'],
        upstreamUrl: 'http://grafana:3000',
        websocketEnabled: true,
      }),
    })
  })

  it('rejects non-object provider JSON before a mutation', () => {
    expect(() => providerInputFromValues({ ...defaultProviderValues(), configJson: '[]' })).toThrow(
      'Config 必须是 JSON object',
    )
    expect(() =>
      providerInputFromValues({ ...defaultProviderValues(), secretRefsJson: 'null' }),
    ).toThrow('Secret refs 必须是 JSON object')
  })

  it('normalizes OIDC arrays and leaves an empty edit secret undefined', () => {
    const values = oidcClientValuesFor(client)
    expect(values.clientSecret).toBe('')
    expect(values.refreshTokenTtlSeconds).toBe(0)

    expect(
      oidcClientInputFromValues(client.providerId, {
        ...values,
        redirectUris: [' https://grafana.example/login ', 'https://grafana.example/login'],
        allowedScopes: ['openid', ' email ', 'openid'],
      }),
    ).toEqual({
      providerId: 'provider-1',
      clientId: 'grafana',
      clientSecret: undefined,
      redirectUris: ['https://grafana.example/login'],
      allowedScopes: ['openid', 'email'],
      allowedGrantTypes: ['authorization_code'],
      requirePkce: true,
      accessTokenTtlSeconds: 3600,
      idTokenTtlSeconds: 300,
      refreshTokenTtlSeconds: 0,
      status: 'enabled',
    })
  })

  it('keeps new OIDC defaults on authorization code and PKCE', () => {
    expect(defaultOIDCClientValues()).toMatchObject({
      allowedGrantTypes: ['authorization_code'],
      allowedScopes: ['openid', 'profile', 'email'],
      requirePkce: true,
      accessTokenTtlSeconds: 3600,
      idTokenTtlSeconds: 300,
      refreshTokenTtlSeconds: 0,
    })
  })
})
