import { Spin, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
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
  const updateDataMutation = useMutation(configMapMutations.updateData(queryClient))
  const detail = detailQuery.data

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
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
          applying={updateDataMutation.isPending}
          detail={detail}
          onApply={(data) =>
            updateDataMutation.mutate(
              {
                target,
                payload: { data, binaryData: detail.binaryData ?? {} },
              },
              {
                onSuccess: () =>
                  void message.success(localeCode === 'zh_CN' ? '数据已更新' : 'Data updated'),
                onError: (error) => void message.error(error.message),
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
