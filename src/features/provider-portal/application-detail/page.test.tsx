/** @vitest-environment jsdom */

import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp } from 'antd'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalApplicationDetailPage } from './page'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/services/api-client', () => ({ api: apiMocks }))

const application = {
  id: 'app/1',
  slug: 'console',
  name: 'Operations Console',
  description: 'Manage production services',
  category: 'Operations',
  tags: ['production'],
  launchUrl: 'https://console.example.test',
  providerId: 'provider-1',
  providerType: 'link',
  portalVisible: true,
  featured: true,
  favorite: false,
  sortOrder: 1,
  status: 'enabled',
  metadata: { owner: 'platform' },
  assignments: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
}

const mountedRoots: Root[] = []

beforeAll(() => {
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
  apiMocks.get.mockResolvedValue({ data: application })
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

describe('Provider Portal application detail page', () => {
  it('loads the decoded route identifier through the encoded API wire path', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mountedRoots.push(root)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    await act(async () => {
      root.render(
        <AntdApp>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/portal/applications/app%2F1']}>
              <Routes>
                <Route
                  path="/portal/applications/:applicationId"
                  element={<PortalApplicationDetailPage />}
                />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </AntdApp>,
      )
    })
    await flushAsyncWork()

    expect(apiMocks.get).toHaveBeenCalledWith('/portal/applications/app%2F1')
    expect(container.textContent).toContain('Operations Console')
    expect(container.textContent).toContain('https://console.example.test')
    expect(container.textContent).toContain('owner')
    expect(container.textContent).toContain('platform')
  })
})
