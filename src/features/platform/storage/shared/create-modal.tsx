import { useEffect, useState } from 'react'
import { Alert, Button, Modal, message } from 'antd'
import { useMutation, useQueryClient, type MutationOptions } from '@tanstack/react-query'
import { K8sYamlEditor } from '@/components/k8s-yaml-editor'
import { useI18n } from '@/i18n'
import type { ResourceYAMLView, ScopeKey } from '@/types'
import type { CreateStorageVariables } from './types'

export default function StorageCreateModal({
  createOptions,
  defaultTemplate,
  kind,
  onClose,
  scope,
}: {
  createOptions: (
    queryClient: ReturnType<typeof useQueryClient>,
  ) => MutationOptions<ResourceYAMLView, Error, CreateStorageVariables>
  defaultTemplate: string
  kind: string
  onClose: () => void
  scope: ScopeKey
}) {
  const { t, localeCode } = useI18n()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(defaultTemplate)
  const createMutation = useMutation(createOptions(queryClient))

  useEffect(() => setDraft(defaultTemplate), [defaultTemplate])

  return (
    <Modal
      title={localeCode === 'zh_CN' ? `新建 ${kind}` : `Create ${kind}`}
      open
      onCancel={onClose}
      footer={null}
      width={960}
      mask={{ closable: false }}
    >
      <Alert
        banner
        showIcon
        type="info"
        description={
          localeCode === 'zh_CN'
            ? scope.namespace
              ? `命名空间：${scope.namespace}。可在 YAML 内指定 metadata.namespace 覆盖。`
              : '当前资源为 cluster scope，metadata.namespace 必须留空。'
            : scope.namespace
              ? `Namespace: ${scope.namespace}. You can override via metadata.namespace in YAML.`
              : 'This resource is cluster-scoped. Keep metadata.namespace empty.'
        }
      />
      <div style={{ marginTop: 12 }}>
        <K8sYamlEditor
          value={draft}
          onChange={setDraft}
          onReset={() => setDraft(defaultTemplate)}
          onSave={() =>
            void message.info(
              localeCode === 'zh_CN'
                ? '新建模式不支持本地草稿'
                : 'Draft saving disabled in create mode',
            )
          }
          onApply={() =>
            createMutation.mutate(
              { scope, content: draft },
              {
                onSuccess: () => {
                  void message.success(
                    localeCode === 'zh_CN' ? `${kind} 已创建` : `${kind} created`,
                  )
                  onClose()
                },
                onError: (error) => void message.error(error.message),
              },
            )
          }
          saveDisabled
          applyDisabled={!draft.trim() || createMutation.isPending}
          applying={createMutation.isPending}
          editorHeight="min(46vh, 440px)"
        />
      </div>
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
      </div>
    </Modal>
  )
}
