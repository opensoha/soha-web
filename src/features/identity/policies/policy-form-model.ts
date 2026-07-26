import type {
  IdentityApplicationPolicy,
  IdentityApplicationPolicyInput,
  IdentityAssignmentEffect,
  IdentityAssignmentSubjectType,
} from '../shared/types'

export interface IdentityPolicyFormValues {
  allowedCidrs: string[]
  assignments: Array<{
    effect: IdentityAssignmentEffect
    subjectId: string
    subjectType: IdentityAssignmentSubjectType
  }>
  endTimeUtc: string
  requireMfa: boolean
  startTimeUtc: string
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

export const assignmentEffectOptions = [
  { label: 'Allow', value: 'allow' },
  { label: 'Deny', value: 'deny' },
]

export function policyFormValues(policy: IdentityApplicationPolicy): IdentityPolicyFormValues {
  return {
    allowedCidrs: policy.conditions?.allowedCidrs ?? [],
    assignments: (policy.assignments ?? []).map((assignment) => ({
      effect: assignment.effect || 'allow',
      subjectId: assignment.subjectId,
      subjectType: assignment.subjectType,
    })),
    endTimeUtc: policy.conditions?.endTimeUtc ?? '',
    requireMfa: policy.conditions?.requireMfa ?? false,
    startTimeUtc: policy.conditions?.startTimeUtc ?? '',
  }
}

export function identityPolicyInputFromValues(
  values: IdentityPolicyFormValues,
): IdentityApplicationPolicyInput {
  return {
    assignments: (values.assignments ?? [])
      .filter((assignment) => String(assignment.subjectId ?? '').trim())
      .map((assignment) => ({
        effect: assignment.effect || 'allow',
        subjectId: assignment.subjectId.trim(),
        subjectType: assignment.subjectType || 'role',
      })),
    conditions: {
      allowedCidrs: compactStrings(values.allowedCidrs),
      endTimeUtc: String(values.endTimeUtc ?? '').trim(),
      requireMfa: Boolean(values.requireMfa),
      startTimeUtc: String(values.startTimeUtc ?? '').trim(),
    },
  }
}

function compactStrings(values: string[] = []) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))]
}
