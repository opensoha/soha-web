import { describe, expect, it, vi } from 'vitest'
import { virtualizationRoutes } from './routes'

const routePages = vi.hoisted(() => ({
  overview: () => null,
  vms: () => null,
  vmDetail: () => null,
  clusters: () => null,
  images: () => null,
  flavors: () => null,
  operations: () => null,
  sync: () => null,
}))

vi.mock('./overview/page', () => ({ VirtualizationOverviewPage: routePages.overview }))
vi.mock('./virtual-machines/list-page', () => ({ VirtualizationVmsPage: routePages.vms }))
vi.mock('./virtual-machines/detail-page', () => ({
  VirtualizationVmDetailPage: routePages.vmDetail,
}))
vi.mock('./clusters/list-page', () => ({ VirtualizationClustersPage: routePages.clusters }))
vi.mock('./images/list-page', () => ({ VirtualizationImagesPage: routePages.images }))
vi.mock('./flavors/list-page', () => ({ VirtualizationFlavorsPage: routePages.flavors }))
vi.mock('./operations/page', () => ({ VirtualizationOperationsPage: routePages.operations }))
vi.mock('./sync/page', () => ({ VirtualizationSyncPage: routePages.sync }))

describe('virtualization route manifest', () => {
  it('maps each page route to one distinct leaf module', async () => {
    const expectedPages = new Map([
      ['virtualization-workbench-overview', routePages.overview],
      ['virtualization-workbench-vms', routePages.vms],
      ['virtualization-workbench-vm-detail', routePages.vmDetail],
      ['virtualization-workbench-clusters', routePages.clusters],
      ['virtualization-workbench-images', routePages.images],
      ['virtualization-workbench-flavors', routePages.flavors],
      ['virtualization-workbench-operations', routePages.operations],
      ['virtualization-workbench-sync', routePages.sync],
    ])

    type VirtualizationRoute = (typeof virtualizationRoutes)[number]
    type VirtualizationPageRoute = Extract<VirtualizationRoute, { readonly load: unknown }>
    const pageRoutes = virtualizationRoutes.filter(
      (route): route is VirtualizationPageRoute => 'load' in route,
    )
    expect(pageRoutes).toHaveLength(expectedPages.size)

    const loadedPages = await Promise.all(
      pageRoutes.map(async (route) => {
        const module = await route.load()
        expect(module.default).toBe(expectedPages.get(route.meta.id))
        return module.default
      }),
    )

    expect(new Set(loadedPages).size).toBe(expectedPages.size)
  })
})
