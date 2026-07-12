import { describe, expect, it } from 'vitest'
import { systemKeys, systemMutationKeys } from './keys'

describe('systemKeys', () => {
  it('keeps identity and system session caches separate under one canonical root', () => {
    expect(systemKeys.sessions.list('identity')).toEqual(['online-users', 'identity'])
    expect(systemKeys.sessions.list('system')).toEqual(['online-users', 'system'])
    expect(systemMutationKeys.sessions('revoke', 'identity')).toEqual([
      'online-users',
      'mutation',
      'revoke',
      'identity',
    ])
  })

  it('normalizes audit and operation filters for stable cache identity', () => {
    expect(
      systemKeys.audit.list('identity', {
        action: ' login ',
        result: '',
        metadataValue: ' user-1 ',
      }),
    ).toEqual(['audit-logs', 'identity', { action: 'login', metadataValue: 'user-1' }])
    expect(systemKeys.operationLogs.list({ operationType: ' apply ', metadataKey: ' ' })).toEqual([
      'operation-logs',
      { operationType: 'apply' },
    ])
  })
})
