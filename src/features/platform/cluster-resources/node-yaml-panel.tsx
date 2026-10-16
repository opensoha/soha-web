import { K8sYamlEditor } from '@/components/k8s-yaml-editor'
import { ReadFeedback } from '@/components/request-feedback'
import { useYamlDraft } from '@/components/use-yaml-draft'
import {
  platformResourceTarget,
  usePlatformMutation,
} from '@/features/platform/shared/use-platform-mutation'
import { useI18n } from '@/i18n'
import { readableQueryData } from '@/utils/query-feedback'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Card, Spin, Typography } from 'antd'
import { useMemo } from 'react'
import { nodeMutations } from './mutations'
import { nodeQueries } from './queries'
import type { ClusterScope } from './types'

const { Text } = Typography

export default function NodeYAMLPanel({
  scope,
  nodeName,
}: {
  scope: ClusterScope
  nodeName: string
}) {
  const { localeCode, t } = useI18n()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const yamlQuery = useQuery(nodeQueries.yaml(scope, nodeName))
  const visibleYamlQueryData = readableQueryData(yamlQuery)
  const applyYAMLMutation = usePlatformMutation(nodeMutations.applyYAML(queryClient), {
    label: ['应用节点 YAML', 'Apply node YAML'],
    target: platformResourceTarget,
  })
  const platformWriteBlocked = applyYAMLMutation.blocked
  const draftStorageKey = useMemo(
    () => (scope.clusterId && nodeName ? `kc:yaml-draft:${scope.clusterId}:node:${nodeName}` : ''),
    [nodeName, scope.clusterId],
  )
  const yamlState = useYamlDraft(draftStorageKey, visibleYamlQueryData?.content, draftStorageKey)
  const { value: draft, setValue: setDraft } = yamlState

  if (yamlQuery.isLoading) {
    return (
      <Card className="soha-detail-card">
        <div className="flex items-center justify-center h-64">
          <Spin size="large" />
        </div>
      </Card>
    )
  }

  if (yamlQuery.isError) {
    return (
      <Card className="soha-detail-card">
        <Text type="warning">
          {yamlQuery.error.message ||
            (localeCode === 'zh_CN' ? '节点 YAML 暂不可用' : 'Node YAML is unavailable')}
        </Text>
      </Card>
    )
  }

  return (
    <>
      <ReadFeedback canRead={yamlQuery.isEnabled} query={yamlQuery} label="YAML" />
      {applyYAMLMutation.feedback}
      {yamlQuery.isError && visibleYamlQueryData === undefined ? null : (
        <K8sYamlEditor
          key={yamlState.resourceKey}
          value={draft}
          original={yamlState.original}
          serverChanged={yamlState.serverChanged}
          onCompareLatest={yamlState.compareLatest}
          onChange={setDraft}
          onReset={() => {
            yamlState.reset()
            void message.success(t('yamlEditor.resetSuccess', 'YAML draft reset'))
          }}
          onSave={() => {
            if (!draftStorageKey) return
            window.localStorage.setItem(draftStorageKey, draft)
            void message.success(t('yamlEditor.saveSuccess', 'YAML draft saved locally'))
          }}
          onApply={() =>
            applyYAMLMutation.mutate(
              { scope, name: nodeName, content: draft },
              {
                onSuccess: (response) => {
                  yamlState.applied(response.content)
                },
              },
            )
          }
          saveDisabled={!draftStorageKey}
          applyDisabled={platformWriteBlocked || !draft.trim()}
          applying={applyYAMLMutation.isPending}
        />
      )}
    </>
  )
}
