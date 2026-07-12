import { describe, expect, it, vi } from 'vitest'
import { observabilityOverviewRoutes } from './routes'

const page = vi.hoisted(() => () => null)
vi.mock('./page', () => ({ MonitoringPage: page }))

describe('observability overview route manifest', () => {
  it('loads the overview leaf directly', async () => {
    expect(observabilityOverviewRoutes[0].meta.path).toBe('/monitoring-workbench/overview')
    await expect(observabilityOverviewRoutes[0].load()).resolves.toEqual({ default: page })
  })
})
