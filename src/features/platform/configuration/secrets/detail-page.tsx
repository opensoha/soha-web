import { Spin, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { ConfigurationDetailShell } from '../shared/detail-shell'
import { resolveConfigurationNamespace } from '../shared/scope'
import { SecretDataTab } from './data-tab'
import { secretMutations } from './mutations'
import { secretQueries } from './queries'

export function SecretDetailPage() {
  const { localeCode } = useI18n()
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
          description={localeCode === 'zh_CN' ? 'Secret 未找到' : 'Secret not found'}
        />
      </div>
    )
  }

  return (
    <ConfigurationDetailShell
      dataTab={
        <SecretDataTab
          applying={updateDataMutation.isPending}
          detail={detail}
          onApply={(data) =>
            updateDataMutation.mutate(
              { target, payload: { data } },
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
