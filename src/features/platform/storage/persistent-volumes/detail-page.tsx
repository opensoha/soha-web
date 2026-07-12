import { lazy, Suspense, useEffect, useState } from 'react'
import { Card, Spin, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import {
  StorageDetailShell,
  StorageDetailTabs,
  StorageResourceOverview,
} from '../shared/detail-layout'
import { toClusterStorageScope } from '../shared/scope'
import { persistentVolumeMutations } from './mutations'
import { persistentVolumeQueries } from './queries'

const StorageYAMLPanel = lazy(() => import('../shared/yaml-panel'))

export function StoragePvDetailPage() {
  const { localeCode } = useI18n()
  const { name = '' } = useParams()
  const { clusterId } = usePlatformScopeStore()
  const scope = toClusterStorageScope(clusterId)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [yamlDraft, setYAMLDraft] = useState('')
  const detailQuery = useQuery(persistentVolumeQueries.detail(scope, name))
  const yamlOptions = persistentVolumeQueries.yaml(scope, name)
  const yamlQuery = useQuery({
    ...yamlOptions,
    enabled: Boolean(yamlOptions.enabled) && activeTab === 'yaml',
  })
  const updateYAMLMutation = useMutation(persistentVolumeMutations.updateYAML(queryClient))
  const serverValue = yamlQuery.data?.content ?? ''

  useEffect(() => setYAMLDraft(serverValue), [serverValue])

  if (!clusterId) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="select-scope"
          description={localeCode === 'zh_CN' ? '请选择集群' : 'Select a cluster'}
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
          description={localeCode === 'zh_CN' ? 'PV 未找到' : 'PV not found'}
        />
      </div>
    )
  }

  return (
    <StorageDetailShell kind="PV" name={detail.name}>
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
                namespace="-"
                createdAt={detail.createdAt}
                ageSeconds={detail.ageSeconds}
                labels={detail.labels}
                annotations={detail.annotations}
                extra={[
                  {
                    key: localeCode === 'zh_CN' ? '状态' : 'Status',
                    value: <StatusTag value={detail.status} />,
                  },
                  {
                    key: localeCode === 'zh_CN' ? '容量' : 'Capacity',
                    value: detail.capacity || '-',
                  },
                  { key: 'StorageClass', value: detail.storageClass || '-' },
                  { key: 'Claim', value: detail.claimRef || '-' },
                  { key: 'AccessModes', value: detail.accessModes?.join(', ') || '-' },
                  { key: 'ReclaimPolicy', value: detail.reclaimPolicy || '-' },
                  { key: 'VolumeMode', value: detail.volumeMode || '-' },
                ]}
              />
            ),
          },
          {
            key: 'yaml',
            label: 'YAML',
            children:
              activeTab === 'yaml' ? (
                <Suspense fallback={<Spin size="large" />}>
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
