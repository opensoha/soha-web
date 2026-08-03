import { describe, expect, it, vi } from 'vitest'
import { observabilityOverviewRoutes } from './routes'

const workbenchPage = vi.hoisted(() => () => null)
const alertingPage = vi.hoisted(() => () => null)
vi.mock('./workbench-page', () => ({ ObservabilityWorkbenchPage: workbenchPage }))
vi.mock('./page', () => ({ MonitoringPage: alertingPage }))

describe('observability overview route manifest', () => {
  it('keeps the signal overview separate from alerting', async () => {
    expect(observabilityOverviewRoutes.map((route) => route.meta.path)).toEqual([
      '/monitoring-workbench/overview',
      '/monitoring-workbench/alerting',
    ])
    await expect(observabilityOverviewRoutes[0].load()).resolves.toEqual({
      default: workbenchPage,
    })
    await expect(observabilityOverviewRoutes[1].load()).resolves.toEqual({
      default: alertingPage,
    })
  })
})
