import { describe, expect, it } from 'vitest'
import type { IdentityApplication } from '../shared/types'
import {
  buildIdentityApplicationInput,
  defaultIdentityApplicationFormValues,
  identityApplicationFormValuesFor,
} from './application-form-model'

const application: IdentityApplication = {
  id: 'grafana',
  slug: 'grafana',
  name: 'Grafana',
  description: 'Dashboards',
  iconUrl: 'https://grafana.example/icon.png',
  category: 'Observability',
  tags: ['metrics'],
  launchUrl: '',
  providerId: 'provider-1',
  providerType: 'oidc',
  portalVisible: true,
  featured: true,
  sortOrder: 10,
  status: 'enabled',
  metadata: {
    custom: { retained: true },
    oidcClientId: 'legacy-client',
    oidcRedirectUri: 'https://legacy.example/callback',
    oidcScopes: 'openid, email',
    oidc: {
      clientId: 'nested-client',
      customOIDC: 'retained',
      redirectUri: 'https://nested.example/callback',
      scopes: ['openid'],
    },
  },
  assignments: [
    {
      subjectType: 'role',
      subjectId: 'admin',
      effect: 'allow',
    },
  ],
  createdAt: '2026-07-10T00:00:00Z',
  updatedAt: '2026-07-10T00:00:00Z',
}

describe('identity application form model', () => {
  it('provides stable create defaults', () => {
    expect(defaultIdentityApplicationFormValues()).toMatchObject({
      assignments: [],
      featured: false,
      portalVisible: true,
      providerId: '',
      providerType: 'link',
      sortOrder: 1000,
      status: 'draft',
    })
  })

  it('reads legacy top-level OIDC fields before nested fields', () => {
    expect(identityApplicationFormValuesFor(application)).toMatchObject({
      oidcClientId: 'legacy-client',
      oidcRedirectUri: 'https://legacy.example/callback',
      oidcScopes: ['openid', 'email'],
      providerId: 'provider-1',
      providerType: 'oidc',
    })
  })

  it('writes canonical nested OIDC values while preserving unknown metadata', () => {
    const values = identityApplicationFormValuesFor(application)
    const input = buildIdentityApplicationInput(
      {
        ...values,
        assignments: [
          { effect: 'allow', subjectId: ' admin ', subjectType: 'role' },
          { effect: 'allow', subjectId: ' ', subjectType: 'team' },
        ],
        name: ' Grafana Enterprise ',
        oidcClientId: ' client-new ',
        oidcRedirectUri: ' https://new.example/callback ',
        oidcScopes: ['openid', ' email ', 'openid', ''],
        providerId: ' provider-new ',
        tags: ['metrics', ' metrics ', '', 'dashboards'],
      },
      application,
    )

    expect(input).toMatchObject({
      assignments: [{ effect: 'allow', subjectId: 'admin', subjectType: 'role' }],
      name: 'Grafana Enterprise',
      providerId: 'provider-new',
      tags: ['metrics', 'dashboards'],
    })
    expect(input.metadata).toEqual({
      custom: { retained: true },
      oidc: {
        clientId: 'client-new',
        customOIDC: 'retained',
        redirectUri: 'https://new.example/callback',
        scopes: ['openid', 'email'],
      },
    })
  })

  it('removes OIDC config for another provider type and reserves provider binding for edits', () => {
    const editValues = {
      ...identityApplicationFormValuesFor(application),
      providerId: ' provider-2 ',
      providerType: 'link' as const,
    }

    expect(buildIdentityApplicationInput(editValues, application)).toMatchObject({
      metadata: { custom: { retained: true } },
      providerId: 'provider-2',
      providerType: 'link',
    })
    expect(buildIdentityApplicationInput(editValues)).toMatchObject({
      providerId: '',
      providerType: 'link',
    })
  })
})
