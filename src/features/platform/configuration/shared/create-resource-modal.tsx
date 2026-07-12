import { lazy, Suspense, useEffect, useState } from 'react'
import { Alert, Button, Modal, Spin, message } from 'antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import { configurationMutations } from './mutations'
import type { ConfigurationKind } from './types'

const K8sYamlEditor = lazy(async () => {
  const module = await import('@/components/k8s-yaml-editor')
  return { default: module.K8sYamlEditor }
})

export function CreateConfigurationResourceModal({
  defaultTemplate,
  kind,
  label,
  onClose,
  open,
}: {
  defaultTemplate: string
  kind: ConfigurationKind
  label: string
  onClose: () => void
  open: boolean
}) {
  const { t, localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(defaultTemplate)
  const effectiveNamespace = namespace || 'default'
  const createMutation = useMutation(configurationMutations.create(kind, queryClient))

  useEffect(() => {
    if (open) setDraft(defaultTemplate)
  }, [defaultTemplate, open])

  return (
    <Modal
      title={localeCode === 'zh_CN' ? `新建 ${label}` : `Create ${label}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={960}
      mask={{ closable: false }}
    >
      {!clusterId ? (
        <ManagementState
          compact
          kind="select-scope"
          description={localeCode === 'zh_CN' ? '请先选择集群' : 'Select a cluster first'}
        />
      ) : (
        <Suspense
          fallback={
            <div
              style={{
                height: 520,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Spin size="large" />
            </div>
          }
        >
          <Alert
            banner
            showIcon
            type="info"
            description={
              localeCode === 'zh_CN'
                ? `命名空间：${effectiveNamespace}。可在 YAML 内指定 metadata.namespace 覆盖。`
                : `Namespace: ${effectiveNamespace}. You can override via metadata.namespace in YAML.`
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
                  {
                    scope: toScopeKey(clusterId, effectiveNamespace),
                    content: draft,
                  },
                  {
                    onSuccess: () => {
                      void message.success(
                        localeCode === 'zh_CN' ? `${label} 已创建` : `${label} created`,
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
            <Button onClick={onClose} style={{ marginRight: 8 }}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </Suspense>
      )}
    </Modal>
  )
}
