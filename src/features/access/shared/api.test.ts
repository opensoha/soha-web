import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accessApi } from './api'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMock }))

describe('access api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('unwraps list responses before returning them to query consumers', async () => {
    const users = [{ id: 'user-1', username: 'admin' }]
    apiMock.get.mockResolvedValueOnce({ data: users })

    await expect(accessApi.users.list()).resolves.toBe(users)
    expect(apiMock.get).toHaveBeenCalledWith('/access/users')
  })

  it('uses explicit encoded resource endpoints for mutations', async () => {
    apiMock.put.mockResolvedValueOnce({ data: {} })
    apiMock.delete.mockResolvedValueOnce({ data: {} })

    await accessApi.roles.update({ id: 'ops/admin', values: { name: 'Ops' } })
    await accessApi.teams.delete('platform/core')

    expect(apiMock.put).toHaveBeenCalledWith('/access/roles/ops%2Fadmin', { name: 'Ops' })
    expect(apiMock.delete).toHaveBeenCalledWith('/access/teams/platform%2Fcore')
  })

  it('normalizes absent login provider settings to an empty option list', async () => {
    apiMock.get.mockResolvedValueOnce({ data: {} })

    await expect(accessApi.dependencies.loginProviders()).resolves.toEqual([])
    expect(apiMock.get).toHaveBeenCalledWith('/settings/identity')
  })
})
