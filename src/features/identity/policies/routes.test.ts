import { describe, expect, it, vi } from 'vitest'
import { identityPolicyRoutes } from './routes'

const routePage = vi.hoisted(() => () => null)

vi.mock('./list-page', () => ({ IdentityPoliciesPage: routePage }))

describe('identity policy route manifest', () => {
  it('maps the UI route directly to the capability leaf module', async () => {
    expect(identityPolicyRoutes).toHaveLength(1)
    const [route] = identityPolicyRoutes

    expect(route.meta).toMatchObject({
      id: 'identity-policies',
      path: '/identity/policies',
      permissionKey: 'identity.policies.view',
    })
    expect(route.shell).toBe('app')
    await expect(route.load()).resolves.toEqual({ default: routePage })
  })
})
