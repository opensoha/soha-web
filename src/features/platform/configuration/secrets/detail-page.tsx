import { App, Button, Spin } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { ConfigurationDetailShell } from '../shared/detail-shell'
import { resolveConfigurationNamespace } from '../shared/scope'
import { SecretDataTab } from './data-tab'
import { secretMutations } from './mutations'
import { secretQueries } from './queries'

export function SecretDetailPage() {
  const { localeCode } = useI18n()
  const { message } = App.useApp()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { clusterId, namespace } = usePlatformScopeStore()
  const name = params.secretName as string
  const detailNamespace = resolveConfigurationNamespace(namespace, searchParams.get('namespace'))
  const scope = toScopeKey(clusterId, detailNamespace)
  const target = { scope, name }
  const detailQuery = useQuery(secretQueries.detail(scope, name))
  const updateDataMutation = useMutation(secretMutations.updateData(queryClient))
  const permissionSnapshot = usePermissionSnapshot().data?.data
  const canEditData = hasPermission(permissionSnapshot, 'platform.configuration.secrets.update')
  const detail = detailQuery.data

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }
  if (detailQuery.isError) {
    const error = detailQuery.error
    const status = error && 'status' in error ? error.status : undefined
    return (
      <div className="soha-page">
        <ManagementState
          kind={status === 404 ? 'not-found' : status === 403 ? 'no-permission' : 'error'}
          description={error.message}
          actions={
            <Button onClick={() => void detailQuery.refetch()}>
              {localeCode === 'zh_CN' ? '重试' : 'Retry'}
            </Button>
          }
        />
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? 'Secret 未找到' : 'Secret not found'}
        />
      </div>
    )
  }

  return (
    <ConfigurationDetailShell
      dataTab={
        <SecretDataTab
          key={JSON.stringify([scope.clusterId, detailNamespace, name])}
          applying={updateDataMutation.isPending}
          canEdit={canEditData}
          detail={detail}
          onApply={(data) =>
            updateDataMutation.mutateAsync(
              { target, payload: { data } },
              {
                onSuccess: () =>
                  void message.success(localeCode === 'zh_CN' ? '数据已更新' : 'Data updated'),
              },
            )
          }
        />
      }
      detail={detail}
      kind="secrets"
      label="Secret"
      overviewExtra={[
        { key: 'Type', value: detail.type || '-' },
        { key: 'Immutable', value: detail.immutable ? 'Yes' : 'No' },
      ]}
      target={target}
    />
  )
}
