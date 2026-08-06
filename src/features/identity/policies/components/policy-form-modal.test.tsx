import type { ComponentProps, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PolicyFormModal } from './policy-form-modal'

const lifecycle = vi.hoisted(() => ({
  destroyOnHidden: undefined as boolean | undefined,
  preserve: undefined as boolean | undefined,
}))

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>()
  const FormMock = ({ children, preserve }: { children?: ReactNode; preserve?: boolean }) => {
    lifecycle.preserve = preserve
    return <>{children}</>
  }
  FormMock.Item = ({ children }: { children?: ReactNode }) => <>{children}</>
  FormMock.List = ({
    children,
  }: {
    children: (fields: never[], operations: { add: () => void; remove: () => void }) => ReactNode
  }) => <>{children([], { add: () => undefined, remove: () => undefined })}</>
  FormMock.useForm = () => [{}]

  return {
    ...actual,
    Form: FormMock,
    Modal: ({ children, destroyOnHidden }: { children?: ReactNode; destroyOnHidden?: boolean }) => {
      lifecycle.destroyOnHidden = destroyOnHidden
      return <>{children}</>
    },
  }
})

describe('PolicyFormModal lifecycle', () => {
  beforeEach(() => {
    lifecycle.destroyOnHidden = undefined
    lifecycle.preserve = undefined
  })

  it('discards policy fields after closing', () => {
    const props = {
      editing: null,
      onCancel: () => undefined,
      onSubmit: () => undefined,
      open: true,
      stepUpAvailable: true,
      submitting: false,
    } satisfies ComponentProps<typeof PolicyFormModal>

    renderToStaticMarkup(<PolicyFormModal {...props} />)

    expect(lifecycle.destroyOnHidden).toBe(true)
    expect(lifecycle.preserve).toBe(false)
  })
})
