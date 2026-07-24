import { describe, expect, it, vi } from 'vitest'
import { identityOverviewRoutes } from './routes'

const routePage = vi.hoisted(() => () => null)

vi.mock('./page', () => ({ IdentityOverviewPage: routePage }))

describe('identity overview route manifest', () => {
  it('preserves metadata and loads the capability leaf directly', async () => {
    expect(identityOverviewRoutes).toHaveLength(1)
    const [route] = identityOverviewRoutes

    expect(route.meta).toEqual({
      id: 'identity-overview',
      path: '/identity/overview',
      title: 'Overview',
      description: '身份工作台总览',
      icon: 'IconDesktop',
      group: 'identity',
      workbenchId: 'security',
      requiresAuth: true,
      tabbar: true,
      navVisible: true,
      parentId: 'identity',
      menuId: 'identity-overview',
      permissionKeysAny: [
        'identity.applications.view',
        'identity.providers.view',
        'identity.outposts.view',
        'identity.policies.view',
        'identity.audit.view',
      ],
      scopeMode: 'passive',
      workspace: 'system',
    })
    expect(route.shell).toBe('app')
    await expect(route.load()).resolves.toEqual({ default: routePage })
  })
})
