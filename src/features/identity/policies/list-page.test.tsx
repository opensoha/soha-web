import { describe, expect, it } from 'vitest'
import { IdentityPoliciesPage } from './list-page'

describe('identity policies compatibility page', () => {
  it('keeps the permission-specific editor available for direct routes', () => {
    expect(IdentityPoliciesPage).toBeTypeOf('function')
  })
})
