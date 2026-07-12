import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gatewayApi } from './api'
import { gatewayKeys } from './keys'
import {
  decideGatewayApproval,
  deleteGatewayResource,
  rotateGatewayToken,
  upsertGatewayResource,
} from './mutations'
import { gatewayQueries } from './queries'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

async function executeQuery(options: { queryFn?: unknown }) {
  if (typeof options.queryFn !== 'function') throw new Error('Expected queryFn')
  return options.queryFn({} as never)
}

describe('gateway data layer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.get.mockResolvedValue({ data: [] })
    apiMocks.post.mockResolvedValue({ data: {} })
    apiMocks.put.mockResolvedValue({ data: {} })
    apiMocks.delete.mockResolvedValue({ data: {} })
  })

  afterEach(() => vi.restoreAllMocks())

  it('keeps resource and filtered relay queries under the canonical root key', async () => {
    const filters = { providerKind: 'openai', upstreamId: 'upstream/1' }
    const options = gatewayQueries.relay.modelRoutes(filters)

    expect(gatewayKeys.clients()).toEqual(['ai-gateway', 'ai-clients'])
    expect(options.queryKey).toEqual(['ai-gateway', 'relay', 'model-routes', filters])
    await executeQuery(options)
    expect(apiMocks.get).toHaveBeenCalledWith(
      '/ai-gateway/relay/model-routes?providerKind=openai&upstreamId=upstream%2F1&includeDisabled=true',
    )
  })

  it('allows route ownership to disable unrelated queries without changing their keys', () => {
    const filters = {
      actor: '',
      tokenId: '',
      publicModel: '',
      upstreamId: '',
      providerKind: '',
      status: '',
      endpoint: '',
      cacheStatus: '',
      from: '',
      to: '',
    }

    const options = gatewayQueries.relay.modelCalls(filters, false)

    expect(options.enabled).toBe(false)
    expect(options.queryKey).toEqual(['ai-gateway', 'relay', 'model-calls', filters])
  })

  it('preserves approval decisions and token rotation/revocation endpoints', async () => {
    await decideGatewayApproval({ action: 'approve', id: 'approval/1', comment: 'reviewed' })
    await rotateGatewayToken('personal-token', 'pat-1')
    await rotateGatewayToken('service-token', 'sat-1')
    await deleteGatewayResource('personal-token', 'pat-2')

    expect(apiMocks.post).toHaveBeenNthCalledWith(
      1,
      '/ai-gateway/approval-requests/approval/1/approve',
      { comment: 'reviewed' },
    )
    expect(apiMocks.post).toHaveBeenNthCalledWith(
      2,
      '/ai-gateway/personal-access-tokens/pat-1/rotate',
    )
    expect(apiMocks.post).toHaveBeenNthCalledWith(
      3,
      '/ai-gateway/service-account-tokens/sat-1/rotate',
    )
    expect(apiMocks.post).toHaveBeenNthCalledWith(
      4,
      '/ai-gateway/personal-access-tokens/pat-2/revoke',
    )
  })

  it('maps access policy form values to the governance transport contract', async () => {
    await upsertGatewayResource(
      { kind: 'access-policy' },
      {
        name: 'Production guardrail',
        enabled: 'true',
        subjectType: 'role',
        subjectId: 'developer',
        effect: 'allow',
        toolPatterns: ['k8s.*'],
        riskLevels: ['high'],
        approvalMode: 'require_approval',
        budgetEnabled: true,
        budgetMaxCallsPerDay: 20,
      },
    )

    expect(apiMocks.post).toHaveBeenCalledWith(
      '/ai-gateway/access-policies',
      expect.objectContaining({
        name: 'Production guardrail',
        enabled: true,
        approvalPolicy: expect.objectContaining({ strategy: 'require_approval' }),
        conditions: expect.objectContaining({
          budget: expect.objectContaining({ maxCallsPerDay: 20 }),
        }),
      }),
    )
  })

  it('keeps personal-token visibility explicit for administrators and owners', async () => {
    await gatewayApi.personalTokens.list('all')
    await gatewayApi.personalTokens.list('mine')

    expect(apiMocks.get).toHaveBeenNthCalledWith(1, '/ai-gateway/personal-access-tokens?scope=all')
    expect(apiMocks.get).toHaveBeenNthCalledWith(2, '/ai-gateway/personal-access-tokens')
  })
})
