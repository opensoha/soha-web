import { lazy, Suspense, useEffect, useState } from 'react'
import { Card, Spin, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import {
  StorageDetailShell,
  StorageDetailTabs,
  StorageResourceOverview,
} from '../shared/detail-layout'
import { toStorageScope } from '../shared/scope'
import { persistentVolumeClaimMutations } from './mutations'
import { persistentVolumeClaimQueries } from './queries'

const StorageYAMLPanel = lazy(() => import('../shared/yaml-panel'))

export function StoragePvcDetailPage() {
  const { localeCode } = useI18n()
  const { name = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { clusterId, namespace } = usePlatformScopeStore()
  const detailNamespace = namespace || searchParams.get('namespace') || ''
  const scope = toStorageScope(clusterId, detailNamespace)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [yamlDraft, setYAMLDraft] = useState('')
  const detailQuery = useQuery(persistentVolumeClaimQueries.detail(scope, name))
  const yamlOptions = persistentVolumeClaimQueries.yaml(scope, name)
  const yamlQuery = useQuery({
    ...yamlOptions,
    enabled: Boolean(yamlOptions.enabled) && activeTab === 'yaml',
  })
  const updateYAMLMutation = useMutation(persistentVolumeClaimMutations.updateYAML(queryClient))
  const serverValue = yamlQuery.data?.content ?? ''

  useEffect(() => setYAMLDraft(serverValue), [serverValue])

  if (!clusterId || !detailNamespace) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="select-scope"
          description={
            localeCode === 'zh_CN' ? '请选择集群和命名空间' : 'Select a cluster and namespace'
          }
        />
      </div>
    )
  }
  if (detailQuery.isLoading) return <Card loading className="soha-detail-card" />
  const detail = detailQuery.data
  if (!detail) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={localeCode === 'zh_CN' ? 'PVC 未找到' : 'PVC not found'}
        />
      </div>
    )
  }

  return (
    <StorageDetailShell kind="PVC" name={detail.name}>
      <StorageDetailTabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: localeCode === 'zh_CN' ? '概览' : 'Overview',
            children: (
              <StorageResourceOverview
                name={detail.name}
                namespace={detail.namespace}
                createdAt={detail.createdAt}
                ageSeconds={detail.ageSeconds}
                labels={detail.labels}
                annotations={detail.annotations}
                extra={[
                  {
                    key: localeCode === 'zh_CN' ? '状态' : 'Status',
                    value: <StatusTag value={detail.status} />,
                  },
                  { key: 'Volume', value: detail.volumeName || '-' },
                  { key: 'StorageClass', value: detail.storageClass || '-' },
                  {
                    key: localeCode === 'zh_CN' ? '申请容量' : 'Requested',
                    value: detail.requested || '-',
                  },
                  {
                    key: localeCode === 'zh_CN' ? '已分配容量' : 'Capacity',
                    value: detail.capacity || '-',
                  },
                  { key: 'VolumeMode', value: detail.volumeMode || '-' },
                  { key: 'AccessModes', value: detail.accessModes?.join(', ') || '-' },
                ]}
              />
            ),
          },
          {
            key: 'yaml',
            label: 'YAML',
            children:
              activeTab === 'yaml' ? (
                <Suspense
                  fallback={
                    <Card className="soha-detail-card">
                      <Spin size="large" />
                    </Card>
                  }
                >
                  <StorageYAMLPanel
                    applying={updateYAMLMutation.isPending}
                    draft={yamlDraft}
                    onChange={setYAMLDraft}
                    onReset={() => setYAMLDraft(serverValue)}
                    onApply={() =>
                      updateYAMLMutation.mutate(
                        { scope, name, content: yamlDraft },
                        {
                          onSuccess: (resourceYAML) => {
                            setYAMLDraft(resourceYAML.content ?? yamlDraft)
                            void message.success('YAML applied')
                          },
                          onError: (error) => void message.error(error.message),
                        },
                      )
                    }
                  />
                </Suspense>
              ) : null,
          },
        ]}
      />
    </StorageDetailShell>
  )
}
