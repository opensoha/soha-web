import { describe, expect, it } from 'vitest'
import { deploymentLinkageKeys } from './linkage-keys'
import { deploymentLinkageQueries } from './linkage-queries'

describe('deployment linkage query options', () => {
  it('keeps every delivery collection under the linkage key boundary', () => {
    const prefix = deploymentLinkageKeys.all
    const keys = [
      deploymentLinkageQueries.applicationEnvironments().queryKey,
      deploymentLinkageQueries.applications().queryKey,
      deploymentLinkageQueries.builds().queryKey,
      deploymentLinkageQueries.workflows().queryKey,
      deploymentLinkageQueries.releases().queryKey,
    ]

    for (const key of keys) {
      expect(key.slice(0, prefix.length)).toEqual(prefix)
    }
  })
})
