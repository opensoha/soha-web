import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deliveryApi, deliveryRuntimeDetailPath } from './api'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  getEnvelope: vi.fn(),
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
    apiMocks.get.mockResolvedValue({ items: [], truncated: false })

    await expect(
      deliveryApi.environments.targetCandidates({
        clusterId: 'cluster/a',
        namespace: 'team dev',
        search: ' api ',
        limit: 200,
      }),
    ).resolves.toEqual({ items: [], truncated: false })
    await deliveryApi.workflows.list({ applicationId: 'app/a' })
    await deliveryApi.workloads.metrics({
      clusterId: 'cluster/a',
      namespace: 'team dev',
      workloadName: 'api/web',
    })
    await deliveryApi.gateway.readiness({ skillId: 'delivery/onboarding' })

    expect(apiMocks.get.mock.calls.map(([path]) => path)).toEqual([
      '/application-environments/target-candidates?clusterId=cluster%2Fa&namespace=team+dev&search=api&limit=200',
      '/workflows?applicationId=app%2Fa',
      '/clusters/cluster%2Fa/workloads/deployments/api%2Fweb/metrics?namespace=team+dev&rangeMinutes=60',
      '/ai-gateway/capabilities?source=delivery-workbench&skillId=delivery%2Fonboarding',
    ])
  })

  it('imports selected Kubernetes workloads in observe-only mode', async () => {
    const payload = {
      clusterId: 'cluster-a',
      namespace: 'erp',
      applicationKey: 'erp',
      applicationName: 'ERP',
      environmentKey: 'prod',
      environmentName: 'prod',
      ownershipMode: 'observe_only' as const,
      workloads: [{ workloadKind: 'Deployment' as const, workloadName: 'api' }],
    }
    apiMocks.post.mockResolvedValue({ data: { ownershipMode: 'observe_only' } })

    await expect(deliveryApi.environments.importKubernetesServices(payload)).resolves.toEqual({
      ownershipMode: 'observe_only',
    })
    expect(apiMocks.post).toHaveBeenCalledWith('/application-environments/imports', payload)
  })

  it('lists and imports managed Helm releases', async () => {
    const payload = {
      clusterId: 'cluster-a',
      namespace: 'erp',
      applicationKey: 'erp',
      applicationName: 'ERP',
      environmentKey: 'prod',
      environmentName: 'prod',
      ownershipMode: 'managed' as const,
      releases: [{ releaseName: 'erp' }],
    }
    apiMocks.get.mockResolvedValue({ data: [{ name: 'erp', namespace: 'erp' }] })
    apiMocks.post.mockResolvedValue({ data: { ownershipMode: 'managed' } })

    await expect(deliveryApi.environments.helmReleases('cluster/a', 'erp')).resolves.toEqual([
      { name: 'erp', namespace: 'erp' },
    ])
    await expect(deliveryApi.environments.importHelmReleases(payload)).resolves.toEqual({
      ownershipMode: 'managed',
    })
    expect(apiMocks.get).toHaveBeenCalledWith('/clusters/cluster%2Fa/helm/releases?namespace=erp')
    expect(apiMocks.post).toHaveBeenCalledWith(
      '/application-environments/helm-release-imports',
      payload,
    )
  })

  it('uses repository and GitLab project, branch, tag, and commit endpoints', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [], page: 1, limit: 20, hasMore: false })

    await deliveryApi.repositories.list({ applicationId: ' app/1 ', search: ' api ' })
    await deliveryApi.gitlab.projects({ search: ' api ' })
    await deliveryApi.gitlab.branches({ projectId: 'group/api', search: 'main' })
    await deliveryApi.gitlab.tags({ projectId: 'group/api' })
    await deliveryApi.gitlab.commits({ projectId: 'group/api', page: 1, limit: 20 })

    expect(apiMocks.get.mock.calls.map(([path]) => path)).toEqual([
      '/repositories?applicationId=app%2F1&search=api',
      '/integrations/gitlab/projects?search=api',
      '/integrations/gitlab/branches?projectId=group%2Fapi&search=main',
      '/integrations/gitlab/tags?projectId=group%2Fapi',
      '/integrations/gitlab/commits?projectId=group%2Fapi&limit=20&page=1',
    ])
  })

  it('uses the registry items envelope and canonical registry fields', async () => {
    const connection = {
      id: 'registry-1',
      name: 'Harbor Prod',
      registryType: 'harbor',
      endpoint: 'https://harbor.example.com',
      insecure: false,
      metadata: { secretConfigured: true, secretStorage: 'encrypted' },
      createdAt: '2026-08-08T08:00:00Z',
      updatedAt: '2026-08-08T08:00:00Z',
    }
    const payload = {
      name: connection.name,
      registryType: connection.registryType,
      endpoint: connection.endpoint,
      secret: 'fixture-token',
      insecure: false,
    }
    apiMocks.getEnvelope.mockResolvedValue({ items: [connection] })
    apiMocks.post.mockResolvedValue({ data: connection })
    apiMocks.put.mockResolvedValue({ data: connection })

    await expect(deliveryApi.registries.list()).resolves.toEqual([connection])
    await deliveryApi.registries.create(payload)
    await deliveryApi.registries.update('registry/1', payload)

    expect(apiMocks.getEnvelope).toHaveBeenCalledWith('/registries')
    expect(apiMocks.post).toHaveBeenCalledWith('/registries', payload)
    expect(apiMocks.put).toHaveBeenCalledWith('/registries/registry%2F1', payload)
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
