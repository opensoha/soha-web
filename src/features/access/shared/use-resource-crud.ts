import { useRef, useState } from 'react'
import { App } from 'antd'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { isApiError } from '@/services/api-error'
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
  const [saveError, setSaveError] = useState<Error | null>(null)
  const saving = useRef(false)
  const query = useQuery(queryOptions)

  const createMutation = useMutation({
    ...create,
    onSuccess: async () => {
      message.success('创建成功')
      await invalidate(queryClient)
      setModalVisible(false)
    },
    onError: setSaveError,
    onSettled: () => {
      saving.current = false
    },
  })
  const updateMutation = useMutation({
    ...update,
    onSuccess: async () => {
      message.success('更新成功')
      await invalidate(queryClient)
      setModalVisible(false)
      setEditing(null)
    },
    onError: setSaveError,
    onSettled: () => {
      saving.current = false
    },
  })
  const deleteMutation = useMutation({
    ...deleteOptions,
    onSuccess: async () => {
      message.success('删除成功')
      await invalidate(queryClient)
    },
    onError: (error) => {
      // Auth, permission and infrastructure errors already have a global notification.
      if (!isApiError(error) || error.kind === 'client') message.error(error.message)
    },
  })

  const handleSubmit = (values: AccessMutationValues) => {
    if (saving.current) return
    saving.current = true
    setSaveError(null)
    if (editing) {
      updateMutation.mutate({ id: editing.id, values })
      return
    }
    createMutation.mutate(values)
  }

  return {
    data: query.data ?? [],
    isFetching: query.isFetching,
    isLoading: query.isLoading,
    refetch: query.refetch,
    modalVisible,
    editing,
    saveError,
    openCreate: () => {
      if (saving.current) return
      setSaveError(null)
      setEditing(null)
      setModalVisible(true)
    },
    openEdit: (record: T) => {
      if (saving.current) return
      setSaveError(null)
      setEditing(record)
      setModalVisible(true)
    },
    closeModal: () => {
      if (saving.current) return
      setSaveError(null)
      setModalVisible(false)
      setEditing(null)
    },
    handleSubmit,
    deleteMutation,
    isSaving: createMutation.isPending || updateMutation.isPending,
  }
}
