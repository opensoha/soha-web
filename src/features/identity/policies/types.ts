import type { IdentityApplicationPolicyInput, IdentityApplicationStatus } from '../shared/types'

export type { IdentityApplicationPolicy, IdentityApplicationPolicyInput } from '../shared/types'

export interface IdentityPolicyFilters {
  query?: string
  status?: IdentityApplicationStatus | ''
  limit?: number
  offset?: number
}

export interface UpdateIdentityPolicyVariables {
  applicationId: string
  input: IdentityApplicationPolicyInput
}
