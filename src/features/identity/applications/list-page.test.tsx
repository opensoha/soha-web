/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityApplicationsPage } from './list-page'

const testState = vi.hoisted(() => ({
  applicationProviderType: 'link' as 'link' | 'oidc',
  permissionKeys: [
    'identity.applications.view',
    'identity.applications.create',
    'identity.applications.update',
    'identity.applications.delete',
    'identity.providers.create',
  ],
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}))

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>()
  return {
    ...actual,
    Popconfirm: ({ children, onConfirm }: { children?: ReactNode; onConfirm?: () => void }) => (
      <span onClick={() => onConfirm?.()}>{children}</span>
    ),
  }
})

vi.mock('@/features/auth', () => ({
  hasPermission: (snapshot: { permissionKeys?: string[] } | undefined, permission: string) =>
    snapshot?.permissionKeys?.includes(permission) ?? false,
  usePermissionSnapshot: () => ({
    data: { data: { permissionKeys: testState.permissionKeys } },
    isLoading: false,
  }),
}))

vi.mock('@/services/api-client', () => ({
  api: {
    delete: (path: string) => testState.apiDelete(path),
    get: (path: string) => testState.apiGet(path),
    post: (path: string, body?: unknown) => testState.apiPost(path, body),
    put: (path: string, body?: unknown) => testState.apiPut(path, body),
  },
}))

interface MockColumn {
  dataIndex?: string
  key?: string
  render?: (value: unknown, record: Record<string, unknown>) => ReactNode
}

