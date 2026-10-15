import { ApiError } from '@/services/api-error'

export function readableQueryData<T>(query: { data?: T; error: Error | null }) {
  return query.error instanceof ApiError && [401, 403].includes(query.error.status)
    ? undefined
    : query.data
}

export function writeOutcomeUnknown(error?: Error | null) {
  return Boolean(
    error instanceof ApiError &&
    error.method?.toUpperCase() !== 'GET' &&
    ![400, 401, 403, 404, 409, 422, 429].includes(error.status),
  )
}

export function latestSubmittedOperation<T extends { mutation: { submittedAt: number } }>(
  operations: T[],
) {
  return [...operations].sort((a, b) => b.mutation.submittedAt - a.mutation.submittedAt)[0]
}
