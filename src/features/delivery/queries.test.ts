import { afterEach, describe, expect, it, vi } from 'vitest'
import { deliveryApi } from './api'
import { deliveryKeys } from './keys'
import { deliveryQueries, runtimeDetailQueries } from './queries'

async function executeQuery(options: { queryFn?: unknown }) {
  if (typeof options.queryFn !== 'function') throw new Error('Expected queryFn')
  return options.queryFn({} as never)
}

describe('deliveryQueries', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns unwrapped list and detail domain values under canonical keys', async () => {
    const applications = [{ id: 'app-1' }]
    const detail = { application: applications[0] }
    vi.spyOn(deliveryApi.applications, 'list').mockResolvedValue(applications as never)
    vi.spyOn(deliveryApi.applications, 'detail').mockResolvedValue(detail as never)

    const listOptions = deliveryQueries.applications.list()
    const detailOptions = deliveryQueries.applications.detail(' app-1 ')

    expect(listOptions.queryKey).toEqual(deliveryKeys.applications.list())
    expect(detailOptions.queryKey).toEqual(deliveryKeys.applications.detail('app-1'))
    await expect(executeQuery(listOptions)).resolves.toBe(applications)
    await expect(executeQuery(detailOptions)).resolves.toBe(detail)
    expect(deliveryApi.applications.detail).toHaveBeenCalledWith('app-1')
  })

  it('uses the same normalized list filters in keys and API calls', async () => {
    const workflows = vi.spyOn(deliveryApi.workflows, 'list').mockResolvedValue([])
    const options = deliveryQueries.workflows.list(
      { applicationId: ' app-1 ' },
      { refetchInterval: 5000 },
    )

    expect(options.queryKey).toEqual(deliveryKeys.workflows.list({ applicationId: 'app-1' }))
    expect(options.refetchInterval).toBe(5000)
    await executeQuery(options)
    expect(workflows).toHaveBeenCalledWith({ applicationId: 'app-1' })
  })

  it('disables required identifier and workload queries until targets exist', () => {
    expect(deliveryQueries.applications.detail(' ').enabled).toBe(false)
    expect(
      deliveryQueries.environments.targetCandidates({ clusterId: '', namespace: '' }).enabled,
    ).toBe(false)
    expect(
      deliveryQueries.workloads.runtime({
        applicationId: 'app-1',
        applicationEnvironmentId: '',
        workloadName: 'api',
      }).enabled,
    ).toBe(false)
    expect(deliveryQueries.releaseBoard.list({ enabled: false }).enabled).toBe(false)
  })

  it('provides the canonical runtime detail query factory', async () => {
    const detail = { id: 'runtime-1', object: { id: 'run-1' } }
    const runtime = vi.spyOn(deliveryApi.runtime, 'detail').mockResolvedValue(detail as never)
    const options = runtimeDetailQueries.detail('workflow', ' run-1 ')

    expect(options.queryKey).toEqual(deliveryKeys.runtime.detail('workflow', 'run-1'))
    await expect(executeQuery(options)).resolves.toBe(detail)
    expect(runtime).toHaveBeenCalledWith('workflow', 'run-1')
  })
})
