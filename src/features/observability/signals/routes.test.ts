import { describe, expect, it, vi } from 'vitest'
import { observabilitySignalRoutes } from './routes'

const servicesPage = vi.hoisted(() => () => null)
const metricsPage = vi.hoisted(() => () => null)
const tracesPage = vi.hoisted(() => () => null)
const explorePage = vi.hoisted(() => () => null)
vi.mock('./services-page', () => ({ ObservabilityServicesPage: servicesPage }))
vi.mock('./metrics-page', () => ({ ObservabilityMetricsPage: metricsPage }))
vi.mock('./traces-page', () => ({ ObservabilityTracesPage: tracesPage }))
vi.mock('./explore-page', () => ({ ObservabilityExplorePage: explorePage }))

describe('observability signal routes', () => {
  it('registers executable passive-scope signal pages', async () => {
    expect(observabilitySignalRoutes.map((route) => route.meta.id)).toEqual([
      'monitoring-workbench-services',
      'monitoring-workbench-explore',
      'monitoring-workbench-metrics',
      'monitoring-workbench-traces',
    ])
    for (const route of observabilitySignalRoutes) {
      expect(route.meta).toMatchObject({
        permissionKey: 'observe.monitoring.view',
        scopeMode: 'passive',
      })
      await expect(route.load()).resolves.toHaveProperty('default')
    }
    expect(
      observabilitySignalRoutes
        .filter((route) => route.meta.navVisible)
        .map((route) => route.meta.id),
    ).toEqual(['monitoring-workbench-services', 'monitoring-workbench-explore'])
    expect(
      observabilitySignalRoutes
        .filter((route) => !route.meta.navVisible)
        .every((route) => route.meta.menuId === 'monitoring-workbench'),
    ).toBe(true)
  })
})
