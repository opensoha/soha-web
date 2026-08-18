import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FormInstance } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StepFormModal } from './step-form-modal'

const lifecycle = vi.hoisted(() => ({
  contentMaxWidth: undefined as number | string | undefined,
  destroyOnHidden: undefined as boolean | undefined,
  disabled: undefined as boolean | undefined,
  preserve: undefined as boolean | undefined,
}))

vi.mock('antd', () => ({
  Modal: ({ children, destroyOnHidden }: { children?: ReactNode; destroyOnHidden?: boolean }) => {
    lifecycle.destroyOnHidden = destroyOnHidden
    return <>{children}</>
  },
}))

vi.mock('./step-form', () => ({
  StepForm: ({
    contentMaxWidth,
    disabled,
    preserve,
  }: {
    contentMaxWidth?: number | string
    disabled?: boolean
    preserve?: boolean
  }) => {
    lifecycle.contentMaxWidth = contentMaxWidth
    lifecycle.disabled = disabled
    lifecycle.preserve = preserve
    return null
  },
}))

describe('StepFormModal lifecycle', () => {
  beforeEach(() => {
    lifecycle.contentMaxWidth = undefined
    lifecycle.destroyOnHidden = undefined
    lifecycle.disabled = undefined
    lifecycle.preserve = undefined
  })

  it('discards the external form store after closing', () => {
    renderToStaticMarkup(
      <StepFormModal
        contentMaxWidth={800}
        current={0}
        disabled
        form={{} as FormInstance<Record<string, unknown>>}
        onClose={() => undefined}
        onCurrentChange={() => undefined}
        onFinish={() => undefined}
        open
        steps={[]}
        title="Test form"
      />,
    )

    expect(lifecycle.contentMaxWidth).toBe(800)
    expect(lifecycle.destroyOnHidden).toBe(true)
    expect(lifecycle.disabled).toBe(true)
    expect(lifecycle.preserve).toBe(false)
  })
})
