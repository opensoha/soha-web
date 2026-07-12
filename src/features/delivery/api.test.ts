import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deliveryApi, deliveryRuntimeDetailPath } from './api'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

describe('deliveryApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('unwraps application list/detail/runtime values and encodes identifiers', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: [{ id: 'app-1' }] })
      .mockResolvedValueOnce({ data: { application: { id: 'app/1' } } })
      .mockResolvedValueOnce({ data: { application: { id: 'app/1' }, environments: [] } })

    await expect(deliveryApi.applications.list()).resolves.toEqual([{ id: 'app-1' }])
    await expect(deliveryApi.applications.detail(' app/1 ')).resolves.toMatchObject({
      application: { id: 'app/1' },
    })
    await expect(deliveryApi.applications.runtime('app/1')).resolves.toMatchObject({
      environments: [],
    })

    expect(apiMocks.get.mock.calls.map(([path]) => path)).toEqual([
      '/applications',
      '/applications/app%2F1/detail',
      '/applications/app%2F1/runtime',
    ])
  })

  it('preserves candidate, application filter, workload, and gateway query paths', async () => {
    apiMocks.get.mockResolvedValue({ data: [] })

    await deliveryApi.environments.targetCandidates({
      clusterId: 'cluster/a',
      namespace: 'team dev',
    })
    await deliveryApi.workflows.list({ applicationId: 'app/a' })
    await deliveryApi.workloads.metrics({
      clusterId: 'cluster/a',
      namespace: 'team dev',
      workloadName: 'api/web',
    })
    await deliveryApi.gateway.readiness({ skillId: 'delivery/onboarding' })

    expect(apiMocks.get.mock.calls.map(([path]) => path)).toEqual([
      '/application-environments/target-candidates?clusterId=cluster%2Fa&namespace=team+dev',
      '/workflows?applicationId=app%2Fa',
      '/clusters/cluster%2Fa/workloads/deployments/api%2Fweb/metrics?namespace=team+dev&rangeMinutes=60',
      '/ai-gateway/capabilities?source=delivery-workbench&skillId=delivery%2Fonboarding',
    ])
  })

  it('uses the five canonical runtime detail endpoints and unwraps details', async () => {
    apiMocks.get.mockResolvedValue({ data: { id: 'runtime-1', object: { id: 'record-1' } } })

    const kinds = ['build', 'workflow', 'release', 'release_bundle', 'execution_task'] as const
    for (const kind of kinds) {
      await expect(deliveryApi.runtime.detail(kind, 'record/1')).resolves.toMatchObject({
        id: 'runtime-1',
      })
    }

    expect(kinds.map((kind) => deliveryRuntimeDetailPath(kind, 'record/1'))).toEqual([
      '/delivery/runtime/builds/record%2F1',
      '/delivery/runtime/workflows/record%2F1',
      '/delivery/runtime/releases/record%2F1',
      '/delivery/runtime/release-bundles/record%2F1',
      '/delivery/runtime/execution-tasks/record%2F1',
    ])
  })

  it('keeps template, execution, draft, plan, and rollback mutation payloads intact', async () => {
    apiMocks.post
      .mockResolvedValueOnce({ data: { applicationDraft: {} } })
      .mockResolvedValueOnce({ data: { id: 'draft-1' } })
      .mockResolvedValueOnce({ data: { id: 'plan-1' } })
      .mockResolvedValueOnce({ data: { plan: { id: 'plan-1' } } })
      .mockResolvedValue(undefined)

    await deliveryApi.blueprints.renderSpec('blueprint/1')
    await deliveryApi.drafts.confirm('draft/1')
    await deliveryApi.plans.create({ applicationId: 'app-1' } as never)
    await deliveryApi.plans.confirm('plan/1')
    await deliveryApi.executionTasks.cancel({ id: 'task/1', reason: 'manual cancel' })
    await deliveryApi.deployments.rollback({
      clusterId: 'cluster/1',
      namespace: 'default',
      workloadName: 'api',
      revision: '2',
    })

    expect(apiMocks.post).toHaveBeenNthCalledWith(
      1,
      '/delivery/blueprints/blueprint%2F1/render-spec',
      {},
    )
    expect(apiMocks.post).toHaveBeenNthCalledWith(2, '/delivery/drafts/draft%2F1/confirm', {})
    expect(apiMocks.post).toHaveBeenNthCalledWith(5, '/delivery/execution-tasks/task%2F1/cancel', {
      reason: 'manual cancel',
    })
    expect(apiMocks.post).toHaveBeenNthCalledWith(
      6,
      '/clusters/cluster%2F1/workloads/deployments/rollback',
      { namespace: 'default', name: 'api', revision: '2' },
    )
  })
})
