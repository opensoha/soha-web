import type {
  IdentityApplicationPolicy,
  IdentityApplicationPolicyInput,
  IdentityAssignmentSubjectType,
} from '../shared/types'

export interface IdentityPolicyFormValues {
  assignments: Array<{
    effect: 'allow'
    subjectId: string
    subjectType: IdentityAssignmentSubjectType
  }>
}

export const assignmentSubjectOptions: Array<{
  label: string
  value: IdentityAssignmentSubjectType
}> = [
  { label: 'User', value: 'user' },
  { label: 'Role', value: 'role' },
  { label: 'Team', value: 'team' },
  { label: 'Tag', value: 'tag' },
]

export function policyFormValues(policy: IdentityApplicationPolicy): IdentityPolicyFormValues {
  return {
    assignments: (policy.assignments ?? []).map((assignment) => ({
      effect: 'allow',
      subjectId: assignment.subjectId,
      subjectType: assignment.subjectType,
    })),
  }
}

export function identityPolicyInputFromValues(
  values: IdentityPolicyFormValues,
): IdentityApplicationPolicyInput {
  return {
    assignments: (values.assignments ?? [])
      .filter((assignment) => String(assignment.subjectId ?? '').trim())
      .map((assignment) => ({
        effect: 'allow',
        subjectId: assignment.subjectId.trim(),
        subjectType: assignment.subjectType || 'role',
      })),
  }
}
