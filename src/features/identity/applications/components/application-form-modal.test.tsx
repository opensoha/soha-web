/** @vitest-environment jsdom */

import { act, type ComponentProps } from 'react'
import { App as AntdApp } from 'antd'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n'
import type { IdentityApplication } from '../../shared/types'
import { ApplicationFormModal } from './application-form-modal'

const testState = vi.hoisted(() => ({
  enabled: {} as Record<string, boolean | undefined>,
  permissionKeys: [] as string[],
  subjectControlled: false,
  subjectModes: {} as Record<string, string | undefined>,
  subjectTypeDisabled: undefined as boolean | undefined,
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
  const ActualSelect = actual.Select
  return {
    ...actual,
    Select: (props: ComponentProps<typeof ActualSelect>) => {
      if (typeof props.placeholder === 'string' && props.placeholder.includes('（可多选）')) {
        testState.subjectControlled =
          Array.isArray(props.value) && typeof props.onChange === 'function'
        testState.subjectModes[props.placeholder] = props.mode
      }
      if (props['aria-label'] === '主体类型') {
        testState.subjectTypeDisabled = props.disabled
      }
      return <ActualSelect {...props} />
    },
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

async function renderModal(
  subjectType: 'role' | 'tag' = 'role',
  subjectId = subjectType === 'tag' ? 'production' : 'role-1',
) {
  await act(async () => {
    root.render(
      <I18nProvider>
        <AntdApp>
          <ApplicationFormModal
            application={{
              ...application,
              assignments: [
                {
                  subjectType,
                  subjectId,
                  effect: 'allow',
                },
              ],
            }}
            open
            providerOptions={[]}
            providerOptionsLoading={false}
            saving={false}
            stepUpAvailable
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
    testState.subjectControlled = false
    testState.subjectModes = {}
    testState.subjectTypeDisabled = undefined
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

  it('only allows free text for tag assignments', async () => {
    await renderModal()
    await renderModal('tag')

    expect(testState.subjectModes).toMatchObject({
      '选择角色（可多选）': 'multiple',
      '输入标签（可多选）': 'tags',
    })
    expect(testState.subjectControlled).toBe(true)
  })

  it('locks the subject type after selecting an object and unlocks it when empty', async () => {
    await renderModal('role', '')
    expect(testState.subjectTypeDisabled).toBe(false)

    await renderModal()
    expect(testState.subjectTypeDisabled).toBe(true)
  })

  it('keeps publishing controls before an unboxed access control section', async () => {
    await renderModal()

    const modal = document.body.querySelector('.ant-modal')
    const content = modal?.textContent ?? ''
    expect(modal?.querySelector('.ant-card')).toBeNull()
    expect(modal?.querySelectorAll('.soha-identity-publish-controls .ant-switch')).toHaveLength(3)
    expect(modal?.querySelector('.soha-identity-publish-controls .ant-input-number')).toBeNull()
    expect(modal?.querySelectorAll('.soha-identity-policy-time-window .ant-picker')).toHaveLength(2)
    expect(modal?.querySelector('input[type="time"]')).toBeNull()
    expect(content.indexOf('门户可见')).toBeLessThan(content.indexOf('访问控制'))
    expect(content.indexOf('推荐应用')).toBeLessThan(content.indexOf('访问控制'))
    expect(modal?.querySelector('[aria-label="访问控制说明"]')).not.toBeNull()
    expect(modal?.querySelector('[aria-label="访问条件说明"]')).not.toBeNull()
    expect(content).not.toContain('每行只配置一种主体类型')
    expect(content).not.toContain('通过访问对象校验后')
  })
})
