import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({ getEnvelope: vi.fn(), post: vi.fn() }))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

import { computeApi } from './api'

describe('compute api', () => {
  beforeEach(() => {
    apiMocks.getEnvelope.mockReset()
    apiMocks.post.mockReset()
  })

  it('uses canonical contract endpoints and omits empty filters', async () => {
    apiMocks.getEnvelope.mockResolvedValue({ items: [] })

    await computeApi.overview()
    await computeApi.accessSources({ sourceType: 'runtime_host', providerKey: '', limit: 50 })
    await computeApi.tasks({
      domain: 'container_runtime',
      status: 'failed',
      category: 'operation',
      resourceKind: 'project',
      resourceId: 'project-1',
    })

    expect(apiMocks.getEnvelope).toHaveBeenNthCalledWith(1, '/compute/overview')
    expect(apiMocks.getEnvelope).toHaveBeenNthCalledWith(
      2,
      '/compute/access-sources?sourceType=runtime_host&limit=50',
    )
    expect(apiMocks.getEnvelope).toHaveBeenNthCalledWith(
      3,
      '/compute/tasks?domain=container_runtime&status=failed&category=operation&resourceKind=project&resourceId=project-1',
    )
  })

  it('uses the unified task detail, log, cancel, and retry endpoints', async () => {
    apiMocks.getEnvelope.mockResolvedValue({ data: {} })
    apiMocks.post.mockResolvedValue({ data: {} })

    await computeApi.task('virtualization', 'task/one')
    await computeApi.taskLogs('virtualization', 'task/one')
    await computeApi.cancelTask('virtualization', 'task/one')
    await computeApi.retryTask('container_runtime', 'task/two')

    expect(apiMocks.getEnvelope).toHaveBeenNthCalledWith(
      1,
      '/compute/tasks/virtualization/task%2Fone',
    )
    expect(apiMocks.getEnvelope).toHaveBeenNthCalledWith(
      2,
      '/compute/tasks/virtualization/task%2Fone/logs',
    )
    expect(apiMocks.post).toHaveBeenNthCalledWith(
      1,
      '/compute/tasks/virtualization/task%2Fone/cancel',
    )
    expect(apiMocks.post).toHaveBeenNthCalledWith(
      2,
      '/compute/tasks/container_runtime/task%2Ftwo/retry',
    )
  })
})
