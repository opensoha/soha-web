import { useEffect, useRef } from 'react'
import { App } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ApiErrorEventDetail } from '@/services/api-error'
import { API_ERROR_EVENT } from '@/services/api-error'

const NOTIFICATION_DEDUP_WINDOW_MS = 8_000

function notificationKey(error: ApiErrorEventDetail) {
  return `${error.kind}:${error.status}:${error.method ?? 'GET'}:${error.path ?? ''}:${error.message}`
}

function requestLabel(error: ApiErrorEventDetail) {
  const method = error.method ?? 'GET'
  return error.path ? `${method} ${error.path}` : method
}

function requestDescription(error: ApiErrorEventDetail, fallback: string) {
  const suffix = error.requestId ? ` 请求 ID: ${error.requestId}` : ''
  return `${fallback}${suffix}`
}

export function GlobalApiErrorHandler() {
  const { notification } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const lastShownAt = useRef(new Map<string, number>())

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const error = (event as CustomEvent<ApiErrorEventDetail>).detail
      if (!error) return

      const key = notificationKey(error)
      const now = Date.now()
      const last = lastShownAt.current.get(key)
      if (last && now - last < NOTIFICATION_DEDUP_WINDOW_MS) {
        return
      }
      lastShownAt.current.set(key, now)

      if (error.kind === 'auth') {
        notification.warning({
          key: 'api-auth-expired',
          message: '登录状态已失效',
          description: requestDescription(error, '请重新登录后继续操作。'),
        })
        if (!location.pathname.startsWith('/login')) {
          navigate('/login', { replace: true, state: { from: location } })
        }
        return
      }

      if (error.kind === 'forbidden') {
        notification.warning({
          key,
          message: '没有权限访问该资源',
          description: requestDescription(error, `${requestLabel(error)} 被服务端拒绝。`),
        })
        return
      }

      if (error.kind === 'server') {
        notification.error({
          key,
          message: '服务端处理失败',
          description: requestDescription(
            error,
            `${requestLabel(error)} 返回 ${error.status}: ${error.message}`,
          ),
        })
        return
      }

      if (error.kind === 'network') {
        notification.error({
          key,
          message: '无法连接 API 服务',
          description: `${requestLabel(error)} 请求未到达服务端: ${error.message}`,
        })
      }
    }

    window.addEventListener(API_ERROR_EVENT, handleApiError)
    return () => window.removeEventListener(API_ERROR_EVENT, handleApiError)
  }, [location, navigate, notification])

  return null
}
