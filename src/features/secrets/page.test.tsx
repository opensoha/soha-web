/** @vitest-environment jsdom */

import { act } from 'react'
import { App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SecretsPage } from './page'

const apiGet = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth', () => ({
  hasPermission: () => true,
  usePermissionSnapshot: () => ({ data: { data: { permissionKeys: ['secret.manage'] } } }),
}))

vi.mock('@/services/api-client', () => ({
  api: {
    delete: vi.fn(),
    get: apiGet,
    patch: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/components/admin-table', () => ({
  AdminTable: ({
    dataSource,
    empty,
    headerExtra,
  }: {
    dataSource: unknown[]
    empty?: React.ReactNode
    headerExtra?: React.ReactNode
  }) => (
    <div data-testid="admin-table">
      {headerExtra}
      {dataSource.length ? `${dataSource.length} rows` : empty}
    </div>
  ),
}))

const roots: Root[] = []

beforeAll(() => {
  const getComputedStyle = window.getComputedStyle.bind(window)
  Object.defineProperty(window, 'getComputedStyle', {
    configurable: true,
    value: (element: Element) => getComputedStyle(element),
  })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount()
  })
  document.body.innerHTML = ''
})

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function changeInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

async function renderPage() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <AntdApp>
        <QueryClientProvider client={client}>
          <SecretsPage />
        </QueryClientProvider>
      </AntdApp>,
    )
  })
  await flush()
  return container
}

describe('SecretsPage', () => {
  it('distinguishes a request failure from an empty list and retries it', async () => {
    apiGet.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ items: [] })
    const container = await renderPage()

    expect(container.textContent).toContain('Secret 加载失败')
    expect(container.textContent).not.toContain('暂无 Secret')

    const retry = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('重试'),
    )
    await act(async () => retry?.click())
    await flush()

    expect(apiGet).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('暂无 Secret')
    expect(container.textContent).not.toContain('Secret 加载失败')
  })

  it('aligns Vault locator fields with the contract and rejects fractional versions', async () => {
    apiGet.mockResolvedValueOnce({ items: [] })
    await renderPage()

    const create = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('新建 Secret'),
    )
    await act(async () => create?.click())
    await flush()

    const vaultSource = Array.from(document.body.querySelectorAll<HTMLElement>('.ant-segmented-item')).find(
      (item) => item.textContent?.includes('Vault KV v2'),
    )
    await act(async () => vaultSource?.click())
    await flush()

    const mount = document.body.querySelector<HTMLInputElement>('input[id$="vaultKv2_mount"]')
    const path = document.body.querySelector<HTMLInputElement>('input[id$="vaultKv2_path"]')
    const key = document.body.querySelector<HTMLInputElement>('input[id$="vaultKv2_key"]')
    const version = document.body.querySelector<HTMLInputElement>('input[id$="vaultKv2_version"]')
    expect(mount?.maxLength).toBe(256)
    expect(path?.maxLength).toBe(1024)
    expect(key?.maxLength).toBe(256)
    expect(version).not.toBeNull()

    await act(async () => {
      if (version) changeInput(version, '1.5')
    })
    const submit = document.body.querySelector<HTMLButtonElement>('.ant-modal-footer .ant-btn-primary')
    await act(async () => submit?.click())
    await flush()

    expect(document.body.textContent).toContain('Version 必须是正整数')
  })
})
