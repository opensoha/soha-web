import { describe, expect, it, vi } from 'vitest'
import { identityPolicyRoutes } from './routes'

const routePage = vi.hoisted(() => () => null)
vi.mock('./list-page', () => ({ IdentityPoliciesPage: routePage }))

describe('identity policy route', () => {
  it('is available from navigation and preserves direct access', async () => {
    const [route] = identityPolicyRoutes
    expect(route.meta).toEqual(
      expect.objectContaining({
        id: 'identity-policies',
        path: '/identity/policies',
        navVisible: true,
        menuId: 'identity-policies',
        tabbar: false,
        permissionKey: 'identity.policies.view',
      }),
    )
    await expect(route.load()).resolves.toEqual({ default: routePage })
  })
})
