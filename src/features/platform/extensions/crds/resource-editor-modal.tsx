import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Alert, App, Button, Card, Modal, Spin } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useYamlDraft } from '@/components/use-yaml-draft'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { hasAllowedAction } from '@/features/auth'
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

export function CRDResourceEditor({
  crd,
  customResourceCapabilityReason,
  customResourceMutationsDisabled = false,
  mode,
  onClose,
  resource,
  editable = true,
  header,
  onStateChange,
}: Omit<CRDResourceEditorModalProps, 'onClose'> & {
  onClose?: () => void
  editable?: boolean
  header?: ReactNode
  onStateChange?: (state: { dirty: boolean; busy: boolean }) => void
}) {
  const { t, localeCode } = useI18n()
  const { message } = App.useApp()
  const { clusterId, namespace } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const readOnly =
    mode === 'edit' &&
    (!editable ||
      !hasAllowedAction(resource?.allowedActions, 'update') ||
      Boolean(resource?.deletingAt))
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
  const draftStorageKey =
    target && !readOnly
      ? `soha:crd-yaml:${target.clusterId}:${crd.name}:${effectiveNamespace}:${target.resourceName}`
      : null
  const yamlQuery = useQuery(crdQueries.yaml(target, mode === 'edit'))
  const applyMutation = useMutation(crdMutations.apply(queryClient))

  const yamlState = useYamlDraft(
    JSON.stringify([mode, clusterId, crd.name, effectiveNamespace, resource?.name]),
    mode === 'create'
      ? buildDefaultCustomResourceTemplate(crd, namespace)
      : yamlQuery.data?.content,
    draftStorageKey,
  )
  const { value: draft, setValue: setDraft } = yamlState
  useEffect(() => {
    onStateChange?.({
      dirty: !readOnly && yamlState.original !== undefined && draft !== yamlState.original,
      busy: applyMutation.isPending,
    })
  }, [onStateChange, readOnly, draft, yamlState.original, applyMutation.isPending])

  const apply = () => {
    if (
      !clusterId ||
      readOnly ||
      customResourceMutationsDisabled ||
      applyMutation.isPending ||
      (mode === 'edit' && yamlQuery.isError) ||
      yamlState.serverChanged ||
      !draft.trim()
    )
      return
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
        onSuccess: (yaml) => {
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
          yamlState.applied(yaml.content)
          onClose?.()
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
    <>
      {!clusterId ? (
        <ManagementState
          bordered={false}
          compact
          kind="select-scope"
          title={localeCode === 'zh_CN' ? '请先选择集群' : 'Select a cluster first'}
        />
      ) : mode === 'edit' && yamlQuery.isLoading ? (
        <Card className="soha-detail-card">
          {header}
          <div style={{ height: 520, display: 'grid', placeItems: 'center' }}>
            <Spin size="large" />
          </div>
        </Card>
      ) : mode === 'edit' && yamlQuery.isError && !yamlQuery.data ? (
        <Card className="soha-detail-card">
          {header}
          <ManagementState
            bordered={false}
            kind="error"
            title={localeCode === 'zh_CN' ? 'YAML 加载失败' : 'Failed to load YAML'}
            description={yamlQuery.error.message}
            actions={
              <Button onClick={() => void yamlQuery.refetch()}>
                {localeCode === 'zh_CN' ? '重试' : 'Retry'}
              </Button>
            }
          />
        </Card>
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
          {mode === 'create' ? (
            <Alert banner showIcon type="info" description={bannerDescription} />
          ) : null}
          <div>
            <K8sYamlEditor
              header={
                <>
                  {header}
                  {applyMutation.isError ? (
                    <Alert showIcon type="error" title={applyMutation.error.message} />
                  ) : null}
                </>
              }
              key={yamlState.resourceKey}
              value={readOnly ? (yamlQuery.data?.content ?? '') : draft}
              original={mode === 'edit' && !readOnly ? yamlState.original : undefined}
              readOnly={readOnly}
              error={mode === 'edit' && yamlQuery.isError ? yamlQuery.error : undefined}
              serverChanged={mode === 'edit' && yamlState.serverChanged}
              onCompareLatest={yamlState.compareLatest}
              onChange={setDraft}
              onReset={() => {
                yamlState.reset()
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
          {onClose && !header ? (
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Button disabled={applyMutation.isPending} onClick={onClose}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          ) : null}
        </Suspense>
      )}
    </>
  )
}

export function CRDResourceEditorModal(props: CRDResourceEditorModalProps) {
  const { localeCode } = useI18n()
  const readOnly =
    props.mode === 'edit' &&
    (!hasAllowedAction(props.resource?.allowedActions, 'update') ||
      Boolean(props.resource?.deletingAt))
  return (
    <Modal
      title={`${localeCode === 'zh_CN' ? (readOnly ? '查看' : props.mode === 'create' ? '新建' : '编辑') : readOnly ? 'View' : props.mode === 'create' ? 'Create' : 'Edit'} ${props.crd.kind}`}
      open
      onCancel={props.onClose}
      footer={null}
      width={1080}
      destroyOnHidden
      mask={{ closable: false }}
    >
      <CRDResourceEditor {...props} />
    </Modal>
  )
}
