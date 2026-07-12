import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api-client'
import { authKeys } from './keys'
import { authProfileApi } from './profile-api'

vi.mock('@/services/api-client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}))

describe('auth profile data boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('preserves profile and personal token query keys', () => {
    expect(authKeys.profile()).toEqual(['auth-profile'])
    expect(authKeys.profileGatewayTokens()).toEqual(['ai-gateway', 'personal-access-tokens'])
  })

  it('preserves profile and gateway token wire paths', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    vi.mocked(api.post).mockResolvedValue({ data: {} })

    await authProfileApi.get()
    await authProfileApi.update({ email: 'ops@example.com', displayName: 'Ops' })
    await authProfileApi.changePassword({ currentPassword: 'old', newPassword: 'new' })
    await authProfileApi.listGatewayTokens()
    await authProfileApi.createGatewayToken({
      name: 'cli',
      permissionKeys: ['ai.gateway.invoke'],
      scopes: [],
    })
    await authProfileApi.revokeGatewayToken('token-1')
    await authProfileApi.rotateGatewayToken('token-1')

    expect(api.get).toHaveBeenNthCalledWith(1, '/auth/profile')
    expect(api.patch).toHaveBeenCalledWith('/auth/profile', {
      email: 'ops@example.com',
      displayName: 'Ops',
    })
    expect(api.post).toHaveBeenCalledWith('/auth/profile/password', {
      currentPassword: 'old',
      newPassword: 'new',
    })
    expect(api.get).toHaveBeenNthCalledWith(2, '/ai-gateway/personal-access-tokens')
    expect(api.post).toHaveBeenCalledWith('/ai-gateway/personal-access-tokens', {
      name: 'cli',
      permissionKeys: ['ai.gateway.invoke'],
      scopes: [],
    })
    expect(api.post).toHaveBeenCalledWith('/ai-gateway/personal-access-tokens/token-1/revoke')
    expect(api.post).toHaveBeenCalledWith('/ai-gateway/personal-access-tokens/token-1/rotate')
  })
})
