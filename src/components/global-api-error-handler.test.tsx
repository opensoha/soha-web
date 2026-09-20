/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError, emitApiError } from '@/services/api-error'
import { GlobalApiErrorHandler } from './global-api-error-handler'

const notifications = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn() }))
vi.mock('antd', () => ({ App: { useApp: () => ({ notification: notifications }) } }))
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
function Location() {
  const location = useLocation()
  return <output>{location.pathname}</output>
}
async function mount(path = '/access/roles') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <GlobalApiErrorHandler />
        <Location />
      </MemoryRouter>,
    )
  })
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-20T00:00:00Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
it('deduplicates infrastructure feedback while retaining the request ID', async () => {
  await mount()
  const error = new ApiError(503, 'temporarily unavailable', {
    path: '/access/roles',
    method: 'POST',
    requestId: 'req-503',
  })
  await act(async () => {
    emitApiError(error)
    emitApiError(error)
  })
  expect(notifications.error).toHaveBeenCalledTimes(1)
  expect(notifications.error).toHaveBeenCalledWith(
    expect.objectContaining({ description: expect.stringContaining('req-503') }),
  )
  await act(async () => {
    vi.advanceTimersByTime(8000)
    emitApiError(error)
  })
  expect(notifications.error).toHaveBeenCalledTimes(2)
})
it('keeps permission rejection separate from client validation feedback', async () => {
  await mount()
  await act(async () => {
    emitApiError(new ApiError(403, 'denied', { path: '/access/roles' }))
    emitApiError(new ApiError(409, 'name exists', { path: '/access/roles' }))
  })
  expect(notifications.warning).toHaveBeenCalledTimes(1)
  expect(notifications.error).not.toHaveBeenCalled()
  expect(container.textContent).toBe('/access/roles')
})
it.each(['/access/roles', '/login'])(
  'handles session expiry from %s without losing the login destination',
  async (path) => {
    await mount(path)
    await act(async () => emitApiError(new ApiError(401, 'expired')))
    expect(container.textContent).toBe('/login')
    expect(notifications.warning).toHaveBeenCalledTimes(1)
  },
)
