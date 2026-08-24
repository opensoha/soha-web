/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  ManagementQueryField,
  ManagementQueryGrid,
  ManagementQueryScope,
} from './management-list'

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

  it('measures the first query field for the collapsed layout', async () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getBoundingClientRect(this: HTMLElement) {
        const width = this.classList.contains('soha-management-query-grid') ? 320 : 300
        const height = this.classList.contains('soha-management-query-field') ? 52 : 28
        return {
          bottom: height,
          height,
          left: 0,
          right: width,
          top: 0,
          width,
          x: 0,
          y: 0,
          toJSON: () => undefined,
        }
      })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <ManagementQueryGrid actions={<button type="button">Search</button>}>
          <ManagementQueryField label="Keyword">
            <input />
          </ManagementQueryField>
        </ManagementQueryGrid>,
      )
    })

    expect(
      container
        .querySelector<HTMLElement>('.soha-management-query-fields')
        ?.style.getPropertyValue('--soha-management-query-collapsed-height'),
    ).toBe('52px')

    rectSpy.mockRestore()
    await act(async () => root.unmount())
  })
})
