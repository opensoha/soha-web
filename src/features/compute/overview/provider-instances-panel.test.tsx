/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { App } from 'antd'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ProviderInstancesPanel } from './provider-instances-panel'

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  useQueryClient: () => ({}),
}))

const roots: Array<ReturnType<typeof createRoot>> = []

function render(node: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  act(() =>
    root.render(
      <App>
        <MemoryRouter>{node}</MemoryRouter>
      </App>,
    ),
  )
  return container
}

function providerQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      items: [
        {
          instanceRef: 'connection-1',
          displayName: 'pve-lab',
          accessMode: 'direct',
          lastObservedAt: '2026-08-24T12:00:00Z',
          snapshot: { domain: 'virtualization', providerKey: 'pve', generation: 1 },
          health: { status: 'healthy' },
        },
      ],
    },
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  }
}

afterEach(() => {
  roots.splice(0).forEach((root) => act(() => root.unmount()))
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('provider instances panel', () => {
  it.each([
    { canTest: true, canDiscover: false, visible: '检查连接健康', hidden: '发现并同步资源' },
    { canTest: false, canDiscover: true, visible: '发现并同步资源', hidden: '检查连接健康' },
  ])(
    'gates provider actions by their exact permission',
    ({ canTest, canDiscover, visible, hidden }) => {
      vi.mocked(useQuery).mockReturnValue(providerQuery() as never)
      vi.mocked(useMutation).mockReturnValue({ isPending: false, mutate: vi.fn() } as never)

      const container = render(
        <ProviderInstancesPanel
          canDiscover={canDiscover}
          canTest={canTest}
          enabled
          localeCode="zh_CN"
        />,
      )

      expect(container.querySelector(`button[aria-label="${visible}"]`)).not.toBeNull()
      expect(container.querySelector(`button[aria-label="${hidden}"]`)).toBeNull()
    },
  )

  it('retries a failed provider query', () => {
    const refetch = vi.fn()
    vi.mocked(useQuery).mockReturnValue(
      providerQuery({ data: undefined, isError: true, refetch }) as never,
    )
    vi.mocked(useMutation).mockReturnValue({ isPending: false, mutate: vi.fn() } as never)

    const container = render(
      <ProviderInstancesPanel canDiscover={false} canTest={false} enabled localeCode="zh_CN" />,
    )
    const retry = container.querySelector<HTMLButtonElement>(
      'button[aria-label="重试加载提供方实例"]',
    )

    expect(retry).toBeDefined()
    act(() => retry?.click())
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
