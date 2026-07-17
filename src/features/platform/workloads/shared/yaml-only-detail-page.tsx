import { lazy, Suspense, useEffect, useState } from 'react'
import { App, Card, Spin, Tabs } from 'antd'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { resolveWorkloadNamespace } from '@/features/platform/workloads-model'
import { useClusterCapability } from '@/features/platform/cluster-capabilities'
import { updateWorkloadYAML } from './api'
import { workloadQueries } from './queries'
import type { WorkloadKind } from './types'
import '@/features/platform/workloads/styles.css'

const K8sYamlEditor = lazy(async () => {
  const module = await import('@/components/k8s-yaml-editor')
  return { default: module.K8sYamlEditor }
})

export function WorkloadYAMLOnlyDetailPage({
  paramKey,
  resource,
  title,
}: {
  paramKey: string
  resource: WorkloadKind
  title: string
}) {
  const { t, localeCode } = useI18n()
  const { message } = App.useApp()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const name = params[paramKey] as string
  const { clusterId, namespace } = usePlatformScopeStore()
  const detailNamespace = resolveWorkloadNamespace(namespace, searchParams.get('namespace'))
  const scope = toScopeKey(clusterId, detailNamespace)
  const yamlQueryOptions = workloadQueries.yaml(resource, scope, name)
  const yamlQuery = useQuery(yamlQueryOptions)
  const yamlServerValue = yamlQuery.data?.content ?? ''
  const [yamlDraft, setYamlDraft] = useState('')
  const yamlApplyCapability = useClusterCapability('resource.yaml.apply', localeCode)

  const applyYamlMutation = useMutation({
    mutationFn: () => updateWorkloadYAML(resource, scope, name, { content: yamlDraft }),
    onSuccess: (resourceYAML) => {
      setYamlDraft(resourceYAML.content ?? yamlDraft)
      void message.success(t('yamlEditor.applySuccess', 'YAML applied'))
      void yamlQuery.refetch()
    },
    onError: (error: Error) => void message.error(error.message),
  })

  useEffect(() => {
    setYamlDraft(yamlServerValue)
  }, [yamlServerValue])

  return (
    <div className="soha-page soha-workload-detail-page">
      <Tabs
        className="soha-resource-tabs soha-workload-detail-tabs"
        defaultActiveKey="yaml"
        indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
        size="small"
        tabBarGutter={18}
        items={[
          {
            key: 'yaml',
            label: t('common.yaml', 'YAML'),
            children: yamlQuery.isLoading ? (
              <Card className="soha-detail-card">
                <Spin size="large" />
              </Card>
            ) : yamlQuery.isError ? (
              <ManagementState
                compact
                kind="not-found"
                title={localeCode === 'zh_CN' ? `${title}未找到` : `${title} not found`}
              />
            ) : (
              <Suspense
                fallback={
                  <Card className="soha-detail-card">
                    <Spin size="large" />
                  </Card>
                }
              >
                <K8sYamlEditor
                  value={yamlDraft}
                  onChange={setYamlDraft}
                  onReset={() => {
                    setYamlDraft(yamlServerValue)
                    void message.success(t('yamlEditor.resetSuccess', 'YAML draft reset'))
                  }}
                  onSave={() =>
                    void message.info(
                      localeCode === 'zh_CN'
                        ? '此页面不保存本地草稿'
                        : 'Local draft save disabled here',
                    )
                  }
                  onApply={() => applyYamlMutation.mutate()}
                  saveDisabled
                  applyDisabled={
                    !yamlQueryOptions.enabled || !yamlDraft.trim() || yamlApplyCapability.disabled
                  }
                  applyDisabledReason={
                    yamlApplyCapability.disabled ? yamlApplyCapability.reason : undefined
                  }
                  applying={applyYamlMutation.isPending}
                />
              </Suspense>
            ),
          },
        ]}
      />
    </div>
  )
}
