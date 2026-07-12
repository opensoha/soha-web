/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuditLog, OnlineUser } from '@/features/system'
import type { IdentityApplication } from '../shared/types'
import type { IdentityOutpost } from '../outposts'
import type { IdentityProvider } from '../providers'
import { IdentityOverviewPage } from './page'
import { useIdentityOverviewData } from './use-overview-data'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('@ant-design/icons', () => {
  const Icon = () => <span aria-hidden="true" />
  return {
    ApiOutlined: Icon,
    AppstoreOutlined: Icon,
    AuditOutlined: Icon,
    KeyOutlined: Icon,
    LinkOutlined: Icon,
    ReloadOutlined: Icon,
    SafetyCertificateOutlined: Icon,
    UserSwitchOutlined: Icon,
  }
})

vi.mock('antd', () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children?: ReactNode
    disabled?: boolean
    onClick?: () => void
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Card: ({
    children,
    extra,
    title,
  }: {
    children?: ReactNode
    extra?: ReactNode
    title?: ReactNode
  }) => (
    <section>
      <h2>{title}</h2>
      {extra}
      {children}
    </section>
  ),
  Space: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Tag: ({ children, color }: { children?: ReactNode; color?: string }) => (
    <span data-color={color}>{children}</span>
  ),
  Typography: {
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  },
}))

vi.mock('@/components/management-list', () => ({
  ManagementDetailHeader: ({ actions, title }: { actions?: ReactNode; title?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
  ManagementState: ({ title }: { title?: ReactNode }) => <div>{title}</div>,
}))

vi.mock('@/components/overview-visuals', () => ({
  OverviewChip: ({
    helper,
    label,
    tone,
    value,
  }: {
    helper?: ReactNode
    label?: ReactNode
    tone?: string
    value?: ReactNode
  }) => (
    <div data-testid={`chip-${String(label)}`} data-tone={tone}>
      {label}:{value}:{helper}
    </div>
  ),
  OverviewMetricCard: ({
    helper,
    label,
    loading,
    tone,
    value,
  }: {
    helper?: ReactNode
    label?: ReactNode
    loading?: boolean
    tone?: string
    value?: ReactNode
  }) => (
    <div
      data-testid={`metric-${String(label)}`}
      data-loading={String(Boolean(loading))}
      data-tone={tone}
    >
      {label}:{value}:{helper}
    </div>
  ),
  OverviewSectionBar: ({
    description,
    extra,
    title,
  }: {
    description?: ReactNode
    extra?: ReactNode
    title?: ReactNode
  }) => (
    <div>
      {title}:{description}
      {extra}
    </div>
  ),
}))

vi.mock('./use-overview-data', () => ({
  useIdentityOverviewData: vi.fn(),
}))

const applications: IdentityApplication[] = [
  {
    id: 'application-1',
    slug: 'grafana',
    name: 'Grafana',
    tags: [],
    providerType: 'link',
    portalVisible: true,
    featured: false,
    sortOrder: 1,
    status: 'enabled',
    createdAt: '2026-07-08T00:00:00Z',
    updatedAt: '2026-07-09T00:00:00Z',
  },
  {
    id: 'application-2',
    slug: 'harbor',
    name: 'Harbor',
    tags: [],
    providerType: 'link',
    portalVisible: true,
    featured: false,
    sortOrder: 2,
    status: 'disabled',
    createdAt: '2026-07-10T00:00:00Z',
    updatedAt: 'invalid-date',
  },
]

const providers: IdentityProvider[] = [
  {
    id: 'provider-1',
    applicationId: 'application-1',
    name: 'Grafana OIDC',
    type: 'oidc',
    enabled: true,
    status: 'enabled',
    createdAt: '2026-07-08T00:00:00Z',
    updatedAt: '2026-07-09T00:00:00Z',
  },
  {
    id: 'provider-2',
    applicationId: 'application-1',
    name: 'Backup OIDC',
    type: 'oidc',
    enabled: false,
    status: 'disabled',
    createdAt: '2026-07-08T00:00:00Z',
    updatedAt: '2026-07-09T00:00:00Z',
  },
  {
    id: 'provider-3',
    applicationId: 'application-2',
    name: 'Harbor Proxy',
    type: 'proxy',
    enabled: true,
    status: 'disabled',
    createdAt: '2026-07-08T00:00:00Z',
    updatedAt: '2026-07-09T00:00:00Z',
  },
]

const outposts: IdentityOutpost[] = [
  {
    id: 'outpost-1',
    name: 'Online',
    mode: 'embedded',
    status: 'online',
    createdAt: '2026-07-08T00:00:00Z',
    updatedAt: '2026-07-09T00:00:00Z',
  },
  {
    id: 'outpost-2',
    name: 'Offline',
    mode: 'agent',
    status: 'offline',
    createdAt: '2026-07-08T00:00:00Z',
    updatedAt: '2026-07-09T00:00:00Z',
  },
]

const sessions: OnlineUser[] = [
  {
    id: 'session-1',
    userId: 'user-1',
    userName: 'Yamabuki',
    email: 'yamabuki@example.com',
    providerType: 'oidc',
    status: 'active',
    loginTime: '2026-07-10T00:00:00Z',
    lastSeenAt: '2026-07-10T00:05:00Z',
    expiry: '2026-07-10T08:00:00Z',
  },
  {
    id: 'session-2',
    userId: 'user-2',
    userName: 'Soha',
    email: 'soha@example.com',
    providerType: 'proxy',
    status: 'active',
    loginTime: '2026-07-10T00:00:00Z',
    lastSeenAt: '2026-07-10T00:05:00Z',
    expiry: '2026-07-10T08:00:00Z',
  },
]

const audits: AuditLog[] = Array.from({ length: 8 }, (_, index) => ({
  id: `audit-${index}`,
  createdAt: `2026-07-10T00:0${index}:00Z`,
  actorId: `actor-${index}`,
  actorName: index === 1 ? '' : `Actor ${index}`,
  action: `action-${index}`,
  resourceKind: index === 2 ? 'provider-kind' : '',
  resourceName: index === 1 ? 'resource-name-1' : '',
  result: index === 0 ? 'success' : index === 1 ? 'denied' : 'unknown',
  summary: index === 0 ? 'summary-0' : '',
}))

const roots: Root[] = []
const containers: HTMLElement[] = []
const refreshAll = vi.fn()

beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useIdentityOverviewData).mockReturnValue({
    applications,
    providers,
    outposts,
    sessions,
    audits,
    loading: {
      applications: false,
      providers: false,
      outposts: false,
      sessions: false,
    },
    permissions: {
      applications: true,
      providers: true,
      outposts: true,
      policies: true,
      sessions: true,
      audit: true,
    },
    refreshAll,
  })
})

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount()
  })
  for (const container of containers.splice(0)) container.remove()
})

