import { z } from 'zod'
import type { ErrorEnvelope } from '@/types'

export const API_ERROR_EVENT = 'soha:api-error'

export type ApiErrorKind = 'auth' | 'forbidden' | 'server' | 'network' | 'client'

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    request_id: z.string().trim().min(1).optional(),
  }),
})

type ParsedErrorEnvelope = z.infer<typeof errorEnvelopeSchema>

export interface ApiErrorOptions {
  code?: string
  method?: string
  path?: string
  requestId?: string
  cause?: unknown
}

export class ApiError extends Error {
  readonly code?: string
  readonly kind: ApiErrorKind
  readonly method?: string
  readonly path?: string
  readonly requestId?: string
  readonly originalCause?: unknown

  constructor(status: number, message: string, options: ApiErrorOptions = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = options.code
    this.kind = classifyApiStatus(status)
    this.method = options.method
    this.path = options.path
    this.requestId = options.requestId
    this.originalCause = options.cause
  }

  readonly status: number
}

export interface ApiErrorEventDetail {
  code?: string
  kind: ApiErrorKind
  message: string
  method?: string
  path?: string
  requestId?: string
  status: number
}

export function classifyApiStatus(status: number): ApiErrorKind {
  if (status === 0) return 'network'
  if (status === 401) return 'auth'
  if (status === 403) return 'forbidden'
  if (status >= 500) return 'server'
  return 'client'
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

function parseErrorEnvelope(body: unknown): ParsedErrorEnvelope | undefined {
  const result = errorEnvelopeSchema.safeParse(body)
  return result.success ? result.data : undefined
}

function legacyErrorEnvelopeMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined
  }
  const payload = body as {
    error?: unknown
    message?: unknown
  }
  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message
  }
  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error
  }
  if (payload.error && typeof payload.error === 'object') {
    const message = (payload.error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }
  return undefined
}

function legacyErrorEnvelopeRequestId(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined
  }
  const error = (body as { error?: unknown }).error
  if (!error || typeof error !== 'object') {
    return undefined
  }
  const requestID = (error as { request_id?: unknown }).request_id
  return typeof requestID === 'string' && requestID.trim() ? requestID : undefined
}

export function getErrorEnvelopeMessage(body: unknown, fallback: string) {
  const parsed = parseErrorEnvelope(body)
  if (parsed) {
    return parsed.error.message
  }
  const legacyMessage = legacyErrorEnvelopeMessage(body)
  if (legacyMessage) {
    return legacyMessage
  }
  if (!body) {
    return fallback
  }
  return fallback
}

function getErrorEnvelopeCode(body: unknown) {
  return parseErrorEnvelope(body)?.error.code
}

function getErrorEnvelopeRequestId(body: unknown) {
  return parseErrorEnvelope(body)?.error.request_id || legacyErrorEnvelopeRequestId(body)
}

export function createApiErrorFromResponse(
  response: Response,
  body: ErrorEnvelope | unknown | undefined,
  options: Pick<ApiErrorOptions, 'method' | 'path'> = {},
) {
  return new ApiError(
    response.status,
    getErrorEnvelopeMessage(body, response.statusText || 'Request failed'),
    {
      ...options,
      code: getErrorEnvelopeCode(body),
      requestId:
        response.headers.get('x-request-id') ||
        response.headers.get('x-correlation-id') ||
        response.headers.get('x-trace-id') ||
        getErrorEnvelopeRequestId(body),
    },
  )
}

export function createNetworkApiError(path: string, method: string, cause: unknown) {
  const message =
    cause instanceof Error && cause.message ? cause.message : 'Unable to reach the API server'
  return new ApiError(0, message, { cause, method, path })
}

export function emitApiError(error: ApiError) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return
  }

  const detail: ApiErrorEventDetail = {
    code: error.code,
    kind: error.kind,
    message: error.message,
    method: error.method,
    path: error.path,
    requestId: error.requestId,
    status: error.status,
  }

  window.dispatchEvent(new CustomEvent<ApiErrorEventDetail>(API_ERROR_EVENT, { detail }))
}
