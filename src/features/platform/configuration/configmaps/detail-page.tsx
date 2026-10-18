import { ManagementState } from '@/components/management-list'
import { ReadFeedback } from '@/components/request-feedback'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import {
  platformResourceTarget,
  usePlatformMutation,
} from '@/features/platform/shared/use-platform-mutation'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { readableQueryData } from '@/utils/query-feedback'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Spin } from 'antd'
import { useParams, useSearchParams } from 'react-router-dom'
import { ConfigurationDetailShell } from '../shared/detail-shell'
import { resolveConfigurationNamespace } from '../shared/scope'
import { ConfigMapDataTab } from './data-tab'
import { configMapMutations } from './mutations'
import { configMapQueries } from './queries'

export function ConfigMapDetailPage() {
  const { localeCode } = useI18n()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { clusterId, namespace } = usePlatformScopeStore()
  const name = params.configMapName as string
  const detailNamespace = resolveConfigurationNamespace(namespace, searchParams.get('namespace'))
  const scope = toScopeKey(clusterId, detailNamespace)
  const target = { scope, name }
  const detailQuery = useQuery(configMapQueries.detail(scope, name))
  const visibleDetailQueryData = readableQueryData(detailQuery)
  const updateDataMutation = usePlatformMutation(configMapMutations.updateData(queryClient), {
    label: ['应用数据更改', 'Apply data changes'],
    target: (variables) => platformResourceTarget(variables.target),
  })
  const platformWriteBlocked = updateDataMutation.blocked
  const permissionSnapshot = usePermissionSnapshot().data?.data
  const canEditData = hasPermission(permissionSnapshot, 'platform.configuration.config-maps.update')
  const detail = visibleDetailQueryData

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }
  if (detailQuery.isError && visibleDetailQueryData === undefined) {
    return <ReadFeedback canRead={detailQuery.isEnabled} query={detailQuery} label="资源记录" />
  }
  if (detailQuery.isError && !detail)
    return <ReadFeedback canRead={detailQuery.isEnabled} query={detailQuery} label="资源详情" />
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
    <>
      <ReadFeedback canRead={detailQuery.isEnabled} query={detailQuery} label="资源详情" />
      {updateDataMutation.feedback}
      <ConfigurationDetailShell
        dataTab={
          <ConfigMapDataTab
            key={JSON.stringify([scope.clusterId, detailNamespace, name])}
            applying={updateDataMutation.isPending}
            blocked={platformWriteBlocked || Boolean(detailQuery.error)}
            canEdit={canEditData}
            detail={detail}
            onApply={(data) =>
              updateDataMutation.mutateAsync(
                {
                  target,
                  payload: { data, binaryData: detail.binaryData ?? {} },
                },
                {},
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
    </>
  )
}
