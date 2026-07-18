// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { getResourceFormDefinition } from './definitions'

describe('resource step form', () => {
  let container: HTMLDivElement | undefined
  let root: ReturnType<typeof createRoot> | undefined

  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }))
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
    root = undefined
    container = undefined
  })

  it('renders shared steps and navigation for a workload definition', async () => {
    const definition = getResourceFormDefinition('Deployment')
    const value = definition?.defaultValues({ namespace: 'minio' })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(
        definition?.renderForm({
          namespaceOptions: ['minio', 'platform'],
          value,
          onChange: vi.fn(),
          onSubmit: vi.fn(),
        }),
      )
    })
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(container.textContent).toContain('基本信息')
    expect(container.textContent).toContain('工作负载')
    expect(container.textContent).toContain('Pod 模板')
    expect(container.textContent).toContain('下一步')
    expect(container.querySelector('#namespace')?.getAttribute('role')).toBe('combobox')
    expect(container.querySelector('.ant-select-content')?.getAttribute('title')).toBe('minio')
    expect(container.textContent).not.toContain('切换到 YAML')
  })
})