vi.mock('@/components/admin-table', () => ({
  AdminTable: ({
    columns,
    dataSource,
    headerExtra,
    tableSize,
    toolbar,
  }: {
    columns: MockColumn[]
    dataSource: Array<Record<string, unknown>>
    headerExtra?: ReactNode
    tableSize?: string
    toolbar?: ReactNode
  }) => (
    <div data-table-size={tableSize}>
      {headerExtra}
      {toolbar}
      {dataSource.map((record) => (
        <div data-testid={`row-${String(record.id)}`} key={String(record.id)}>
          {columns.map((column, columnIndex) => {
            const value = record[column.dataIndex ?? '']
            return (
              <span key={column.key ?? `${String(column.dataIndex)}-${columnIndex}`}>
                {column.render ? column.render(value, record) : String(value ?? '')}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/management-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/management-list')>()),
  ManagementIconButton: ({
    disabled,
    onClick,
    tooltip,
  }: {
    disabled?: boolean
    onClick?: () => void
    tooltip: string
  }) => (
    <button aria-label={tooltip} disabled={disabled} onClick={onClick}>
      {tooltip}
    </button>
  ),
  ManagementRefreshButton: ({ onClick }: { onClick?: () => void }) => (
    <button aria-label="刷新" onClick={onClick}>
      刷新
    </button>
  ),
  ManagementState: ({ title }: { title?: ReactNode }) => <div>{title}</div>,
  ManagementTableToolbar: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('./components/application-form-modal', () => ({
  ApplicationFormModal: ({
    application,
    onSubmit,
    open,
    providerOptions,
    tagOptions,
  }: {
    application: { id: string } | null
    onSubmit: (input: Record<string, unknown>) => void
    open: boolean
    providerOptions: Array<{ id: string; name: string; type: string }>
    tagOptions: Array<{ label: string; value: string }>
  }) =>
    open ? (
      <div data-testid="application-form-modal">
        <span>{application ? `editing:${application.id}` : 'creating'}</span>
        <div data-testid="application-tag-options">
          {tagOptions.map((option) => (
            <span data-testid={`application-tag-option-${option.value}`} key={option.value}>
              {option.label}
            </span>
          ))}
        </div>
        <div data-testid="application-provider-options">
          {providerOptions.map((option) => (
            <span data-testid={`application-provider-option-${option.id}`} key={option.id}>
              {option.name} ({option.type})
            </span>
          ))}
        </div>
        <button
          onClick={() =>
            onSubmit({
              assignments: [],
              description: 'Dashboards',
              featured: false,
              iconUrl: '',
              launchUrl: 'https://grafana.example.com',
              metadata: {},
              name: 'Grafana',
              portalVisible: true,
              providerId: application ? 'provider-1' : '',
              providerType: testState.applicationProviderType,
              slug: 'grafana',
              sortOrder: 10,
              status: 'enabled',
              tags: ['metrics'],
            })
          }
        >
          提交应用
        </button>
      </div>
    ) : null,
}))

vi.mock('../providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../providers')>()
  return {
    ...actual,
    ProviderFormModal: ({
      onSubmit,
      open,
    }: {
      onSubmit: (input: unknown) => void
      open: boolean
    }) =>
      open ? (
        <button
          onClick={() =>
            onSubmit({
              applicationId: 'grafana',
              config: {},
              enabled: true,
              name: 'Example OIDC',
              status: 'enabled',
              type: 'oidc',
            })
          }
        >
          提交 Provider
        </button>
      ) : null,
    OIDCClientFormModal: ({
      onSubmit,
      open,
      providerId,
    }: {
      onSubmit: (input: unknown) => void
      open: boolean
      providerId: string
    }) =>
      open ? (
        <button
          onClick={() =>
            onSubmit({
              providerId,
              clientType: 'confidential',
              redirectUris: ['https://app.example.com/oauth/callback'],
              postLogoutRedirectUris: [],
              allowedScopes: ['openid'],
              allowedGrantTypes: ['authorization_code'],
              requirePkce: true,
              accessTokenTtlSeconds: 3600,
              idTokenTtlSeconds: 300,
              refreshTokenTtlSeconds: 0,
              status: 'enabled',
            })
          }
        >
          提交 Client
        </button>
      ) : null,
    SecretRevealModal: ({ value }: { value: { clientSecret: string } | null }) =>
      value ? <div data-testid="onboarding-secret">{value.clientSecret}</div> : null,
  }
})

const application = {
  id: 'grafana',
  slug: 'grafana',
  name: 'Grafana',
  description: 'Dashboards',
  launchUrl: 'https://grafana.example.com',
  tags: ['metrics'],
  providerType: 'link',
  portalVisible: true,
  featured: false,
  sortOrder: 10,
  status: 'enabled',
  createdAt: '2026-07-10T00:00:00Z',
  updatedAt: '2026-07-10T00:00:00Z',
}

const provider = {
  id: 'provider-1',
  applicationId: 'grafana',
  name: 'Grafana OIDC',
  type: 'oidc',
  enabled: true,
  status: 'enabled',
  createdAt: '2026-07-10T00:00:00Z',
  updatedAt: '2026-07-10T00:00:00Z',
}

const roots: Root[] = []
const containers: HTMLElement[] = []

beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
})

beforeEach(() => {
  vi.clearAllMocks()
  testState.permissionKeys = [
    'identity.applications.view',
    'identity.applications.create',
    'identity.applications.update',
    'identity.applications.delete',
    'identity.providers.create',
  ]
  testState.applicationProviderType = 'link'
  testState.apiGet.mockImplementation(async (path: string) => {
    if (path.startsWith('/identity/applications')) return { data: [application] }
    if (path.startsWith('/identity/providers')) return { data: [provider] }
    if (path === '/identity/capabilities') return { data: { stepUp: { available: true } } }
    return { data: [] }
  })
  testState.apiPost.mockImplementation(async (path: string) => {
    if (path === '/identity/providers') return { data: provider }
    if (path === '/identity/providers/provider-1/oidc-clients') {
      return {
        data: {
          client: { id: 'client-1', providerId: provider.id, clientId: 'generated-client-id' },
          clientSecret: 'revealable-client-secret',
        },
      }
    }
    return { data: { ...application, providerType: testState.applicationProviderType } }
  })
  testState.apiPut.mockImplementation(async (_path: string, input: Record<string, unknown>) => ({
    data: { ...application, ...input },
  }))
  testState.apiDelete.mockResolvedValue({ data: { status: 'ok' } })
})

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount()
  })
  for (const container of containers.splice(0)) container.remove()
})

async function settle(queryClient: QueryClient) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await act(async () => {
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    if (queryClient.isFetching() === 0 && queryClient.isMutating() === 0) return
  }
}

async function renderPage() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)
  const root = createRoot(container)
  roots.push(root)
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <IdentityApplicationsPage />
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  await settle(queryClient)
  return { container, queryClient }
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

async function clickButton(container: HTMLElement, label: string) {
  const normalized = label.replace(/\s+/g, '')
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, '') === normalized,
  )
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  await act(async () => button.click())
}

async function clickButtonByLabel(container: HTMLElement, label: string) {
  const button = container.querySelector(`button[aria-label="${label}"]`)
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  await act(async () => button.click())
}

