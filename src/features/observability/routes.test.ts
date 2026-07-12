import { describe, expect, it } from 'vitest'
import { validateRouteDefinitions } from '@/routes/definitions'
import { observabilityCompatibilityRoutes, observabilityRouteManifests } from './routes'

describe('observability route manifests', () => {
  it('preserves canonical paths, redirects and the detail alias without duplicates', () => {
    const routes = observabilityRouteManifests.flatMap((manifest) => [...manifest])
    expect(validateRouteDefinitions(routes)).toEqual([])
    expect(routes.map((route) => route.meta.path)).toHaveLength(20)
    expect(
      observabilityCompatibilityRoutes.map((route) => [route.meta.path, route.redirectTo]),
    ).toEqual([
      ['/observability', '/monitoring-workbench'],
      ['/observability/monitoring', '/monitoring-workbench/overview'],
      ['/observability/rules', '/monitoring-workbench/rules'],
      ['/observability/alerts', '/monitoring-workbench/alerts'],
      ['/observability/notifications', '/monitoring-workbench/notifications'],
      ['/observability/healing', '/monitoring-workbench/healing'],
      ['/observability/oncall', '/monitoring-workbench/oncall'],
      ['/observability/events', '/monitoring-workbench/events'],
    ])
    const detail = routes.find((route) => route.meta.id === 'alert-event-detail')
    const compatibilityDetail = routes.find(
      (route) => route.meta.id === 'observability-alert-event-detail-compat',
    )
    expect(detail?.meta.path).toBe('/monitoring-workbench/alerts/:eventId')
    expect(compatibilityDetail?.meta.path).toBe('/observability/alerts/:eventId')
  })
})
