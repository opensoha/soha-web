import { describe, expect, it } from 'vitest'

import { normalizeBrandingSettings } from '@/utils/branding'

describe('normalizeBrandingSettings', () => {
  it('uses the packaged primary mark when logo settings are empty', () => {
    const branding = normalizeBrandingSettings({
      loginLogoUrl: ' ',
      expandedLogoUrl: '',
      collapsedLogoUrl: '',
      faviconUrl: '',
    })

    expect([
      branding.loginLogoUrl,
      branding.expandedLogoUrl,
      branding.collapsedLogoUrl,
      branding.faviconUrl,
    ]).toEqual(['/logo.svg', '/logo.svg', '/logo.svg', '/logo.svg'])
  })
})
