/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { normalizeLocalReturnTo, shouldUseDocumentNavigation } from './return-to'

describe('normalizeLocalReturnTo', () => {
  it('accepts local absolute paths and same-origin URLs as local paths', () => {
    expect(normalizeLocalReturnTo('/portal/applications/app-1?tab=overview#top')).toBe(
      '/portal/applications/app-1?tab=overview#top',
    )
    expect(normalizeLocalReturnTo(`${window.location.origin}/portal/applications/app-1`)).toBe(
      '/portal/applications/app-1',
    )
  })

  it('rejects external, protocol-relative, backslash, and control-character values', () => {
    for (const value of [
      '//evil.example/path',
      'https://evil.example/path',
      '/portal\nnext',
      '/portal?next=%0A',
      '/\\evil',
      '/%5Cevil',
    ]) {
      expect(normalizeLocalReturnTo(value)).toBeNull()
    }
  })
})

describe('shouldUseDocumentNavigation', () => {
  it('uses document navigation for server protocol callback paths', () => {
    expect(shouldUseDocumentNavigation('/oauth2/authorize?client_id=portal')).toBe(true)
    expect(shouldUseDocumentNavigation('/api/v1/provider/proxy/callback?state=resume')).toBe(true)
    expect(shouldUseDocumentNavigation('/portal/applications/app-1')).toBe(false)
  })
})
