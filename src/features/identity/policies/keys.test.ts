import { describe, expect, it } from 'vitest'
import {
  identityPolicyKeys,
  identityPolicyMutationKeys,
  normalizeIdentityPolicyFilters,
} from './keys'

describe('identity policy query keys', () => {
  it('uses stable list and detail hierarchies', () => {
    expect(identityPolicyKeys.lists()).toEqual(['identity', 'policies', 'list'])
    expect(identityPolicyKeys.list({ query: 'grafana', status: 'enabled' })).toEqual([
      'identity',
      'policies',
      'list',
      { query: 'grafana', status: 'enabled' },
    ])
    expect(identityPolicyKeys.detail(' grafana/id ')).toEqual([
      'identity',
      'policies',
      'detail',
      'grafana/id',
    ])
  })

  it('normalizes filters exactly as the API serializer does', () => {
    expect(
      normalizeIdentityPolicyFilters({ query: ' Grafana ', status: '', limit: 20.8, offset: 0.5 }),
    ).toEqual({ query: 'Grafana', limit: 20 })
    expect(identityPolicyKeys.list({ query: '', limit: 0.5, offset: -1 })).toEqual(
      identityPolicyKeys.list(),
    )
  })

  it('provides a stable update mutation key', () => {
    expect(identityPolicyMutationKeys.update).toEqual([
      'identity',
      'policies',
      'mutation',
      'update',
    ])
  })
})
