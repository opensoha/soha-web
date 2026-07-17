/** @vitest-environment jsdom */

import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MetadataTag, StatusTag } from './status-tag'

const captured = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}))

vi.mock('antd', () => ({
  Tag: ({ children, ...props }: { children?: ReactNode }) => {
    captured.props = props
    return <span>{children}</span>
  },
}))

describe('StatusTag', () => {
  beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  })

  afterEach(() => {
    captured.props = null
    document.body.replaceChildren()
  })

  it('uses the shared compact filled tag treatment', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<StatusTag value="healthy" />)
    })

    expect(captured.props).toMatchObject({
      className: 'soha-status-tag',
      color: 'success',
      variant: 'filled',
    })

    await act(async () => root.unmount())
  })

  it('uses the same filled treatment for categorical metadata', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<MetadataTag label="构建" tone="purple" />)
    })

    expect(container.textContent).toBe('构建')
    expect(captured.props).toMatchObject({
      className: 'soha-metadata-tag',
      color: 'purple',
      variant: 'filled',
    })

    await act(async () => root.unmount())
  })
})
