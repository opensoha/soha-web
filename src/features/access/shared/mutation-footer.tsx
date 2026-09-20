import type { ReactNode } from 'react'
import { Alert, type ModalProps } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import { localeText, useI18n } from '@/i18n'
import { isApiError } from '@/services/api-error'

export const accessMutationModalStyles: ModalProps['styles'] = {
  header: {
    minHeight: 32,
    display: 'flex',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 0,
  },
  body: {
    maxHeight: 'calc(100dvh - 300px)',
    overflowY: 'auto',
    scrollbarGutter: 'stable',
  },
  footer: {
    marginTop: 16,
    paddingTop: 0,
  },
}

interface AccessMutationFooterProps {
  children: ReactNode
  error: Error | null
  saving: boolean
}

export function AccessMutationFooter({ children, error, saving }: AccessMutationFooterProps) {
  const { localeCode } = useI18n()
  const uncertain = isApiError(error) && (error.kind === 'network' || error.kind === 'server')

  return (
    <div className="soha-access-mutation-footer">
      {error ? (
        <Alert
          showIcon
          type="error"
          title={localeText(
            localeCode,
            uncertain ? '保存结果未确认' : '保存未完成',
            uncertain ? 'Save result not confirmed' : 'Unable to save',
          )}
          description={
            <div className="soha-access-mutation-error">
              <span>{error.message}</span>
              <span>
                {localeText(
                  localeCode,
                  uncertain
                    ? '输入已保留。请先核对列表中的结果，再决定是否重新提交。'
                    : '输入已保留，检查后可重新提交。',
                  uncertain
                    ? 'Your input is preserved. Check the list before submitting again.'
                    : 'Your input is preserved. Review it and submit again.',
                )}
              </span>
              {isApiError(error) && error.requestId ? (
                <span>
                  {localeText(localeCode, '请求 ID', 'Request ID')}: {error.requestId}
                </span>
              ) : null}
            </div>
          }
        />
      ) : null}
      <div className="soha-access-mutation-actions">
        <span className="soha-access-mutation-status" role="status">
          {saving ? (
            <>
              <LoadingOutlined /> {localeText(localeCode, '正在保存…', 'Saving…')}
            </>
          ) : null}
        </span>
        <div className="soha-access-mutation-buttons">{children}</div>
      </div>
    </div>
  )
}
