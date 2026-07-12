/** @vitest-environment jsdom */

import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalSecurityPage } from './page'

const apiMocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

const security = {
  principal: {
    userId: 'user-1',
    userName: 'admin',
    email: 'admin@example.test',
    roles: ['platform-admin'],
    teams: ['operations'],
    projects: [],
    tags: ['on-call'],
  },
  mfaEnabled: true,
  linkedSources: ['oidc'],
  activeSession: 2,
  recentLoginAt: '2026-01-01T00:00:00Z',
}

const mountedRoots: Root[] = []

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.get.mockResolvedValue({ data: security })
})

afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) root.unmount()
  })
  document.body.innerHTML = ''
})

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('Provider Portal security page', () => {
  it('renders the unwrapped security summary and principal memberships', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mountedRoots.push(root)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/portal/security']}>
            <PortalSecurityPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )
    })
    await flushAsyncWork()

    expect(apiMocks.get).toHaveBeenCalledWith('/portal/security')
    expect(container.textContent).toContain('admin@example.test')
    expect(container.textContent).toContain('platform-admin')
    expect(container.textContent).toContain('operations')
    expect(container.textContent).toContain('on-call')
    expect(container.textContent).toContain('oidc')
  })
})
