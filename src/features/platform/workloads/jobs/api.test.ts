import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteJob, getJobDetail, listJobEvents, listJobPods, listJobs } from './api'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

const scope = { clusterId: 'cluster-a', namespace: 'team/a' }
const target = { scope, name: 'nightly/report' }

describe('job api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('unwraps list and detail data while preserving encoded scope and name', async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: [{ name: 'nightly/report' }] })
      .mockResolvedValueOnce({ data: { name: 'nightly/report', namespace: 'team/a' } })

    await expect(listJobs(scope)).resolves.toEqual([{ name: 'nightly/report' }])
    await expect(getJobDetail(target)).resolves.toMatchObject({ name: 'nightly/report' })
    expect(apiMocks.get.mock.calls[0][0]).toBe(
      '/clusters/cluster-a/workloads/jobs?namespace=team%2Fa',
    )
    expect(apiMocks.get.mock.calls[1][0]).toContain(
      '/jobs/nightly%2Freport/detail?namespace=team%2Fa',
    )
  })

  it('filters events and related pods for only the requested Job', async () => {
    apiMocks.get
      .mockResolvedValueOnce({
        data: [
          { involvedKind: 'Job', involvedName: 'nightly/report' },
          { involvedKind: 'CronJob', involvedName: 'nightly/report' },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          { name: 'legacy', labels: { 'job-name': 'nightly/report' } },
          { name: 'batch', labels: { 'batch.kubernetes.io/job-name': 'nightly/report' } },
          { name: 'other', labels: { 'job-name': 'other' } },
        ],
      })

    await expect(listJobEvents(target)).resolves.toHaveLength(1)
    await expect(listJobPods(target)).resolves.toEqual([
      { name: 'legacy', labels: { 'job-name': 'nightly/report' } },
      { name: 'batch', labels: { 'batch.kubernetes.io/job-name': 'nightly/report' } },
    ])
  })

  it('deletes the record in its own namespace', async () => {
    apiMocks.delete.mockResolvedValueOnce({})
    await expect(deleteJob(target)).resolves.toBeUndefined()
    expect(apiMocks.delete).toHaveBeenCalledWith(
      '/clusters/cluster-a/workloads/jobs/nightly%2Freport?namespace=team%2Fa',
    )
  })
})
