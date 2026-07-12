import { lazy, Suspense, useEffect, useState } from 'react'
import { Alert, Button, Modal, Spin, message } from 'antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { accessControlMutations } from './mutations'
import { accessControlScopeFromSelection, accessControlScopeMode } from './scope'
import type { AccessControlKind } from './types'

const K8sYamlEditor = lazy(async () => {
  const module = await import('@/components/k8s-yaml-editor')
  return { default: module.K8sYamlEditor }
})

export function CreateAccessControlResourceModal({
  defaultTemplate,
  kind,
  label,
  onClose,
  open,
}: {
  defaultTemplate: string
  kind: AccessControlKind
  label: string
  onClose: () => void
  open: boolean
}) {
  const { t, localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(defaultTemplate)
  const scopeMode = accessControlScopeMode(kind)
  const effectiveNamespace = scopeMode === 'namespace' ? namespace || 'default' : null
  const scope = accessControlScopeFromSelection(kind, clusterId, effectiveNamespace)
  const createMutation = useMutation(accessControlMutations.create(kind, queryClient))

  useEffect(() => {
    if (open) setDraft(defaultTemplate)
  }, [defaultTemplate, open])

  return (
    <Modal
      title={localeCode === 'zh_CN' ? `新建 ${label}` : `Create ${label}`}
      closable={{
        'aria-label': localeCode === 'zh_CN' ? `关闭新建 ${label}` : `Close create ${label}`,
      }}
      footer={null}
      mask={{ closable: false }}
      onCancel={onClose}
      open={open}
      width={960}
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
            <div className="flex h-[520px] items-center justify-center">
              <Spin size="large" />
            </div>
          }
        >
          <Alert
            banner
            description={
              scopeMode === 'cluster'
                ? localeCode === 'zh_CN'
                  ? '当前资源为 cluster scope，metadata.namespace 必须留空。'
                  : 'This resource is cluster-scoped. Keep metadata.namespace empty.'
                : localeCode === 'zh_CN'
                  ? `命名空间：${effectiveNamespace}。可在 YAML 内指定 metadata.namespace 覆盖。`
                  : `Namespace: ${effectiveNamespace}. You can override via metadata.namespace in YAML.`
            }
            showIcon
            type="info"
          />
          <div style={{ marginTop: 12 }}>
            <K8sYamlEditor
              value={draft}
              onApply={() =>
                createMutation.mutate(
                  { scope, content: draft },
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
              onChange={setDraft}
              onReset={() => setDraft(defaultTemplate)}
              onSave={() =>
                void message.info(
                  localeCode === 'zh_CN'
                    ? '新建模式不支持本地草稿'
                    : 'Draft saving disabled in create mode',
                )
              }
              applyDisabled={!draft.trim() || createMutation.isPending}
              applying={createMutation.isPending}
              editorHeight="min(46vh, 440px)"
              saveDisabled
            />
          </div>
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          </div>
        </Suspense>
      )}
    </Modal>
  )
}
