/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ManagementQueryScope } from './management-list'

describe('ManagementQueryScope', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    window.matchMedia = () =>
      ({
        addEventListener: () => undefined,
        addListener: () => undefined,
        dispatchEvent: () => false,
        matches: false,
        media: '',
        onchange: null,
        removeEventListener: () => undefined,
        removeListener: () => undefined,
      }) as MediaQueryList
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  it('renders every quick-filter option in a non-shrinking query field', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <ManagementQueryScope
          label="业务域"
          options={[
            { value: 'all', label: '全部' },
            { value: 'system', label: '系统' },
            { value: 'access', label: '访问控制' },
            { value: 'platform', label: '平台' },
            { value: 'virtualization', label: '虚拟化' },
            { value: 'delivery', label: '交付' },
          ]}
          value="all"
        />,
      )
    })

    const field = container.querySelector('.soha-management-query-scope')
    expect(field).not.toBeNull()
    expect(field?.textContent).toContain('业务域')
    expect(field?.textContent).toContain('访问控制')
    expect(field?.textContent).toContain('交付')

    await act(async () => root.unmount())
  })
})
