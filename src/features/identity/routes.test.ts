import { describe, expect, it } from 'vitest'
import { identityParentRoutes, identityRouteManifests } from './routes'

describe('Identity route manifests', () => {
  it('owns the parent redirect and composes every identity capability', () => {
    expect(identityParentRoutes).toEqual([
      expect.objectContaining({
        meta: expect.objectContaining({
          id: 'identity',
          path: '/identity',
          menuId: 'identity',
          workbenchId: 'security',
          permissionStrategy: 'any-child',
        }),
        redirectTo: '/identity/overview',
      }),
    ])

    expect(
      identityRouteManifests.flatMap((manifest) => manifest.map((route) => route.meta.id)),
    ).toEqual([
      'identity',
      'identity-overview',
      'identity-applications',
      'identity-providers',
      'identity-outposts',
      'identity-policies',
    ])
  })
})
