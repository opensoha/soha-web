import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FormInstance } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StepFormModal } from './step-form-modal'

const lifecycle = vi.hoisted(() => ({
  destroyOnHidden: undefined as boolean | undefined,
  preserve: undefined as boolean | undefined,
}))

vi.mock('antd', () => ({
  Modal: ({ children, destroyOnHidden }: { children?: ReactNode; destroyOnHidden?: boolean }) => {
    lifecycle.destroyOnHidden = destroyOnHidden
    return <>{children}</>
  },
}))

vi.mock('./step-form', () => ({
  StepForm: ({ preserve }: { preserve?: boolean }) => {
    lifecycle.preserve = preserve
    return null
  },
}))

describe('StepFormModal lifecycle', () => {
  beforeEach(() => {
    lifecycle.destroyOnHidden = undefined
    lifecycle.preserve = undefined
  })

  it('discards the external form store after closing', () => {
    renderToStaticMarkup(
      <StepFormModal
        current={0}
        form={{} as FormInstance<Record<string, unknown>>}
        onClose={() => undefined}
        onCurrentChange={() => undefined}
        onFinish={() => undefined}
        open
        steps={[]}
        title="Test form"
      />,
    )

    expect(lifecycle.destroyOnHidden).toBe(true)
    expect(lifecycle.preserve).toBe(false)
  })
})
