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
    { subjectType: 'team', subjectId: 'platform', effect: 'allow' },
  ],
  updatedAt: '2026-07-10T00:00:00Z',
}

describe('identity policy form model', () => {
  it('loads existing assignments into editable values without transport fields', () => {
    expect(policyFormValues(policy)).toEqual({
      assignments: [
        { subjectType: 'role', subjectId: 'admin', effect: 'allow' },
        { subjectType: 'team', subjectId: 'platform', effect: 'allow' },
      ],
    })
  })

  it('trims subjects, drops empty rows, and enforces allow effects', () => {
    expect(
      identityPolicyInputFromValues({
        assignments: [
          { subjectType: 'user', subjectId: ' user-1 ', effect: 'allow' },
          { subjectType: 'team', subjectId: ' ', effect: 'allow' },
          { subjectType: 'role', subjectId: 'admin', effect: 'allow' },
        ],
      }),
    ).toEqual({
      assignments: [
        { subjectType: 'user', subjectId: 'user-1', effect: 'allow' },
        { subjectType: 'role', subjectId: 'admin', effect: 'allow' },
      ],
    })
  })

  it('keeps an empty assignment list as authenticated-user access', () => {
    expect(identityPolicyInputFromValues({ assignments: [] })).toEqual({ assignments: [] })
  })
})
