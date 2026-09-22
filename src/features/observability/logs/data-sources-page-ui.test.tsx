/** @vitest-environment jsdom */

import { act, StrictMode } from 'react'
import { App as AntdApp } from 'antd'
import { createRoot } from 'react-dom/client'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { LogDataSourcesPage } from './data-sources-page'

const mutation = { isPending: false, mutate: vi.fn(), variables: undefined }

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useMutation: () => mutation,
  useQueryClient: () => ({}),
  useQuery: (options: { kind: string }) =>
    options.kind === 'sources'
      ? {
          data: [
            {
              name: 'Main logs',
              backendType: 'clickhouse',
              providerKey: 'clickhouse',
              config: { endpoint: 'https://logs.example.com', table: 'app_logs' },
              scope: { clusterIds: ['prod'] },
              queryBudget: { maxEntries: 200, maxRangeSeconds: 3600, timeoutSeconds: 12 },
              redactionPolicy: { dropAttributeKeys: ['secret'] },
              credentialKeys: ['password'],
              enabled: true,
              id: 'logs-main',
              validationMessage: 'backend query timed out',
              validationStatus: 'failed',
            },
          ],
          isError: false,
          isLoading: false,
        }
      : {
          data: [
            {
              providerKey: 'clickhouse',
              displayName: 'ClickHouse',
              builtIn: true,
              status: 'supported',
              signals: ['logs'],
              capabilities: ['logs.query'],
            },
          ],
          isError: false,
          isLoading: false,
        },
}))
vi.mock('./queries', () => ({
  observabilityLogQueries: { dataSources: () => ({ kind: 'sources' }) },
}))
vi.mock('../provider-queries', () => ({
  observabilityProviderQueries: { providers: () => ({ kind: 'providers' }) },
}))
vi.mock('./mutations', () => ({
  observabilityLogMutations: {
    createDataSource: () => ({}),
    updateDataSource: () => ({}),
    validateDataSource: () => ({}),
  },
}))
vi.mock('@/features/auth', () => ({
  hasPermission: () => true,
  usePermissionSnapshot: () => ({ data: { data: {} } }),
}))
vi.mock('@/components/status-tag', () => ({
  BooleanTag: ({ trueLabel }: { trueLabel: string }) => <span>{trueLabel}</span>,
  StatusTag: ({ value }: { value?: string }) => <span>{value}</span>,
}))
vi.mock('@/components/admin-table', () => ({
  AdminTable: ({ columns, dataSource, headerExtra }: any) => {
    const column = columns.find((item: any) => item.key === 'status')
    return (
      <div>
        {headerExtra}
        {columns.find((item: any) => item.key === 'actions').render(undefined, dataSource[0], 0)}
        {column.title}
        {column.render(undefined, dataSource[0], 0)}
      </div>
    )
  },
}))

beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const getComputedStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => getComputedStyle(element))
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

async function clickButton(text: string) {
  const button = Array.from(document.querySelectorAll('button')).find(
    (item) =>
      item.textContent?.replace(/\s/g, '') === text || item.getAttribute('aria-label') === text,
  )
  expect(button, text).toBeTruthy()
  await act(async () => {
    button!.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function visibleStep() {
  return document.querySelector('.soha-step-form__content > div:not([hidden])')
}

describe('LogDataSourcesPage validation evidence', () => {
  it('validates each step and preserves edit values through navigation and submission', async () => {
    mutation.mutate.mockClear()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      await act(async () =>
        root.render(
          <StrictMode>
            <AntdApp>
              <LogDataSourcesPage />
            </AntdApp>
          </StrictMode>,
        ),
      )
      await clickButton('新建数据源')
      await clickButton('下一步')
      expect(visibleStep()?.textContent).toContain('Endpoint')
      expect(mutation.mutate).not.toHaveBeenCalled()
      await clickButton('取消')
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 350))
      })
      await clickButton('编辑日志数据源')
      expect((document.querySelector('input[id="name"]') as HTMLInputElement).value).toBe(
        'Main logs',
      )
      await clickButton('下一步')
      expect(visibleStep()?.textContent).toContain('每页最大行数')
      await clickButton('上一步')
      expect((document.querySelector('input[id="table"]') as HTMLInputElement).value).toBe(
        'app_logs',
      )
      await clickButton('下一步')
      await clickButton('下一步')
      expect(visibleStep()?.textContent).toContain('Password')
      await clickButton('保存')
      expect(mutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'logs-main',
          input: expect.objectContaining({
            name: 'Main logs',
            backendType: 'clickhouse',
            config: expect.objectContaining({
              table: 'app_logs',
              endpoint: 'https://logs.example.com',
            }),
            scope: { clusterIds: ['prod'], namespaces: undefined },
            queryBudget: { maxEntries: 200, maxRangeSeconds: 3600, timeoutSeconds: 12 },
            credentials: [],
          }),
        }),
        expect.any(Object),
      )
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('shows the backend validation failure reason beside status', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () =>
      root.render(
        <AntdApp>
          <LogDataSourcesPage />
        </AntdApp>,
      ),
    )

    expect(container.textContent).toContain('failed')
    expect(container.textContent).toContain('backend query timed out')

    await act(async () => root.unmount())
  })
})
