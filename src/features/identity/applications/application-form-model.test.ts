/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import type { IdentityApplication } from '../shared/types'
import {
  buildIdentityApplicationInput,
  defaultIdentityApplicationFormValues,
  IDENTITY_APPLICATION_ICON_MAX_BYTES,
  identityApplicationFormValuesFor,
  identityApplicationTagOptions,
  readIdentityApplicationIconFile,
} from './application-form-model'

const application: IdentityApplication = {
  id: 'grafana',
  slug: 'grafana',
  name: 'Grafana',
  description: 'Dashboards',
  iconUrl: 'https://grafana.example/icon.png',
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
    expect(defaultIdentityApplicationFormValues()).not.toHaveProperty('category')
  })

  it('builds reusable tag options from existing applications', () => {
    expect(
      identityApplicationTagOptions([
        { ...application, tags: [' platform ', 'metrics'] },
        { ...application, id: 'loki', tags: ['alerts', 'platform'] },
      ]),
    ).toEqual([
      { label: 'alerts', value: 'alerts' },
      { label: 'metrics', value: 'metrics' },
      { label: 'platform', value: 'platform' },
    ])
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

  it('converts a supported local icon to a data URL', async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'icon.png', {
      type: 'image/png',
    })

    await expect(readIdentityApplicationIconFile(file)).resolves.toBe(
      'data:image/png;base64,iVBORw==',
    )
  })

  it('rejects unsupported or mismatched local icon formats', async () => {
    await expect(
      readIdentityApplicationIconFile(new File(['<svg />'], 'icon.svg', { type: 'image/svg+xml' })),
    ).rejects.toThrow('JPG、PNG、WEBP 或 ICO')
    await expect(
      readIdentityApplicationIconFile(new File(['icon'], 'icon.png', { type: 'image/jpeg' })),
    ).rejects.toThrow('JPG、PNG、WEBP 或 ICO')
  })

  it('rejects local icons larger than 512KB', async () => {
    const file = new File([new Uint8Array(IDENTITY_APPLICATION_ICON_MAX_BYTES + 1)], 'icon.png', {
      type: 'image/png',
    })

    await expect(readIdentityApplicationIconFile(file)).rejects.toThrow('512KB')
  })

  it('rejects an empty local icon', async () => {
    await expect(
      readIdentityApplicationIconFile(new File([], 'icon.png', { type: 'image/png' })),
    ).rejects.toThrow('不能为空')
  })
})
