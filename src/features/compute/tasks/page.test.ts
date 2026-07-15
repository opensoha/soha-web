import { describe, expect, it } from 'vitest'
import { computeTaskCategoryFromPath } from './page'

describe('compute task filters', () => {
  it('maps task-center routes onto category filters', () => {
    expect(computeTaskCategoryFromPath('/compute/tasks/all')).toBeUndefined()
    expect(computeTaskCategoryFromPath('/compute/tasks/sync')).toBe('sync')
    expect(computeTaskCategoryFromPath('/compute/tasks/build')).toBe('build')
    expect(computeTaskCategoryFromPath('/compute/tasks/operations')).toBeUndefined()
  })
})
