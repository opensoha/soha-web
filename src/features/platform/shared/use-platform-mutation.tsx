import { useRef, useState, type ReactNode } from 'react'
import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { OperationFeedback, requestErrorMessage } from '@/components/request-feedback'
import { localeText, useI18n } from '@/i18n'
import { writeOutcomeUnknown } from '@/utils/query-feedback'

interface PlatformMutationFeedback<TData, TVariables> {
  label: readonly [string, string]
  target: (variables: TVariables) => string
  readOnly?: boolean
  receipt?: (data: TData, variables: TVariables) => { message: string; evidence?: ReactNode }
  resultError?: (data: TData) => Error | undefined
}

// Keep the original mutation keys, invalidation and callbacks with their resource owner.
export function usePlatformMutation<TData, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, Error, TVariables, TContext>,
  feedback: PlatformMutationFeedback<TData, TVariables>,
) {
  const { localeCode } = useI18n()
  const label = localeText(localeCode, ...feedback.label)
  const fence = useRef(false)
  const uncertain = useRef(false)
  const [target, setTarget] = useState('')
  const mutation = useMutation({
    ...options,
    onSuccess: async (...args) => {
      uncertain.current = !feedback.readOnly && writeOutcomeUnknown(feedback.resultError?.(args[0]))
      await options.onSuccess?.(...args)
    },
    onError: async (...args) => {
      uncertain.current = !feedback.readOnly && writeOutcomeUnknown(args[0])
      await options.onError?.(...args)
    },
    onSettled: async (...args) => {
      try {
        await options.onSettled?.(...args)
      } finally {
        fence.current = false
      }
    },
  })
  const resultError = mutation.isSuccess ? feedback.resultError?.(mutation.data) : undefined
  const outcomeUnknown = !feedback.readOnly && writeOutcomeUnknown(mutation.error ?? resultError)
  const begin = (variables: TVariables) => {
    if (fence.current || uncertain.current) return false
    const submittedTarget = feedback.target(variables)
    fence.current = true
    setTarget(submittedTarget)
    return true
  }
  const receipt = mutation.isSuccess
    ? (feedback.receipt?.(mutation.data, mutation.variables as TVariables) ?? {
        message: localeText(localeCode, `${label}：请求已返回`, `${label}: request returned`),
        evidence: feedback.readOnly
          ? localeText(localeCode, '预检未执行资源变更。', 'Preflight did not change resources.')
          : localeText(
              localeCode,
              '请核对下方资源记录，实际就绪状态以集群观察结果为准。',
              'Review the resource records. Readiness follows the observed cluster state.',
            ),
      })
    : undefined
  const visibleReceipt = outcomeUnknown
    ? {
        message: receipt?.message ?? '',
        evidence: (
          <>
            {receipt?.evidence}
            <p>
              {localeText(
                localeCode,
                '当前页已暂停再次提交；普通刷新不会确认或解锁原请求。请保留请求 ID 核对审计与资源记录。',
                'Further submissions are paused on this page. Refresh does not confirm or unlock the original request. Keep the request ID to check audit and resource records.',
              )}
            </p>
          </>
        ),
      }
    : receipt

  return {
    ...mutation,
    blocked: mutation.isPending || outcomeUnknown,
    outcomeUnknown,
    mutate: ((variables, callbacks) => {
      if (begin(variables)) mutation.mutate(variables, callbacks)
    }) as typeof mutation.mutate,
    mutateAsync: ((variables, callbacks) => {
      if (!begin(variables))
        return Promise.reject(
          new Error(
            localeText(
              localeCode,
              '原请求尚待核对，请勿重复提交。',
              'Check the original request before submitting again.',
            ),
          ),
        )
      return mutation.mutateAsync(variables, callbacks)
    }) as typeof mutation.mutateAsync,
    reset: () => {
      if (!fence.current && !uncertain.current) mutation.reset()
    },
    feedback: (
      <OperationFeedback
        label={label}
        target={target}
        pending={mutation.isPending}
        error={mutation.error ?? resultError}
        readOnly={feedback.readOnly}
        receipt={visibleReceipt}
      />
    ),
  }
}

export function platformBatchUnknown(results: readonly PromiseSettledResult<unknown>[]) {
  const uncertain = results.find(
    (item) => item.status === 'rejected' && writeOutcomeUnknown(item.reason),
  )
  return uncertain?.status === 'rejected' ? (uncertain.reason as Error) : undefined
}

export function platformBatchReceipt(
  results: readonly PromiseSettledResult<unknown>[],
  targets: string[],
  localeCode: 'zh_CN' | 'en_US',
) {
  const accepted = results.filter((item) => item.status === 'fulfilled').length
  return {
    message: localeText(
      localeCode,
      `批量请求已返回：${accepted} 项成功，${results.length - accepted} 项失败或待核对`,
      `Batch returned: ${accepted} requests succeeded; ${results.length - accepted} failed or need checking`,
    ),
    evidence: (
      <ul>
        {results.map((item, index) => (
          <li key={`${index}/${targets[index]}`}>
            {targets[index]} ·{' '}
            {item.status === 'fulfilled'
              ? localeText(
                  localeCode,
                  '请求成功，实际状态以资源记录为准',
                  'Request succeeded; check resource state',
                )
              : `${localeText(localeCode, writeOutcomeUnknown(item.reason) ? '结果不明' : '请求失败', writeOutcomeUnknown(item.reason) ? 'Outcome unknown' : 'Request failed')} · ${requestErrorMessage(item.reason instanceof Error ? item.reason : new Error(String(item.reason)), localeCode)}`}
          </li>
        ))}
      </ul>
    ),
  }
}

export function platformResourceTarget(target: {
  scope?: { clusterId: string | null; namespace?: string | null }
  clusterId?: string
  namespace?: string | null
  name?: string
  releaseName?: string
  resourceName?: string
  sessionId?: string
}) {
  return [
    target.scope?.clusterId ?? target.clusterId,
    target.scope?.namespace ?? target.namespace,
    target.name ?? target.releaseName ?? target.resourceName ?? target.sessionId,
  ]
    .filter(Boolean)
    .join(' / ')
}
