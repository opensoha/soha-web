import { useEffect, useMemo, useState } from 'react'
import { App, Card, Spin, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { K8sYamlEditor } from '@/components/k8s-yaml-editor'
import { useI18n } from '@/i18n'
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
  const applyYAMLMutation = useMutation(nodeMutations.applyYAML(queryClient))
  const serverValue = yamlQuery.data?.content ?? ''
  const draftStorageKey = useMemo(
    () => (scope.clusterId && nodeName ? `kc:yaml-draft:${scope.clusterId}:node:${nodeName}` : ''),
    [nodeName, scope.clusterId],
  )
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!yamlQuery.data) return
    const savedDraft = draftStorageKey ? window.localStorage.getItem(draftStorageKey) : null
    setDraft(savedDraft ?? serverValue)
  }, [draftStorageKey, serverValue, yamlQuery.data])

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
    <K8sYamlEditor
      value={draft}
      onChange={setDraft}
      onReset={() => {
        if (draftStorageKey) window.localStorage.removeItem(draftStorageKey)
        setDraft(serverValue)
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
              if (draftStorageKey) window.localStorage.removeItem(draftStorageKey)
              setDraft(response.content ?? draft)
              void message.success(t('yamlEditor.applySuccess', 'YAML applied'))
            },
            onError: (error) => void message.error(error.message),
          },
        )
      }
      saveDisabled={!draftStorageKey}
      applyDisabled={!draft.trim()}
      applying={applyYAMLMutation.isPending}
    />
  )
}
