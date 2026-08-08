/** @vitest-environment jsdom */

import type { ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { OperationalPlan } from '@opensoha/contracts/gen/ts/sohaapi'
import { OperationalPlanModal } from './operational-plan-modal'

vi.mock('antd', () => ({
  Alert: ({ title }: { title?: ReactNode }) => <div>{title}</div>,
  Descriptions: ({
    items,
    title,
  }: {
    items?: Array<{ children?: ReactNode }>
    title?: ReactNode
  }) => (
    <div>
      {title}
      {items?.map((item, index) => (
        <div key={index}>{item.children}</div>
      ))}
    </div>
  ),
  Modal: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
}))

vi.mock('./status-tag', () => ({
  StatusTag: ({ value }: { value?: string }) => <span>{value}</span>,
}))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

describe('OperationalPlanModal', () => {
  beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('renders legacy plans whose collection fields are null', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const plan = {
      capability: 'docker.project.deploy',
      target: 'nginx-open-source-stack',
      ready: true,
      riskLevel: 'low',
      requiresApproval: false,
      changes: null,
      warnings: null,
    } as unknown as OperationalPlan

    await act(async () => {
      root.render(
        <OperationalPlanModal
          onCancel={() => undefined}
          onConfirm={() => undefined}
          plan={plan}
          title="部署确认"
        />,
      )
    })

    expect(container.textContent).toContain('nginx-open-source-stack')
    expect(container.textContent).toContain('计划变更')
  })
})
