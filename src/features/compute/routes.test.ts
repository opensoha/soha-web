import { describe, expect, it, vi } from 'vitest'
import { computeRoutes } from './routes'

const routePages = vi.hoisted(() => ({
  overview: () => null,
  access: () => null,
  syncTasks: () => null,
  buildTasks: () => null,
  operationRecords: () => null,
  vms: () => null,
  vmDetail: () => null,
  clusters: () => null,
  images: () => null,
  flavors: () => null,
  hosts: () => null,
  projects: () => null,
  projectDetail: () => null,
  templates: () => null,
}))

vi.mock('./overview/page', () => ({ ComputeOverviewPage: routePages.overview }))
vi.mock('./access/page', () => ({ ComputeAccessPage: routePages.access }))
vi.mock('./tasks/sync-page', () => ({ ComputeSyncTasksPage: routePages.syncTasks }))
vi.mock('./tasks/build-page', () => ({ ComputeBuildTasksPage: routePages.buildTasks }))
vi.mock('./tasks/operations-page', () => ({
  ComputeOperationRecordsPage: routePages.operationRecords,
}))
vi.mock('@/features/virtualization/virtual-machines/list-page', () => ({
  VirtualizationVmsPage: routePages.vms,
}))
vi.mock('@/features/virtualization/virtual-machines/detail-page', () => ({
  VirtualizationVmDetailPage: routePages.vmDetail,
}))
vi.mock('@/features/virtualization/clusters/list-page', () => ({
  VirtualizationClustersPage: routePages.clusters,
}))
vi.mock('@/features/virtualization/images/list-page', () => ({
  VirtualizationImagesPage: routePages.images,
}))
vi.mock('@/features/virtualization/flavors/list-page', () => ({
  VirtualizationFlavorsPage: routePages.flavors,
}))
vi.mock('@/features/docker/hosts/page', () => ({ DockerHostsPage: routePages.hosts }))
vi.mock('@/features/docker/projects/list-page', () => ({
  DockerProjectsPage: routePages.projects,
}))
vi.mock('@/features/docker/projects/detail-page', () => ({
  DockerProjectDetailPage: routePages.projectDetail,
}))
vi.mock('@/features/docker/templates/page', () => ({
  DockerTemplatesPage: routePages.templates,
}))

describe('compute route manifest', () => {
  it('owns one workbench and reuses every domain page at a canonical route', async () => {
    const pageRoutes = computeRoutes.filter(
      (route): route is Extract<(typeof computeRoutes)[number], { readonly load: unknown }> =>
        'load' in route,
    )
    const loadedPages = await Promise.all(
      pageRoutes.map(async (route) => (await route.load()).default),
    )

    expect(pageRoutes).toHaveLength(14)
    expect(new Set(loadedPages).size).toBe(14)
    expect(
      computeRoutes
        .filter((route) => route.meta.navVisible)
        .every((route) => route.meta.workbenchId === 'compute'),
    ).toBe(true)
  })

  it('does not expose legacy aliases or standalone create routes', () => {
    expect(computeRoutes.some((route) => 'aliases' in route)).toBe(false)
    expect(computeRoutes.map((route) => route.meta.path)).not.toEqual(
      expect.arrayContaining([
        '/compute/access/new',
        '/compute/virtualization/clusters/new',
        '/compute/runtimes/hosts/new',
        '/compute/tasks',
        '/compute/tasks/all',
      ]),
    )
  })

  it('allows the overview for every permission accepted by the backend projection', () => {
    const overview = computeRoutes.find((route) => route.meta.id === 'compute-workbench-overview')
    if (!overview || !('permissionKeysAny' in overview.meta)) {
      throw new Error('missing compute overview permission metadata')
    }

    expect(overview.meta.permissionKeysAny).toEqual([
      'virtualization.overview.view',
      'virtualization.vms.view',
      'virtualization.clusters.view',
      'virtualization.images.view',
      'virtualization.flavors.view',
      'virtualization.operations.view',
      'virtualization.sync.view',
      'virtualization.sync.manage',
      'docker.overview.view',
      'docker.hosts.view',
      'docker.projects.view',
      'docker.services.view',
      'docker.ports.view',
      'docker.templates.view',
      'docker.operations.view',
    ])
  })
})
