import { describe, expect, it } from 'vitest'
import { isPreflightCurrent, resolveCreateEntryAvailability } from './model'

const scope = {
  clusterIds: ['cluster-a'],
  namespaces: ['minio'],
  resourceGroups: ['configuration'],
  resourceKinds: ['ConfigMap'],
}

describe('resource creation model', () => {
  it('keeps authorization denial distinct from capability unsupported', () => {
    const denied = resolveCreateEntryAvailability({
      clusterId: 'cluster-a',
      decision: {
        allowed: false,
        reason: 'No create permission in minio',
        allowedActions: ['view'],
        resourceScope: scope,
        capability: { key: 'resource.create', status: 'available', mode: 'direct' },
      },
      isLoading: false,
      localeCode: 'en_US',
    })
    const unsupported = resolveCreateEntryAvailability({
      clusterId: 'cluster-a',
      decision: {
        allowed: true,
        allowedActions: ['create'],
        resourceScope: scope,
        capability: {
          key: 'resource.create',
          status: 'unsupported',
          mode: 'agent',
          reason: 'Agent create is unavailable',
        },
      },
      isLoading: false,
      localeCode: 'en_US',
    })

    expect(denied).toEqual({ disabled: true, reason: 'No create permission in minio' })
    expect(unsupported).toEqual({ disabled: true, reason: 'Agent create is unavailable' })
  })

  it('invalidates a successful preflight as soon as content changes', () => {
    const preflight = { ready: true, contentHash: 'abc', items: [] }
    expect(isPreflightCurrent('kind: ConfigMap', 'kind: ConfigMap', preflight)).toBe(true)
    expect(isPreflightCurrent('kind: Secret', 'kind: ConfigMap', preflight)).toBe(false)
  })
})
