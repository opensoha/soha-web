import { useQuery } from '@tanstack/react-query'
import { Button } from 'antd'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { deliveryQueries } from '../queries'

export function ApplicationEnvironmentDetailPage() {
  const { applicationEnvironmentId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const bindingQuery = useQuery(
    deliveryQueries.environments.detail(applicationEnvironmentId, Boolean(applicationEnvironmentId)),
  )

  if (bindingQuery.isLoading) {
    return <ManagementState kind="loading" title="正在解析应用环境" />
  }

  if (bindingQuery.isError) {
    return (
      <ManagementState
        kind="error"
        title="应用环境加载失败"
        description={(bindingQuery.error as Error).message}
        actions={<Button onClick={() => void bindingQuery.refetch()}>重试</Button>}
      />
    )
  }

  const binding = bindingQuery.data?.binding
  if (!binding?.applicationId) {
    return (
      <ManagementState
        kind="not-found"
        title="应用环境不存在"
        description="该绑定不存在或已被删除。"
      />
    )
  }

  const next = new URLSearchParams(searchParams)
  next.set('tab', 'environments')
  next.set('applicationEnvironmentId', binding.id)
  return (
    <Navigate
      replace
      to={`/applications/${encodeURIComponent(binding.applicationId)}?${next.toString()}`}
    />
  )
}
