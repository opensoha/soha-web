import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listApplicationEnvironments,
  listApplications,
  listBuilds,
  listReleases,
  listWorkflows,
} from './linkage-api'

const apiMocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

describe('deployment linkage api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unwraps delivery linkage collections without entering workload transport', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: [{ id: 'environment-a' }] })
      .mockResolvedValueOnce({ data: [{ id: 'application-a' }] })
      .mockResolvedValueOnce({ data: [{ id: 'build-a' }] })
      .mockResolvedValueOnce({ data: [{ id: 'workflow-a' }] })
      .mockResolvedValueOnce({ data: [{ id: 'release-a' }] })

    await expect(listApplicationEnvironments()).resolves.toEqual([{ id: 'environment-a' }])
    await expect(listApplications()).resolves.toEqual([{ id: 'application-a' }])
    await expect(listBuilds()).resolves.toEqual([{ id: 'build-a' }])
    await expect(listWorkflows()).resolves.toEqual([{ id: 'workflow-a' }])
    await expect(listReleases()).resolves.toEqual([{ id: 'release-a' }])
    expect(apiMocks.get.mock.calls.map(([path]) => path)).toEqual([
      '/application-environments',
      '/applications',
      '/builds',
      '/workflows',
      '/releases',
    ])
  })
})
