import { describe, expect, it } from 'vitest'
import { computeTaskCategoryFromPath, computeTaskFiltersFromLocation } from './page'

describe('compute task legacy filters', () => {
  it('maps legacy operation links into the unified projection filters', () => {
    expect(
      computeTaskFiltersFromLocation(
        '/virtualization/operations',
        new URLSearchParams('abnormal=true&assetType=asset_sync'),
      ),
    ).toMatchObject({
      domain: 'virtualization',
      status: 'failed',
      category: 'sync',
    })
    expect(
      computeTaskFiltersFromLocation('/docker/operations', new URLSearchParams('pending=true')),
    ).toMatchObject({ domain: 'container_runtime', status: 'running' })
  })

  it('maps task-center routes onto category filters', () => {
    expect(computeTaskCategoryFromPath('/compute/tasks/all')).toBeUndefined()
    expect(computeTaskCategoryFromPath('/compute/tasks/sync')).toBe('sync')
    expect(computeTaskCategoryFromPath('/compute/tasks/build')).toBe('build')
    expect(computeTaskCategoryFromPath('/compute/tasks/operations')).toBeUndefined()
  })
})
