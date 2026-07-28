import { describe, expect, it } from 'vitest'
import { directorySyncKeys, directorySyncQueries } from './queries'

describe('directory sync queries', () => {
  it('keeps runtime status and events under connection-scoped keys', () => {
    expect(directorySyncKeys.runtimeStatus('dir-1')).toEqual([
      'access',
      'directory-sync',
      'runtime-status',
      'dir-1',
    ])
    expect(directorySyncKeys.events('dir-1')).toEqual([
      'access',
      'directory-sync',
      'events',
      'dir-1',
    ])
    expect(directorySyncQueries.runtimeStatus('').enabled).toBe(false)
    expect(directorySyncQueries.events('dir-1').refetchInterval).toBe(5000)
  })
})