describe('identity applications page behavior', () => {
  it('loads applications without the provider summary cards and applies search filters', async () => {
    const { container, queryClient } = await renderPage()

    expect(testState.apiGet).toHaveBeenCalledWith('/identity/applications')
    expect(testState.apiGet).not.toHaveBeenCalledWith('/identity/provider-capabilities')
    expect(container.querySelector('[data-testid="row-grafana"]')).not.toBeNull()
    expect(container.textContent).not.toContain('OIDC provider ready')
    const applicationRow = container.querySelector('[data-testid="row-grafana"]')
    expect(
      applicationRow
        ?.querySelector('button[aria-label="Grafana 启用状态"]')
        ?.getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      applicationRow
        ?.querySelector('button[aria-label="Grafana 门户可见"]')
        ?.getAttribute('aria-checked'),
    ).toBe('true')
    expect(applicationRow?.querySelector('.soha-metadata-tag')?.textContent).toBe('LINK')
    expect(applicationRow?.textContent).toContain('所有已登录用户')
    expect(
      applicationRow
        ?.querySelector('.soha-identity-access-scope')
        ?.classList.contains('ant-space-vertical'),
    ).toBe(false)
    expect(
      applicationRow
        ?.querySelector('a[href="https://grafana.example.com"]')
        ?.getAttribute('target'),
    ).toBe('_blank')

    const search = container.querySelector('.soha-management-query-field input')
    if (!(search instanceof HTMLInputElement)) throw new Error('Application search input not found')
    await act(async () => setInputValue(search, ' harbor '))
    await clickButton(container, '查询')
    await settle(queryClient)

    expect(testState.apiGet).toHaveBeenCalledWith('/identity/applications?q=harbor')
  })

  it('updates enabled and portal visibility from independent switches', async () => {
    const { container, queryClient } = await renderPage()

    await clickButtonByLabel(container, 'Grafana 启用状态')
    await settle(queryClient)

    expect(testState.apiPut).toHaveBeenCalledWith(
      '/identity/applications/grafana',
      expect.objectContaining({ status: 'disabled' }),
    )

    await clickButtonByLabel(container, 'Grafana 门户可见')
    await settle(queryClient)

    expect(testState.apiPut).toHaveBeenCalledWith(
      '/identity/applications/grafana',
      expect.objectContaining({ portalVisible: false }),
    )
  })

  it('switches table density from the shared table toolbar', async () => {
    const { container } = await renderPage()

    expect(container.querySelector('[data-table-size="small"]')).not.toBeNull()
    await clickButtonByLabel(container, '切换表格密度')
    expect(container.querySelector('[data-table-size="middle"]')).not.toBeNull()
  })

  it('keeps application management controls permission-gated', async () => {
    testState.permissionKeys = ['identity.applications.view']
    const { container } = await renderPage()

    const create = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('新建应用'),
    )
    expect(create?.disabled).toBe(true)
    expect(
      (container.querySelector('button[aria-label="编辑"]') as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (container.querySelector('button[aria-label="Grafana 启用状态"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it('wires create and update forms through application mutations', async () => {
    const { container, queryClient } = await renderPage()

    await clickButton(container, '新建应用')
    expect(container.textContent).toContain('creating')
    expect(container.querySelector('[data-testid="application-tag-option-metrics"]')).not.toBeNull()
    await clickButton(container, '提交应用')
    await settle(queryClient)

    expect(testState.apiPost).toHaveBeenCalledWith(
      '/identity/applications',
      expect.objectContaining({ name: 'Grafana', providerId: '' }),
    )

    await clickButton(container, '编辑')
    await settle(queryClient)
    expect(container.textContent).toContain('editing:grafana')
    expect(testState.apiGet).toHaveBeenCalledWith('/identity/providers?applicationId=grafana')
    expect(
      container.querySelector('[data-testid="application-provider-option-provider-1"]'),
    ).not.toBeNull()
    await clickButton(container, '提交应用')
    await settle(queryClient)

    expect(testState.apiPut).toHaveBeenCalledWith(
      '/identity/applications/grafana',
      expect.objectContaining({ name: 'Grafana', providerId: 'provider-1' }),
    )
  })

  it('deletes applications through the canonical mutation', async () => {
    const { container, queryClient } = await renderPage()

    await clickButtonByLabel(container, '删除')
    await settle(queryClient)

    expect(testState.apiDelete).toHaveBeenCalledWith('/identity/applications/grafana')
  })

  it('guides OIDC creation through Application, Provider, binding, and first Client', async () => {
    testState.applicationProviderType = 'oidc'
    const { container, queryClient } = await renderPage()

    await clickButton(container, '新建应用')
    await clickButton(container, '提交应用')
    await settle(queryClient)
    await clickButton(container, '提交 Provider')
    await settle(queryClient)
    await clickButton(container, '提交 Client')
    await settle(queryClient)

    expect(testState.apiPost).toHaveBeenCalledWith(
      '/identity/providers',
      expect.objectContaining({ applicationId: 'grafana', type: 'oidc' }),
    )
    expect(testState.apiPut).toHaveBeenCalledWith(
      '/identity/applications/grafana',
      expect.objectContaining({ providerId: 'provider-1', providerType: 'oidc' }),
    )
    expect(testState.apiPost).toHaveBeenCalledWith(
      '/identity/providers/provider-1/oidc-clients',
      expect.objectContaining({ providerId: 'provider-1' }),
    )
    expect(container.querySelector('[data-testid="onboarding-secret"]')?.textContent).toBe(
      'revealable-client-secret',
    )
  })
})
