/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  PersonalEnvironment,
  PersonalWorkspaceRuntime,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { PersonalWorkspace } from './personal-workspace'

const state = vi.hoisted(() => ({
  value: undefined as PersonalWorkspaceRuntime | undefined,
  failed: false,
  invoke: vi.fn(),
}))
vi.mock('../queries', () => ({
  workbenchQueries: {
    workspaceRuntime: (owner: string, assistant: string, enabled: boolean) => ({
      queryKey: ['workspace', owner, assistant],
      enabled,
      retry: false,
      queryFn: async () => {
        if (state.failed) throw new Error('unavailable')
        return { data: state.value }
      },
    }),
    guestToolsOperation: () => ({ queryKey: ['tools'], enabled: false, queryFn: async () => ({}) }),
  },
}))
vi.mock('../mutations', () => ({
  workbenchMutations: {
    runtime: () => ({ mutationFn: state.invoke, retry: false }),
    guestTools: () => ({ mutationFn: vi.fn() }),
  },
}))
let root: Root
let node: HTMLDivElement
let client: QueryClient
const environment: PersonalEnvironment = {
  assistantId: 'assistant-one',
  state: 'ready',
  version: 7,
  dataInitialized: true,
  expiresAt: '2099-01-01T00:00:00Z',
}
beforeEach(() => {
  state.failed = false
  state.value = { assistantId: environment.assistantId, environmentVersion: 7 }
  state.invoke.mockReset()
  node = document.createElement('div')
  document.body.appendChild(node)
  root = createRoot(node)
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  node.remove()
})
function button(label: string) {
  const b = Array.from(document.querySelectorAll('button')).find(
    (v) => v.textContent?.trim() === label,
  )
  expect(b).toBeDefined()
  return b!
}
async function click(element: HTMLElement) {
  await act(async () => {
    element.click()
    await new Promise((r) => setTimeout(r, 25))
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 25))
  })
}
async function open() {
  await act(async () => {
    root.render(
      <App>
        <QueryClientProvider client={client}>
          <PersonalWorkspace owner="user-one" environment={environment} onRefresh={() => {}} />
        </QueryClientProvider>
      </App>,
    )
  })
  await click(button('打开个人工作空间'))
}
it('pauses commands after a failed workspace read and never dispatches automatically', async () => {
  state.failed = true
  await open()
  expect(document.body.textContent).toContain('工作空间读取失败，操作已暂停')
  expect(button('执行命令').disabled).toBe(true)
  expect(button('接通执行能力').disabled).toBe(true)
  expect(state.invoke).not.toHaveBeenCalled()
})
it('keeps an old browser frame visible but rejects pointer input after a generation change', async () => {
  state.value = {
    assistantId: environment.assistantId,
    environmentVersion: 7,
    latest: {
      id: 'original',
      kind: 'browser',
      status: 'succeeded',
      assistantId: environment.assistantId,
      environmentVersion: 7,
      browser: {
        controlId: 'control',
        generation: 1,
        instanceId: 'instance',
        width: 800,
        height: 600,
        jpegBase64: 'AA==',
      },
    },
    browserControl: {
      controlId: 'control',
      generation: 2,
      owner: 'user',
      instanceId: 'instance',
      expiresAt: '2099-01-01T00:00:00Z',
    },
  }
  await open()
  await click(
    Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]')).find(
      (e) => e.textContent === '浏览器',
    )!,
  )
  const pointer = document.querySelector<HTMLButtonElement>(
    'button[aria-label="在浏览器画面中点击"]',
  )!
  expect(pointer).not.toBeNull()
  expect(pointer.disabled).toBe(true)
  expect(document.body.textContent).toContain('保留的观察画面')
  expect(state.invoke).not.toHaveBeenCalled()
})
