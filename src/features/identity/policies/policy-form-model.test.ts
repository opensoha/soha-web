import { describe, expect, it } from 'vitest'
import { identityPolicyInputFromValues, policyFormValues } from './policy-form-model'
import type { IdentityApplicationPolicy } from './types'

const policy: IdentityApplicationPolicy = {
  applicationId: 'grafana',
  applicationSlug: 'grafana',
  applicationName: 'Grafana',
  providerType: 'oidc',
  portalVisible: true,
  status: 'enabled',
  assignments: [
    { subjectType: 'role', subjectId: 'admin', effect: 'allow' },
    { subjectType: 'team', subjectId: 'platform', effect: 'deny' },
  ],
  conditions: { requireMfa: true, allowedCidrs: ['10.0.0.0/8'], startTimeUtc: '08:00', endTimeUtc: '18:00' },
  updatedAt: '2026-07-10T00:00:00Z',
}

describe('identity policy form model', () => {
  it('loads existing assignments into editable values without transport fields', () => {
    expect(policyFormValues(policy)).toEqual({
      allowedCidrs: ['10.0.0.0/8'],
      assignments: [
        { subjectType: 'role', subjectId: 'admin', effect: 'allow' },
        { subjectType: 'team', subjectId: 'platform', effect: 'deny' },
      ],
      endTimeUtc: '18:00',
      requireMfa: true,
      startTimeUtc: '08:00',
    })
  })

  it('trims subjects and conditions, drops empty rows, and preserves deny effects', () => {
    expect(
      identityPolicyInputFromValues({
        assignments: [
          { subjectType: 'user', subjectId: ' user-1 ', effect: 'allow' },
          { subjectType: 'team', subjectId: ' ', effect: 'allow' },
          { subjectType: 'role', subjectId: 'admin', effect: 'deny' },
        ],
        allowedCidrs: [' 10.0.0.0/8 ', '10.0.0.0/8'],
        requireMfa: true,
        startTimeUtc: '08:00',
        endTimeUtc: '18:00',
      }),
    ).toEqual({
      assignments: [
        { subjectType: 'user', subjectId: 'user-1', effect: 'allow' },
        { subjectType: 'role', subjectId: 'admin', effect: 'deny' },
      ],
      conditions: { allowedCidrs: ['10.0.0.0/8'], requireMfa: true, startTimeUtc: '08:00', endTimeUtc: '18:00' },
    })
  })

  it('keeps an empty assignment list as authenticated-user access', () => {
    expect(identityPolicyInputFromValues({ assignments: [], allowedCidrs: [], requireMfa: false, startTimeUtc: '', endTimeUtc: '' })).toEqual({
      assignments: [],
      conditions: { allowedCidrs: [], requireMfa: false, startTimeUtc: '', endTimeUtc: '' },
    })
  })
})
