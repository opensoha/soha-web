import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api-client'
import { getOverviewMonitoringSummary, getOverviewWorkload } from './api'
import { platformOverviewKeys } from './keys'

vi.mock('@/services/api-client', () => ({
  api: {
    get: vi.fn(),
  },
}))

describe('platform overview data boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockResolvedValue({ data: {} })
  })

  it('preserves overview query tuples', () => {
    expect(platformOverviewKeys.clusters()).toEqual(['platform', 'clusters', 'list'])
    expect(platformOverviewKeys.monitoringSummary()).toEqual(['monitoring-summary'])
    expect(platformOverviewKeys.workload('cluster-1')).toEqual([
      'overview-workload',
      'cluster-1',
      '__all__',
    ])
  })

  it('preserves overview wire paths', async () => {
    await getOverviewMonitoringSummary()
    await getOverviewWorkload('cluster-1')

    expect(api.get).toHaveBeenNthCalledWith(1, '/monitoring/summary')
    expect(api.get).toHaveBeenNthCalledWith(2, '/clusters/cluster-1/workloads/overview')
  })
})
