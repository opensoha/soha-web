/** @vitest-environment jsdom */
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App, ConfigProvider } from 'antd'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { ApiError, emitApiError } from '@/services/api-error'
import { GlobalApiErrorHandler } from './global-api-error-handler'
import { ReadFeedback } from './request-feedback'

it('removes queued Antd notifications when an inline read changes from server failure to denial', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  let showError: (error: ApiError) => void = () => {}
  function Read() {
    const [error, setError] = useState<ApiError | null>(null)
    showError = setError
    return (
      <ReadFeedback
        label="记录"
        query={{ data: [], error, isError: Boolean(error), isFetching: false }}
      />
    )
  }
  try {
    await act(async () =>
      root.render(
        <ConfigProvider theme={{ token: { motion: false } }}>
          <App>
            <MemoryRouter>
              <GlobalApiErrorHandler />
              <Read />
            </MemoryRouter>
          </App>
        </ConfigProvider>,
      ),
    )
    for (const status of [503, 403]) {
      const error = new ApiError(status, 'read unavailable', { path: '/records' })
      await act(async () => {
        emitApiError(error)
        showError(error)
      })
      await vi.waitFor(() =>
        expect(document.querySelectorAll('.ant-notification-notice')).toHaveLength(0),
      )
    }
    expect(container.textContent).toContain('记录无访问权限')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
