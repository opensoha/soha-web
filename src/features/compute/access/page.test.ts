import { describe, expect, it } from 'vitest'
import { computeAccessFiltersFromSearch } from './page'

describe('compute access view filters', () => {
  it('uses virtualization connections as the default view', () => {
    expect(computeAccessFiltersFromSearch(new URLSearchParams())).toEqual({
      sourceType: 'virtualization_connection',
      providerKey: undefined,
      limit: 100,
    })
  })

  it('restores a shareable access view and provider filter', () => {
    expect(
      computeAccessFiltersFromSearch(
        new URLSearchParams('sourceType=runtime_host&providerKey=docker'),
      ),
    ).toMatchObject({ sourceType: 'runtime_host', providerKey: 'docker' })
  })
})
