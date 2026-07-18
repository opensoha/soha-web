import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workloadKeys } from '@/features/platform/workloads/shared/keys'
import { deploymentQueries } from './queries'

const apiMocks = vi.hoisted(() => ({
  getDeploymentDetail: vi.fn(),
  getDeploymentMetrics: vi.fn(),
  getDeploymentRolloutStatus: vi.fn(),
  listDeploymentEvents: vi.fn(),
  listDeploymentRollouts: vi.fn(),
  listDeployments: vi.fn(),
}))

vi.mock('./api', () => apiMocks)

const scope = { clusterId: 'cluster-a', namespace: 'team-a' }

describe('deployment query options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses canonical keys and enables queries only for valid scope', () => {
    expect(deploymentQueries.list(scope).queryKey).toEqual(workloadKeys.list('deployments', scope))
    expect(deploymentQueries.list({ clusterId: null, namespace: null }).enabled).toBe(false)
    expect(deploymentQueries.detail(scope, 'api').enabled).toBe(true)
    expect(
      deploymentQueries.detail({ clusterId: 'cluster-a', namespace: null }, 'api').enabled,
    ).toBe(false)
  })

  it('keeps rollout keys and query functions together', async () => {
    apiMocks.getDeploymentRolloutStatus.mockResolvedValueOnce({ status: 'ready' })
    apiMocks.listDeploymentRollouts.mockResolvedValueOnce([{ revision: '7' }])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    await expect(
      queryClient.fetchQuery(deploymentQueries.rolloutStatus(scope, 'api')),
    ).resolves.toEqual({ status: 'ready' })
    await expect(queryClient.fetchQuery(deploymentQueries.rollouts(scope, 'api'))).resolves.toEqual(
      [{ revision: '7' }],
    )
    expect(apiMocks.getDeploymentRolloutStatus).toHaveBeenCalledWith({ scope, name: 'api' })
    expect(apiMocks.listDeploymentRollouts).toHaveBeenCalledWith({ scope, name: 'api' })
  })
})
