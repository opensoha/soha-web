import { describe, expect, it, vi } from 'vitest'
import { observabilitySignalRoutes } from './routes'

const servicesPage = vi.hoisted(() => () => null)
const metricsPage = vi.hoisted(() => () => null)
const tracesPage = vi.hoisted(() => () => null)
vi.mock('./services-page', () => ({ ObservabilityServicesPage: servicesPage }))
vi.mock('./metrics-page', () => ({ ObservabilityMetricsPage: metricsPage }))
vi.mock('./traces-page', () => ({ ObservabilityTracesPage: tracesPage }))

describe('observability signal routes', () => {
  it('registers executable passive-scope signal pages', async () => {
    expect(observabilitySignalRoutes.map((route) => route.meta.id)).toEqual([
      'monitoring-workbench-services',
      'monitoring-workbench-metrics',
      'monitoring-workbench-traces',
    ])
    for (const route of observabilitySignalRoutes) {
      expect(route.meta).toMatchObject({
        permissionKey: 'observe.monitoring.view',
        scopeMode: 'passive',
        navVisible: true,
      })
      await expect(route.load()).resolves.toHaveProperty('default')
    }
  })
})
