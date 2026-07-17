import { describe, expect, it } from 'vitest'
import {
  computeAccessCursorForPage,
  computeAccessFiltersFromSearch,
  computeAccessPaginationTotal,
} from './page'

describe('compute access view filters', () => {
  it('uses virtualization connections as the default view', () => {
    expect(computeAccessFiltersFromSearch(new URLSearchParams())).toEqual({
      sourceType: 'virtualization_connection',
      providerKey: undefined,
      limit: 20,
    })
  })

  it('restores a shareable access view and provider filter', () => {
    expect(
      computeAccessFiltersFromSearch(
        new URLSearchParams('sourceType=runtime_host&providerKey=docker'),
      ),
    ).toMatchObject({ sourceType: 'runtime_host', providerKey: 'docker' })
  })

  it('derives bounded pagination from cursor-backed access pages', () => {
    expect(computeAccessPaginationTotal(1, 20, 20, true)).toBe(21)
    expect(computeAccessPaginationTotal(3, 20, 7, false)).toBe(47)
    expect(computeAccessCursorForPage(1, ['', 'cursor-2'], 3)).toBeUndefined()
    expect(computeAccessCursorForPage(2, ['', 'cursor-2'], 3)).toBe('cursor-2')
  })
})
