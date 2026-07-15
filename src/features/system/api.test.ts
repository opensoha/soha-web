import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveSystemEndpointScope, systemApi } from './api'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

describe('systemApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the canonical online-user endpoint contract', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      userName: 'operator',
      email: 'operator@example.test',
      providerType: 'oidc',
      status: 'active',
      createdAt: '2026-07-10T00:00:00Z',
      lastSeenAt: '2026-07-10T01:00:00Z',
      expiresAt: '2026-07-11T00:00:00Z',
      metadata: { source: 'console', sourceIp: '127.0.0.1', userAgent: 'browser' },
    }
    apiMocks.get.mockResolvedValue({ data: [session] })

    expect(resolveSystemEndpointScope('/identity/audit')).toBe('identity')
    expect(resolveSystemEndpointScope('/system/online-users')).toBe('system')
    expect(resolveSystemEndpointScope('/system/audit')).toBe('system')
    await expect(systemApi.sessions.list()).resolves.toEqual([
      expect.objectContaining({
        id: 'session-1',
        loginTime: session.createdAt,
        expiry: session.expiresAt,
        source: 'console',
      }),
    ])
    expect(apiMocks.get).toHaveBeenCalledWith('/auth/sessions')
  })

  it('uses the matching audit endpoint and serializes normalized filters', async () => {
    apiMocks.get.mockResolvedValue({ data: [] })

    await systemApi.audit.list('identity', {
      action: ' login ',
      result: '',
      metadataKey: 'usageSnapshot.templateId',
      metadataValue: ' template/a ',
    })
    await systemApi.audit.list('system', { result: 'failure' })
    await systemApi.operationLogs.list({
      operationType: ' platform.resource.apply ',
      metadataKey: '',
      metadataValue: ' workload/a ',
    })

    expect(apiMocks.get).toHaveBeenNthCalledWith(
      1,
      '/identity/audit/events?action=login&metadataKey=usageSnapshot.templateId&metadataValue=template%2Fa',
    )
    expect(apiMocks.get).toHaveBeenNthCalledWith(2, '/audit/logs?result=failure')
    expect(apiMocks.get).toHaveBeenNthCalledWith(
      3,
      '/operations/logs?operationType=platform.resource.apply&metadataValue=workload%2Fa',
    )
  })

  it('unwraps menu CRUD and encodes record identifiers', async () => {
    const menu = { id: 'menu/a', labelZh: '菜单 A' }
    apiMocks.post.mockResolvedValue({ data: menu })
    apiMocks.put.mockResolvedValue({ data: menu })
    apiMocks.delete.mockResolvedValue(undefined)

    await expect(systemApi.menus.create({ id: 'menu/a' })).resolves.toBe(menu)
    await expect(
      systemApi.menus.update({ id: 'menu/a', values: { labelZh: '菜单 A' } }),
    ).resolves.toBe(menu)
    await expect(systemApi.menus.remove('menu/a')).resolves.toBeUndefined()

    expect(apiMocks.post).toHaveBeenCalledWith('/menus', { id: 'menu/a' })
    expect(apiMocks.put).toHaveBeenCalledWith('/menus/menu%2Fa', { labelZh: '菜单 A' })
    expect(apiMocks.delete).toHaveBeenCalledWith('/menus/menu%2Fa')
  })
})
