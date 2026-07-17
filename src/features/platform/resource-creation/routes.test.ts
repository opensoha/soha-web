import { describe, expect, it } from 'vitest'
import { resourceCreationRoutes } from './routes'

describe('resource creation routes', () => {
  it('keeps the former page URL as a permission-gated modal redirect', () => {
    expect(resourceCreationRoutes).toHaveLength(1)
    expect(resourceCreationRoutes[0]?.meta).toMatchObject({
      id: 'platform-resource-creation',
      path: '/resource-creation',
      permissionKey: 'platform.resource.create',
      scopeMode: 'namespace',
    })
    expect(resourceCreationRoutes[0]?.load).toBeTypeOf('function')
  })
})
