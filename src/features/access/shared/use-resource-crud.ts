import { useState } from 'react'
import { App } from 'antd'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type { AccessMutationValues, AccessUpdateVariables } from './types'

interface AccessResourceCrudOptions<T extends { id: string }, TQueryKey extends QueryKey> {
  create: UseMutationOptions<void, Error, AccessMutationValues>
  delete: UseMutationOptions<void, Error, string>
  invalidate: (queryClient: ReturnType<typeof useQueryClient>) => Promise<unknown>
  query: UseQueryOptions<T[], Error, T[], TQueryKey>
  update: UseMutationOptions<void, Error, AccessUpdateVariables>
}

export function useAccessResourceCrud<T extends { id: string }, TQueryKey extends QueryKey>({
  create,
  delete: deleteOptions,
  invalidate,
  query: queryOptions,
  update,
}: AccessResourceCrudOptions<T, TQueryKey>) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const query = useQuery(queryOptions)

  const createMutation = useMutation({
    ...create,
    onSuccess: async () => {
      message.success('创建成功')
      await invalidate(queryClient)
      setModalVisible(false)
    },
    onError: (error) => message.error(error.message),
  })
  const updateMutation = useMutation({
    ...update,
    onSuccess: async () => {
      message.success('更新成功')
      await invalidate(queryClient)
      setModalVisible(false)
      setEditing(null)
    },
    onError: (error) => message.error(error.message),
  })
  const deleteMutation = useMutation({
    ...deleteOptions,
    onSuccess: async () => {
      message.success('删除成功')
      await invalidate(queryClient)
    },
    onError: (error) => message.error(error.message),
  })

  const handleSubmit = (values: AccessMutationValues) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values })
      return
    }
    createMutation.mutate(values)
  }

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    modalVisible,
    editing,
    openCreate: () => {
      setEditing(null)
      setModalVisible(true)
    },
    openEdit: (record: T) => {
      setEditing(record)
      setModalVisible(true)
    },
    closeModal: () => {
      setModalVisible(false)
      setEditing(null)
    },
    handleSubmit,
    deleteMutation,
    isSaving: createMutation.isPending || updateMutation.isPending,
  }
}
