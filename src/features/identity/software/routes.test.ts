import { describe, expect, it, vi } from 'vitest'
import { internalWorkbenchSoftwareRoutes } from './routes'

const routePage = vi.hoisted(() => () => null)
const storageRoutePage = vi.hoisted(() => () => null)
vi.mock('./page', () => ({ SoftwareLibraryPage: routePage }))
vi.mock('./storage-page', () => ({ SoftwareStoragePage: storageRoutePage }))

describe('internal workbench software route manifest', () => {
  it('registers the protected software library under the internal workbench', async () => {
    expect(internalWorkbenchSoftwareRoutes).toHaveLength(2)
    const [libraryRoute, storageRoute] = internalWorkbenchSoftwareRoutes
    expect(libraryRoute.meta).toEqual(
      expect.objectContaining({
        id: 'internal-workbench-software',
        path: '/internal-workbench/software',
        parentId: 'internal-workbench',
        menuId: 'identity-software',
        permissionKey: 'software.package.view',
      }),
    )
    expect(storageRoute.meta).toEqual(
      expect.objectContaining({
        id: 'internal-workbench-software-storage',
        path: '/internal-workbench/software-storage',
        parentId: 'internal-workbench',
        menuId: 'identity-software-storage',
        permissionKey: 'software.package.view',
      }),
    )
    await expect(libraryRoute.load()).resolves.toEqual({ default: routePage })
    await expect(storageRoute.load()).resolves.toEqual({ default: storageRoutePage })
  })
})
