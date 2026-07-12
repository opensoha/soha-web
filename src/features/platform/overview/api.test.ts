import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api-client'
import { getOverviewMonitoringSummary, getOverviewWorkload, listOverviewClusters } from './api'
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
    expect(platformOverviewKeys.clusters()).toEqual(['clusters'])
    expect(platformOverviewKeys.monitoringSummary()).toEqual(['monitoring-summary'])
    expect(platformOverviewKeys.workload('cluster-1')).toEqual([
      'overview-workload',
      'cluster-1',
      '__all__',
    ])
  })

  it('preserves overview wire paths', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [{ id: 'cluster-1' }] })

    await expect(listOverviewClusters()).resolves.toEqual([{ id: 'cluster-1' }])
    await getOverviewMonitoringSummary()
    await getOverviewWorkload('cluster-1')

    expect(api.get).toHaveBeenNthCalledWith(1, '/clusters')
    expect(api.get).toHaveBeenNthCalledWith(2, '/monitoring/summary')
    expect(api.get).toHaveBeenNthCalledWith(3, '/clusters/cluster-1/workloads/overview')
  })
})
