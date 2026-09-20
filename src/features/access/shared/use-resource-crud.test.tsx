/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api-error'
import { useAccessResourceCrud } from './use-resource-crud'

const messages = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('antd', () => ({ App: { useApp: () => ({ message: messages }) } }))
const create = vi.fn<() => Promise<void>>()
const remove = vi.fn<() => Promise<void>>()
const invalidate = vi.fn(async () => undefined)
let crud: ReturnType<typeof useAccessResourceCrud<{ id: string }, readonly ['resources']>>
let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
let client: QueryClient
function Probe() {
  crud = useAccessResourceCrud<{ id: string }, readonly ['resources']>({
    create: { mutationFn: create },
    update: { mutationFn: create },
    delete: { mutationFn: remove },
    invalidate,
    query: { queryKey: ['resources'] as const, queryFn: async () => [] },
  })
  return null
}
beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    )
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})
it('rejects duplicate submissions and modal changes until the save settles', async () => {
  let resolveSave!: () => void
  create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSave = resolve
      }),
  )
  await act(async () => crud.openEdit({ id: 'original' }))
  await act(async () => {
    crud.handleSubmit({ name: 'Example' })
    crud.handleSubmit({ name: 'Duplicate' })
    crud.closeModal()
    crud.openCreate()
    crud.openEdit({ id: 'other' })
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(create).toHaveBeenCalledTimes(1)
  expect(crud.modalVisible).toBe(true)
  expect(crud.editing?.id).toBe('original')
  await act(async () => {
    resolveSave()
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(invalidate).toHaveBeenCalledTimes(1)
  expect(crud.modalVisible).toBe(false)
  expect(crud.editing).toBeNull()
})
it.each([403, 503, 0])(
  'does not add a local delete toast for globally handled status %s',
  async (status) => {
    remove.mockRejectedValueOnce(new ApiError(status, 'rejected'))
    await act(async () => {
      crud.deleteMutation.mutate('one')
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(messages.error).not.toHaveBeenCalled()
  },
)
it('keeps local feedback for a delete rejection without a global notification', async () => {
  remove.mockRejectedValueOnce(new ApiError(409, 'Resource is still in use'))
  await act(async () => {
    crud.deleteMutation.mutate('one')
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(messages.error).toHaveBeenCalledWith('Resource is still in use')
})
