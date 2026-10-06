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
import { ConfigMapDataTab } from './data-tab'
import { configMapMutations } from './mutations'
import { configMapQueries } from './queries'

export function ConfigMapDetailPage() {
  const { localeCode } = useI18n()
  const { message } = App.useApp()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { clusterId, namespace } = usePlatformScopeStore()
  const name = params.configMapName as string
  const detailNamespace = resolveConfigurationNamespace(namespace, searchParams.get('namespace'))
  const scope = toScopeKey(clusterId, detailNamespace)
  const target = { scope, name }
  const detailQuery = useQuery(configMapQueries.detail(scope, name))
  const updateDataMutation = useMutation(configMapMutations.updateData(queryClient))
  const permissionSnapshot = usePermissionSnapshot().data?.data
  const canEditData = hasPermission(permissionSnapshot, 'platform.configuration.config-maps.update')
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
          description={localeCode === 'zh_CN' ? 'ConfigMap 未找到' : 'ConfigMap not found'}
        />
      </div>
    )
  }

  return (
    <ConfigurationDetailShell
      dataTab={
        <ConfigMapDataTab
          key={JSON.stringify([scope.clusterId, detailNamespace, name])}
          applying={updateDataMutation.isPending}
          canEdit={canEditData}
          detail={detail}
          onApply={(data) =>
            updateDataMutation.mutateAsync(
              {
                target,
                payload: { data, binaryData: detail.binaryData ?? {} },
              },
              {
                onSuccess: () =>
                  void message.success(localeCode === 'zh_CN' ? '数据已更新' : 'Data updated'),
              },
            )
          }
        />
      }
      detail={detail}
      kind="configmaps"
      label="ConfigMap"
      overviewExtra={[{ key: 'Immutable', value: detail.immutable ? 'Yes' : 'No' }]}
      target={target}
    />
  )
}
