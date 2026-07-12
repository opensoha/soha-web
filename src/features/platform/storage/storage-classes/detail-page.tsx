import { lazy, Suspense, useEffect, useState } from 'react'
import { Card, Descriptions, Spin, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { BooleanTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import {
  StorageDetailShell,
  StorageDetailTabs,
  StorageResourceOverview,
} from '../shared/detail-layout'
import { toClusterStorageScope } from '../shared/scope'
import { storageClassMutations } from './mutations'
import { storageClassQueries } from './queries'

const StorageYAMLPanel = lazy(() => import('../shared/yaml-panel'))

export function StorageClassDetailPage() {
  const { localeCode } = useI18n()
  const { name = '' } = useParams()
  const { clusterId } = usePlatformScopeStore()
  const scope = toClusterStorageScope(clusterId)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [yamlDraft, setYAMLDraft] = useState('')
  const detailQuery = useQuery(storageClassQueries.detail(scope, name))
  const yamlOptions = storageClassQueries.yaml(scope, name)
  const yamlQuery = useQuery({
    ...yamlOptions,
    enabled: Boolean(yamlOptions.enabled) && activeTab === 'yaml',
  })
  const updateYAMLMutation = useMutation(storageClassMutations.updateYAML(queryClient))
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
          description={localeCode === 'zh_CN' ? 'StorageClass 未找到' : 'StorageClass not found'}
        />
      </div>
    )
  }

  return (
    <StorageDetailShell kind="StorageClass" name={detail.name}>
      <StorageDetailTabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: localeCode === 'zh_CN' ? '概览' : 'Overview',
            children: (
              <>
                <StorageResourceOverview
                  name={detail.name}
                  namespace="-"
                  createdAt={detail.createdAt}
                  ageSeconds={detail.ageSeconds}
                  labels={detail.labels}
                  annotations={detail.annotations}
                  extra={[
                    { key: 'Provisioner', value: detail.provisioner },
                    { key: 'ReclaimPolicy', value: detail.reclaimPolicy || '-' },
                    { key: 'BindingMode', value: detail.volumeBindingMode || '-' },
                    {
                      key: localeCode === 'zh_CN' ? '允许扩容' : 'Expansion',
                      value: (
                        <BooleanTag
                          value={detail.allowVolumeExpansion}
                          trueLabel="Yes"
                          falseLabel="No"
                        />
                      ),
                    },
                  ]}
                />
                <Card
                  className="soha-detail-card"
                  title={localeCode === 'zh_CN' ? '参数' : 'Parameters'}
                >
                  {detail.parameters && Object.keys(detail.parameters).length > 0 ? (
                    <Descriptions
                      column={1}
                      items={Object.entries(detail.parameters).map(([key, value]) => ({
                        key,
                        label: key,
                        children: value,
                      }))}
                    />
                  ) : (
                    <ManagementState
                      bordered={false}
                      compact
                      description={localeCode === 'zh_CN' ? '暂无参数' : 'No parameters'}
                    />
                  )}
                </Card>
              </>
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
