/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DesktopRouter } from './desktop-router'
import { restoreAuthSession } from '@/features/auth'
import { useAuthStore } from '@/stores/auth-store'
import type { User } from '@/types'

vi.mock('@/features/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth')>()),
  restoreAuthSession: vi.fn(),
  fetchAuthProviders: vi.fn().mockResolvedValue([]),
  fetchLoginOptions: vi.fn().mockResolvedValue({
    localPasswordLoginEnabled: true,
    verification: { sliderEnabled: false },
  }),
  loginWithPassword: vi.fn(),
  commitAuthResult: vi.fn(),
  authProfileApi: { get: vi.fn().mockResolvedValue({ data: undefined }) },
}))

vi.mock('@/features/provider-portal', () => ({
  PortalApplicationAvatar: () => <span>app</span>,
  portalApplicationSearchText: () => '',
  providerPortalQueries: {
    bootstrap: () => ({
      queryKey: ['portal', 'bootstrap'],
      queryFn: async () => ({
        applications: [],
        favorites: [],
        principal: {},
        recent: [],
        security: { mfaEnabled: false },
      }),
    }),
    applications: () => ({
      queryKey: ['portal', 'applications'],
      queryFn: async () => [],
    }),
  },
  providerPortalMutations: {
    launch: () => ({ mutationFn: vi.fn() }),
  },
}))

const user: User = {
  userId: 'user-1',
  userName: 'opensoha',
  email: 'opensoha@soha.local',
  roles: [],
  teams: [],
  projects: [],
  tags: [],
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

async function renderRoute(path: string) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <DesktopRouter />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
  return container
}

describe('desktop router', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    useAuthStore.setState({ accessToken: 'access-token', user })
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    useAuthStore.getState().clearAuth()
  })

  it.each([
    ['/', '首页'],
    ['/apps', '全部应用'],
    ['/software', '软件库'],
    ['/account', '个人资料'],
    ['/settings', '设置'],
  ])('renders the independent desktop route %s', async (path, heading) => {
    const view = await renderRoute(path)
    expect(view.textContent).toContain(heading)
    expect(view.textContent).not.toContain('内网工作台')
  })

  it('redirects an unauthenticated session to the desktop login', async () => {
    useAuthStore.getState().clearAuth()
    vi.mocked(restoreAuthSession).mockResolvedValue('unauthenticated')

    const view = await renderRoute('/apps')
    await act(async () => Promise.resolve())

    expect(view.textContent).toContain('登录 Soha')
    expect(view.textContent).not.toContain('多工作台统一控制台')
  })
})