async function renderPage() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<IdentityOverviewPage />)
  })
  return container
}

function buttonByText(container: HTMLElement, label: string) {
  const normalized = label.replace(/\s+/g, '')
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, '') === normalized,
  )
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  return button
}

async function clickButton(container: HTMLElement, label: string) {
  await act(async () => buttonByText(container, label).click())
}

describe('IdentityOverviewPage', () => {
  it('renders the existing metrics and only the first six audit events', async () => {
    const container = await renderPage()

    expect(container.querySelector('[data-testid="metric-应用目录"]')?.textContent).toContain(
      '应用目录:2:1 个已启用',
    )
    expect(container.querySelector('[data-testid="metric-Provider"]')?.textContent).toContain(
      'Provider:3:1 个已启用 / 2 OIDC / 1 Proxy',
    )
    expect(container.querySelector('[data-testid="metric-Outpost"]')?.textContent).toContain(
      'Outpost:2:1 个在线',
    )
    expect(container.querySelector('[data-testid="metric-活跃会话"]')?.textContent).toContain(
      '活跃会话:2',
    )
    expect(container.querySelector('[data-testid="chip-OIDC Provider"]')?.textContent).toContain(
      'OIDC Provider:2:已启用',
    )
    expect(container.querySelector('[data-testid="chip-Proxy Provider"]')?.textContent).toContain(
      'Proxy Provider:1:未启用',
    )
    expect(container.textContent).toContain('action-0')
    expect(container.textContent).toContain('action-5')
    expect(container.textContent).not.toContain('action-6')
    expect(container.textContent).not.toContain('action-7')
    expect(container.textContent).toContain('summary-0')
    expect(container.textContent).toContain('resource-name-1')
    expect(container.textContent).toContain('provider-kind')
    expect(container.textContent).toContain('actor-1')
    expect(container.querySelector('[data-color="green"]')?.textContent).toBe('success')
    expect(container.querySelector('[data-color="red"]')?.textContent).toBe('denied')

    await clickButton(container, '刷新')
    expect(refreshAll).toHaveBeenCalledOnce()
  })

  it('keeps all seven runtime navigation targets', async () => {
    const container = await renderPage()
    const targets = [
      ['应用目录', '/identity/applications'],
      ['Provider 管理', '/identity/providers'],
      ['Outpost 管理', '/identity/outposts'],
      ['访问策略', '/identity/policies'],
      ['会话管理', '/identity/sessions'],
      ['审计事件', '/identity/audit'],
      ['门户首页', '/portal'],
    ] as const

    for (const [label, path] of targets) {
      await clickButton(container, label)
      expect(navigateMock).toHaveBeenLastCalledWith(path)
    }
  })

  it('preserves permission states without disabling card-level route links', async () => {
    vi.mocked(useIdentityOverviewData).mockReturnValue({
      applications: [],
      providers: [],
      outposts: [],
      sessions: [],
      audits: [],
      loading: {
        applications: false,
        providers: false,
        outposts: false,
        sessions: false,
      },
      permissions: {
        applications: false,
        providers: false,
        outposts: false,
        policies: false,
        sessions: false,
        audit: false,
      },
      refreshAll,
    })
    const container = await renderPage()

    expect(container.textContent).toContain('无 Provider 权限')
    expect(container.textContent).toContain('无审计权限')
    for (const label of [
      '应用目录',
      'Provider 管理',
      'Outpost 管理',
      '访问策略',
      '会话管理',
      '审计事件',
    ]) {
      expect(buttonByText(container, label).disabled).toBe(true)
    }
    expect(buttonByText(container, '门户首页').disabled).toBe(false)
    expect(buttonByText(container, 'Provider').disabled).toBe(false)
    expect(buttonByText(container, '审计').disabled).toBe(false)
  })

  it('keeps the authorized empty audit state distinct from no permission', async () => {
    vi.mocked(useIdentityOverviewData).mockReturnValue({
      applications,
      providers,
      outposts,
      sessions,
      audits: [],
      loading: {
        applications: false,
        providers: false,
        outposts: false,
        sessions: false,
      },
      permissions: {
        applications: true,
        providers: true,
        outposts: true,
        policies: true,
        sessions: true,
        audit: true,
      },
      refreshAll,
    })
    const container = await renderPage()

    expect(container.textContent).toContain('暂无审计记录')
    expect(container.textContent).not.toContain('无审计权限')
  })
})
