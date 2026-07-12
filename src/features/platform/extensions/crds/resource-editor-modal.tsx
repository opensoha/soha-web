import { lazy, Suspense, useEffect, useState } from 'react'
import { Alert, Button, Modal, Spin, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { crdMutations } from './mutations'
import { crdQueries } from './queries'
import type { CRD, CRDResourceInstance, CustomResourceTarget } from './types'
import { buildDefaultCustomResourceTemplate, isNamespacedCRD } from './utils'

const K8sYamlEditor = lazy(async () => {
  const module = await import('@/components/k8s-yaml-editor')
  return { default: module.K8sYamlEditor }
})

export interface CRDResourceEditorModalProps {
  crd: CRD
  customResourceCapabilityReason?: string
  customResourceMutationsDisabled?: boolean
  mode: 'create' | 'edit'
  onClose: () => void
  resource?: CRDResourceInstance | null
}

export function CRDResourceEditorModal({
  crd,
  customResourceCapabilityReason,
  customResourceMutationsDisabled = false,
  mode,
  onClose,
  resource,
}: CRDResourceEditorModalProps) {
  const { t, localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const effectiveNamespace = isNamespacedCRD(crd) ? (resource?.namespace ?? namespace ?? '') : ''
  const target: CustomResourceTarget | null =
    clusterId && mode === 'edit' && resource
      ? {
          clusterId,
          crd,
          namespace: effectiveNamespace,
          resourceName: resource.name,
        }
      : null
  const draftStorageKey = target
    ? `soha:crd-yaml:${target.clusterId}:${crd.name}:${effectiveNamespace}:${target.resourceName}`
    : null
  const yamlQuery = useQuery(crdQueries.yaml(target, mode === 'edit'))
  const applyMutation = useMutation(crdMutations.apply(queryClient))

  useEffect(() => {
    if (mode === 'create') {
      setDraft(buildDefaultCustomResourceTemplate(crd, namespace))
      return
    }
    if (draftStorageKey && typeof window !== 'undefined') {
      const savedDraft = window.localStorage.getItem(draftStorageKey)
      if (savedDraft) {
        setDraft(savedDraft)
        return
      }
    }
    setDraft(yamlQuery.data?.content ?? '')
  }, [crd, draftStorageKey, mode, namespace, yamlQuery.data?.content])

  const apply = () => {
    if (!clusterId) return
    applyMutation.mutate(
      {
        clusterId,
        content: draft,
        crd,
        mode,
        namespace: isNamespacedCRD(crd) ? effectiveNamespace : null,
        resourceName: resource?.name,
      },
      {
        onSuccess: () => {
          if (draftStorageKey && typeof window !== 'undefined') {
            window.localStorage.removeItem(draftStorageKey)
          }
          void message.success(
            localeCode === 'zh_CN'
              ? mode === 'create'
                ? `${crd.kind} 已创建`
                : `${crd.kind} YAML 已更新`
              : mode === 'create'
                ? `${crd.kind} created`
                : `${crd.kind} YAML updated`,
          )
          onClose()
        },
        onError: (error) => void message.error(error.message),
      },
    )
  }

  const bannerDescription = isNamespacedCRD(crd)
    ? localeCode === 'zh_CN'
      ? effectiveNamespace
        ? `当前资源遵循命名空间 scope。请求默认带上 namespace=${effectiveNamespace}，也可在 YAML 中覆盖 metadata.namespace。`
        : '当前为全部命名空间视图，请在 YAML 中显式填写 metadata.namespace。'
      : effectiveNamespace
        ? `This resource is namespaced. Requests default to namespace=${effectiveNamespace}; you can still override metadata.namespace in YAML.`
        : 'The current view spans all namespaces, so set metadata.namespace explicitly in YAML.'
    : localeCode === 'zh_CN'
      ? '当前资源为 cluster scope，命名空间选择不会参与请求。'
      : 'This resource is cluster-scoped, so the namespace selector is ignored for requests.'

  return (
    <Modal
      title={
        localeCode === 'zh_CN'
          ? `${mode === 'create' ? '新建' : '编辑'} ${crd.kind}`
          : `${mode === 'create' ? 'Create' : 'Edit'} ${crd.kind}`
      }
      open
      onCancel={onClose}
      footer={null}
      width={1080}
      destroyOnHidden
      mask={{ closable: false }}
    >
      {!clusterId ? (
        <ManagementState
          bordered={false}
          compact
          kind="select-scope"
          title={localeCode === 'zh_CN' ? '请先选择集群' : 'Select a cluster first'}
        />
      ) : mode === 'edit' && yamlQuery.isLoading ? (
        <div
          style={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Spin size="large" />
        </div>
      ) : mode === 'edit' && yamlQuery.isError ? (
        <Alert
          type="error"
          showIcon
          title={localeCode === 'zh_CN' ? 'YAML 加载失败' : 'Failed to load YAML'}
          description={yamlQuery.error.message}
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
          <Alert banner showIcon type="info" description={bannerDescription} />
          <div style={{ height: 560, marginTop: 12 }}>
            <K8sYamlEditor
              value={draft}
              onChange={setDraft}
              onReset={() => {
                if (mode === 'create') {
                  setDraft(buildDefaultCustomResourceTemplate(crd, namespace))
                  return
                }
                if (draftStorageKey && typeof window !== 'undefined') {
                  window.localStorage.removeItem(draftStorageKey)
                }
                setDraft(yamlQuery.data?.content ?? '')
                void message.success(t('yamlEditor.resetSuccess', 'YAML draft reset'))
              }}
              onSave={() => {
                if (!draftStorageKey || typeof window === 'undefined') return
                window.localStorage.setItem(draftStorageKey, draft)
                void message.success(t('yamlEditor.saveSuccess', 'YAML draft saved locally'))
              }}
              onApply={apply}
              saveDisabled={!draftStorageKey}
              applyDisabled={
                customResourceMutationsDisabled || !draft.trim() || applyMutation.isPending
              }
              applying={applyMutation.isPending}
            />
          </div>
          {customResourceCapabilityReason ? (
            <Alert
              showIcon
              type="warning"
              style={{ marginTop: 12 }}
              title={
                localeCode === 'zh_CN'
                  ? '当前连接模式限制自定义资源写入'
                  : 'Custom resource writes limited'
              }
              description={customResourceCapabilityReason}
            />
          ) : null}
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          </div>
        </Suspense>
      )}
    </Modal>
  )
}
