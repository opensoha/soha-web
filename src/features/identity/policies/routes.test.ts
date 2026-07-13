import { describe, expect, it, vi } from 'vitest'
import { identityPolicyRoutes } from './routes'

const routePage = vi.hoisted(() => () => null)
vi.mock('./list-page', () => ({ IdentityPoliciesPage: routePage }))

describe('identity policy compatibility route', () => {
  it('preserves direct access without adding a navigation item', async () => {
    const [route] = identityPolicyRoutes
    expect(route.meta).toEqual(
      expect.objectContaining({
        id: 'identity-policies',
        path: '/identity/policies',
        navVisible: false,
        tabbar: false,
        permissionKey: 'identity.policies.view',
      }),
    )
    await expect(route.load()).resolves.toEqual({ default: routePage })
  })
})
