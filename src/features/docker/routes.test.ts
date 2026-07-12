import { describe, expect, it, vi } from 'vitest'
import { dockerRoutes } from './routes'

const routePages = vi.hoisted(() => ({
  overview: () => null,
  hosts: () => null,
  projects: () => null,
  projectDetail: () => null,
  templates: () => null,
  operations: () => null,
}))

vi.mock('./overview/page', () => ({ DockerOverviewPage: routePages.overview }))
vi.mock('./hosts/page', () => ({ DockerHostsPage: routePages.hosts }))
vi.mock('./projects/list-page', () => ({ DockerProjectsPage: routePages.projects }))
vi.mock('./projects/detail-page', () => ({ DockerProjectDetailPage: routePages.projectDetail }))
vi.mock('./templates/page', () => ({ DockerTemplatesPage: routePages.templates }))
vi.mock('./operations/page', () => ({ DockerOperationsPage: routePages.operations }))

describe('docker route manifest', () => {
  it('maps six UI routes to distinct leaf modules and keeps aliases as redirects', async () => {
    const expectedPages = new Map([
      ['docker-workbench-overview', routePages.overview],
      ['docker-workbench-hosts', routePages.hosts],
      ['docker-workbench-projects', routePages.projects],
      ['docker-workbench-project-detail', routePages.projectDetail],
      ['docker-workbench-templates', routePages.templates],
      ['docker-workbench-operations', routePages.operations],
    ])

    type DockerRoute = (typeof dockerRoutes)[number]
    type DockerPageRoute = Extract<DockerRoute, { readonly load: unknown }>
    const pageRoutes = dockerRoutes.filter((route): route is DockerPageRoute => 'load' in route)
    expect(pageRoutes).toHaveLength(expectedPages.size)

    const loadedPages = await Promise.all(
      pageRoutes.map(async (route) => {
        const module = await route.load()
        expect(module.default).toBe(expectedPages.get(route.meta.id))
        return module.default
      }),
    )
    expect(new Set(loadedPages).size).toBe(expectedPages.size)

    expect(
      dockerRoutes
        .filter(
          (route) => route.meta.path === '/docker/services' || route.meta.path === '/docker/ports',
        )
        .map((route) => ('redirectTo' in route ? route.redirectTo : undefined)),
    ).toEqual(['/docker/projects', '/docker/projects'])
  })
})
