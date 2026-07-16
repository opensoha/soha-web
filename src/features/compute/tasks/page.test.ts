import { describe, expect, it } from 'vitest'
import { computeTaskCategoryFromPath, searchFromTaskFilters } from './page'

describe('compute task filters', () => {
  it('maps task-center routes onto category filters', () => {
    expect(computeTaskCategoryFromPath('/compute/tasks/all')).toBeUndefined()
    expect(computeTaskCategoryFromPath('/compute/tasks/sync')).toBe('sync')
    expect(computeTaskCategoryFromPath('/compute/tasks/build')).toBe('build')
    expect(computeTaskCategoryFromPath('/compute/tasks/operations')).toBeUndefined()
  })

  it('preserves category, resource, and log drawer state in the URL', () => {
    expect(
      searchFromTaskFilters(
        { category: 'sync', resourceKind: 'connection', resourceId: 'cluster-1', limit: 100 },
        { domain: 'virtualization', taskId: 'task-1' },
      ).toString(),
    ).toBe(
      'category=sync&resourceKind=connection&resourceId=cluster-1&domain=virtualization&taskId=task-1&view=logs',
    )
  })
})
