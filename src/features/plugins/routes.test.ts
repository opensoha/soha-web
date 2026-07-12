import { describe, expect, it, vi } from 'vitest'
import { pluginRoutes } from './routes'

const routePages = vi.hoisted(() => ({
  installedDetail: () => null,
  installedList: () => null,
  marketplaceDetail: () => null,
  marketplaceList: () => null,
}))

vi.mock('./marketplace/list-page', () => ({ PluginMarketplacePage: routePages.marketplaceList }))
vi.mock('./marketplace/detail-page', () => ({
  PluginMarketplaceDetailPage: routePages.marketplaceDetail,
}))
vi.mock('./installed/list-page', () => ({ InstalledPluginsPage: routePages.installedList }))
vi.mock('./installed/detail-page', () => ({
  InstalledPluginDetailPage: routePages.installedDetail,
}))

describe('plugin route manifest', () => {
  it('maps four UI routes to distinct leaves and keeps the root as a redirect', async () => {
    const expectedPages = new Map([
      ['plugins-marketplace', routePages.marketplaceList],
      ['plugins-marketplace-detail', routePages.marketplaceDetail],
      ['plugins-installed', routePages.installedList],
      ['plugins-installed-detail', routePages.installedDetail],
    ])
    type PluginRoute = (typeof pluginRoutes)[number]
    type PluginPageRoute = Extract<PluginRoute, { readonly load: unknown }>
    const pageRoutes = pluginRoutes.filter((route): route is PluginPageRoute => 'load' in route)

    expect(pageRoutes).toHaveLength(4)
    const loaded = await Promise.all(
      pageRoutes.map(async (route) => {
        const module = await route.load()
        expect(module.default).toBe(expectedPages.get(route.meta.id))
        return module.default
      }),
    )
    expect(new Set(loaded).size).toBe(4)
    expect(pluginRoutes[0]).toMatchObject({
      meta: { id: 'plugins', path: '/plugins' },
      redirectTo: '/plugins/marketplace',
    })
    expect('load' in pluginRoutes[0]).toBe(false)
  })
})
