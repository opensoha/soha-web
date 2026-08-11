/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntdApp } from 'antd'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n'
import { ResourceMetricsPanel } from './resource-metrics-panel'

vi.mock('@visactor/react-vchart', () => ({ LineChart: () => <div /> }))

describe('ResourceMetricsPanel', () => {
  beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
  })

  afterEach(() => document.body.replaceChildren())

  it('shows the backend reason instead of generic empty cards in compact mode', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <AntdApp>
          <I18nProvider>
            <ResourceMetricsPanel
              compact
              title="Pod metrics"
              data={{
                configured: false,
                source: 'prometheus',
                generatedAt: '2026-08-09T00:00:00Z',
                rangeMinutes: 60,
                stepSeconds: 60,
                message: 'prometheus is not configured',
                series: [],
              }}
            />
          </I18nProvider>
        </AntdApp>,
      )
    })

    expect(container.textContent).toContain('prometheus is not configured')
    expect(container.querySelectorAll('.soha-management-state')).toHaveLength(1)
    await act(async () => root.unmount())
  })
})
