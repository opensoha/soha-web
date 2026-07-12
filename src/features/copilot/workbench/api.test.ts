import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

import { workbenchApi } from './api'

describe('workbenchApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the existing read endpoints', async () => {
    await workbenchApi.sessions.all()
    await workbenchApi.sessions.detail('session-1')
    await workbenchApi.sessions.messages('session-1')
    await workbenchApi.catalog()
    await workbenchApi.agentRuns.all()

    expect(apiMocks.get.mock.calls).toEqual([
      ['/copilot/sessions'],
      ['/copilot/sessions/session-1'],
      ['/copilot/sessions/session-1/messages'],
      ['/copilot/workbench/catalog'],
      ['/copilot/agent-runs'],
    ])
  })

  it('preserves session mutation paths and payloads', async () => {
    const createInput = {
      title: '支付告警调查',
      mode: 'root_cause' as const,
      agentProviderId: 'internal',
      scope: { namespace: 'payments' },
      tags: [],
    }
    const patchBody = { mode: 'trace' }
    const inspectionBody = {
      title: '支付告警调查 巡检模板',
      scopeType: 'namespace',
      namespace: 'payments',
      checks: ['cluster_health'],
      enabled: true,
      intervalMinutes: 30,
      metadata: {},
    }

    await workbenchApi.sessions.create(createInput)
    await workbenchApi.sessions.patch({ sessionId: 'session-1', body: patchBody })
    await workbenchApi.sessions.archive('session-1')
    await workbenchApi.sessions.createInspectionTask({
      sessionId: 'session-1',
      body: inspectionBody,
    })

    expect(apiMocks.post).toHaveBeenNthCalledWith(1, '/copilot/sessions', createInput)
    expect(apiMocks.patch).toHaveBeenCalledWith('/copilot/sessions/session-1', patchBody)
    expect(apiMocks.delete).toHaveBeenCalledWith('/copilot/sessions/session-1')
    expect(apiMocks.post).toHaveBeenNthCalledWith(
      2,
      '/copilot/sessions/session-1/inspection-task',
      inspectionBody,
    )
  })
})
