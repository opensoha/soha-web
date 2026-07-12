/** @vitest-environment jsdom */

import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp } from 'antd'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SohaProviderPortalPage } from './page'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

const application = {
  id: 'app-1',
  slug: 'console',
  name: 'Operations Console',
  description: 'Manage production services',
  category: 'Operations',
  tags: ['production'],
  providerType: 'link',
  portalVisible: true,
  featured: true,
  favorite: true,
  sortOrder: 1,
  status: 'enabled',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const bootstrap = {
  principal: {
    userId: 'user-1',
    userName: 'admin',
    email: 'admin@example.test',
    roles: ['admin'],
    teams: [],
    projects: [],
    tags: [],
  },
  applications: [application],
  favorites: [application],
  recent: [],
  categories: ['Operations'],
  security: {
    principal: {
      userId: 'user-1',
      userName: 'admin',
      email: 'admin@example.test',
      roles: ['admin'],
      teams: [],
      projects: [],
      tags: [],
    },
    mfaEnabled: true,
    linkedSources: ['oidc'],
    activeSession: 1,
  },
}

const mountedRoots: Root[] = []

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

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
  apiMocks.get.mockResolvedValue({ data: bootstrap })
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

async function renderPage() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/portal']}>
            <LocationProbe />
            <SohaProviderPortalPage />
          </MemoryRouter>
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  await flushAsyncWork()
  return container
}

describe('Provider Portal catalog page', () => {
  it('renders unwrapped bootstrap data and preserves portal navigation', async () => {
    const container = await renderPage()

    expect(apiMocks.get).toHaveBeenCalledWith('/portal/bootstrap')
    expect(container.textContent).toContain('Operations Console')
    expect(container.textContent).toContain('1 available')
    expect(container.textContent).toContain('Enabled')

    const securityButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Security',
    )
    await act(async () => securityButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(
      '/portal/security',
    )
  })
})
