/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { App as AntdApp } from 'antd'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n'
import type { IdentityApplication } from '../../shared/types'
import { ApplicationFormModal } from './application-form-modal'

const testState = vi.hoisted(() => ({
  enabled: {} as Record<string, boolean | undefined>,
  permissionKeys: [] as string[],
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: (options: { enabled?: boolean; queryKey: readonly unknown[] }) => {
      const resource = String(options.queryKey[1])
      testState.enabled[resource] = options.enabled
      const data =
        resource === 'users'
          ? [{ id: 'user-1', displayName: 'Cached User', username: 'cached', email: '' }]
          : resource === 'roles'
            ? [{ id: 'role-1', name: 'Cached Role' }]
            : [{ id: 'team-1', name: 'Cached Team', path: '', slug: 'cached-team' }]
      return { data, isLoading: false }
    },
  }
})

vi.mock('@/features/auth', () => ({
  hasPermission: (snapshot: { permissionKeys?: string[] } | undefined, permission: string) =>
    snapshot?.permissionKeys?.includes(permission) ?? false,
  usePermissionSnapshot: () => ({
    data: { data: { permissionKeys: testState.permissionKeys } },
    isError: false,
    isLoading: false,
  }),
}))

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>()
  return {
    ...actual,
    AutoComplete: ({ options = [] }: { options?: Array<{ label: ReactNode }> }) => (
      <div data-testid="assignment-options">{options.map((option) => option.label).join(',')}</div>
    ),
  }
})

const application: IdentityApplication = {
  id: 'app-1',
  slug: 'app-1',
  name: 'App 1',
  tags: [],
  providerType: 'link',
  portalVisible: true,
  featured: false,
  sortOrder: 0,
  status: 'enabled',
  assignments: [{ subjectType: 'role', subjectId: 'role-1', effect: 'allow' }],
  createdAt: '2026-08-18T00:00:00Z',
  updatedAt: '2026-08-18T00:00:00Z',
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

async function renderModal() {
  await act(async () => {
    root.render(
      <I18nProvider>
        <AntdApp>
          <ApplicationFormModal
            application={application}
            open
            providerOptions={[]}
            providerOptionsLoading={false}
            saving={false}
            tagOptions={[]}
            onCancel={() => undefined}
            onSubmit={() => undefined}
          />
        </AntdApp>
      </I18nProvider>,
    )
    await Promise.resolve()
  })
}

describe('ApplicationFormModal permissions', () => {
  beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    Object.defineProperty(window, 'getComputedStyle', {
      writable: true,
      value: vi.fn().mockReturnValue({
        getPropertyValue: () => '',
        overflow: 'auto',
        overflowX: 'auto',
        overflowY: 'auto',
      }),
    })
  })

  beforeEach(() => {
    testState.enabled = {}
    testState.permissionKeys = []
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('disables and masks assignment lookups without their exact view permissions', async () => {
    await renderModal()

    expect(testState.enabled).toEqual({ users: false, roles: false, teams: false })
    expect(document.body.textContent).not.toContain('Cached Role')
  })

  it('enables the team lookup with the group view permission', async () => {
    testState.permissionKeys = ['access.groups.view']

    await renderModal()

    expect(testState.enabled).toEqual({ users: false, roles: false, teams: true })
  })
})
