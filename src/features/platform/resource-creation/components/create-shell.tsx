import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Alert, App, Button, Modal, Spin, Tabs, Typography } from 'antd'
import { CheckCircleOutlined, FileTextOutlined, FormOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { listClusters } from '@/features/platform/clusters/api'
import { clusterKeys } from '@/features/platform/clusters/keys'
import { useI18n } from '@/i18n'
import { resourceCreationMutations } from '../mutations'
import { resourceCreationQueries } from '../queries'
import {
  isPreflightCurrent,
  resolveResourceCreateDefaultNamespace,
  resourceCreateRequestFingerprint,
} from '../model'
import { hasResourceCreateForm, loadResourceCreateForm } from '../registry'
import type { ResourceFormDefinition } from '../forms'
import type { ResourceCreateContext, ResourceCreateResult, ResourceCreateSource } from '../types'
import { ResourceCreateResultTable } from './result-table'
import { ResourcePreflightTable } from './preflight-table'
import '../styles.css'

const { Text, Title } = Typography

const K8sYamlEditor = lazy(async () => {
  const module = await import('@/components/k8s-yaml-editor')
  return { default: module.K8sYamlEditor }
})

export interface ResourceCreateFormAdapter {
  readonly content: ReactNode
  readonly manifest: string
  readonly valid: boolean
}

export interface CreateShellProps {
  readonly context: ResourceCreateContext
  readonly defaultTemplate: string
  readonly form?: ResourceCreateFormAdapter
  readonly initialMode?: 'form' | 'yaml'
  readonly label?: string
  readonly onClose?: () => void
  readonly onCreated?: (result: ResourceCreateResult) => void
  readonly open?: boolean
  readonly presentation?: 'modal' | 'page'
  readonly formSupported?: boolean
  readonly title?: ReactNode
}

function createRequest(
  context: ResourceCreateContext,
  content: string,
  mode: 'form' | 'yaml',
  defaultNamespace?: string,
) {
  const source: ResourceCreateSource = mode === 'form' ? 'form' : context.source
  return {
    source,
    ...(defaultNamespace ? { defaultNamespace } : {}),
    ...(context.resourceGroup ? { resourceGroup: context.resourceGroup } : {}),
    ...(context.expectedApiVersion ? { expectedApiVersion: context.expectedApiVersion } : {}),
    ...(context.expectedKind ? { expectedKind: context.expectedKind } : {}),
    content,
  }
}

function ShellBody({
  context: initialContext,
  defaultTemplate,
  form,
  formSupported,
  initialMode = 'yaml',
  onCreated,
  visible,
}: CreateShellProps & { visible: boolean }) {
  const { localeCode } = useI18n()
  const { message } = App.useApp()
  const isChinese = localeCode === 'zh_CN'
  const queryClient = useQueryClient()
  const registryFormSupported = Boolean(
    formSupported ?? (!form && hasResourceCreateForm(initialContext.expectedKind)),
  )
  const [mode, setMode] = useState<'form' | 'yaml'>(
    form || registryFormSupported ? initialMode : 'yaml',
  )
  const [formDefinition, setFormDefinition] = useState<ResourceFormDefinition>()
  const [formValues, setFormValues] = useState<unknown>()
  const [draft, setDraft] = useState(defaultTemplate)
  const [preflightRequestFingerprint, setPreflightRequestFingerprint] = useState<string | null>(
    null,
  )
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
  const clustersQuery = useQuery({
    queryKey: clusterKeys.legacyList(),
    queryFn: listClusters,
    enabled: visible,
  })
  const namespacesQuery = useQuery({
    ...resourceCreationQueries.namespaces(initialContext.clusterId),
    enabled: visible && registryFormSupported && Boolean(initialContext.clusterId.trim()),
  })
  const preflightMutation = useMutation(resourceCreationMutations.preflight())
  const executeMutation = useMutation(resourceCreationMutations.execute(queryClient))
  const registryResource = useMemo(() => {
    if (!formDefinition || formValues == null) return undefined
    return formDefinition.buildManifest(formValues)
  }, [formDefinition, formValues])
  const registryManifest = useMemo(
    () => (registryResource ? JSON.stringify(registryResource, null, 2) : ''),
    [registryResource],
  )
  const content = mode === 'form' ? form?.manifest || registryManifest : draft
  const context = initialContext
  const clusterName =
    clustersQuery.data?.find((cluster) => cluster.id === initialContext.clusterId)?.name || ''
  const defaultNamespace = resolveResourceCreateDefaultNamespace({
    contextNamespace: context.defaultNamespace,
    formNamespace: registryResource?.metadata.namespace,
    mode,
  })
  const request = useMemo(
    () => createRequest(context, content, mode, defaultNamespace),
    [content, context, defaultNamespace, mode],
  )
  const requestFingerprint = useMemo(
    () => resourceCreateRequestFingerprint(context.clusterId, request),
    [context.clusterId, request],
  )
  const namespaceRequired =
    initialContext.scopeMode === 'namespace' &&
    initialContext.source !== 'global_yaml' &&
    !request.defaultNamespace
  const preflightCurrent = isPreflightCurrent(
    requestFingerprint,
    preflightRequestFingerprint,
    preflightMutation.data,
  )
  const canExecute = Boolean(preflightCurrent && preflightMutation.data?.ready)

  useEffect(() => {
    if (!visible) return
    setMode(form || registryFormSupported ? initialMode : 'yaml')
    setDraft(defaultTemplate)
    setPreflightRequestFingerprint(null)
    setIdempotencyKey(null)
    preflightMutation.reset()
    executeMutation.reset()
  }, [
    defaultTemplate,
    form,
    initialContext.clusterId,
    initialContext.defaultNamespace,
    initialContext.expectedApiVersion,
    initialContext.expectedKind,
    initialContext.resourceGroup,
    initialContext.scopeMode,
    initialContext.source,
    initialMode,
    registryFormSupported,
    visible,
  ])

  useEffect(() => {
    const kind = initialContext.expectedKind
    if (!visible || form || !registryFormSupported || !kind) return
    let cancelled = false
    void loadResourceCreateForm(kind).then((definition) => {
      if (cancelled || !definition) return
      setFormDefinition(definition)
      setFormValues(
        definition.defaultValues({ namespace: initialContext.defaultNamespace || null }),
      )
    })
    return () => {
      cancelled = true
    }
  }, [
    form,
    initialContext.defaultNamespace,
    initialContext.expectedKind,
    registryFormSupported,
    visible,
  ])

  function invalidatePreflight() {
    setPreflightRequestFingerprint(null)
    setIdempotencyKey(null)
    preflightMutation.reset()
    executeMutation.reset()
  }

  function runPreflight() {
    setPreflightRequestFingerprint(null)
    preflightMutation.mutate(
      { clusterId: context.clusterId, request },
      {
        onSuccess: () => {
          setPreflightRequestFingerprint(requestFingerprint)
          setIdempotencyKey(crypto.randomUUID())
        },
        onError: (error) => void message.error(error.message),
      },
    )
  }

  function execute() {
    if (!canExecute) return
    executeMutation.mutate(
      {
        clusterId: context.clusterId,
        idempotencyKey: idempotencyKey || crypto.randomUUID(),
        request,
      },
      {
        onSuccess: (result) => {
          onCreated?.(result)
          void message.success(
            result.status === 'succeeded'
              ? isChinese
                ? '资源创建完成'
                : 'Resources created'
              : isChinese
                ? '创建已完成，请检查逐项结果'
                : 'Creation finished; review the item results',
          )
        },
        onError: (error) => void message.error(error.message),
      },
    )
  }

  if (!context.clusterId) {
    return (
      <ManagementState
        compact
        description={isChinese ? '请先选择集群。' : 'Select a cluster first.'}
        kind="select-scope"
      />
    )
  }

  return (
    <div className="soha-resource-create-shell">
      {form || registryFormSupported ? (
        <div className="soha-resource-create-toolbar">
          <Tabs
            activeKey={mode}
            className="soha-resource-tabs is-header-only"
            items={[
              { icon: <FormOutlined />, key: 'form', label: isChinese ? '表单创建' : 'Form' },
              { icon: <FileTextOutlined />, key: 'yaml', label: 'YAML' },
            ]}
            onChange={(value) => {
              setMode(value as 'form' | 'yaml')
              invalidatePreflight()
            }}
          />
          <Text className="soha-resource-create-cluster-hint" type="secondary">
            {isChinese ? '集群' : 'Cluster'}:{' '}
            {clustersQuery.isLoading ? (isChinese ? '加载中' : 'Loading') : clusterName || '-'}
          </Text>
        </div>
      ) : null}

      {mode === 'form' && (form || registryFormSupported) ? (
        <div className="soha-resource-create-form">
          {form?.content ??
            (formDefinition && formValues != null ? (
              formDefinition.renderForm({
                loading: preflightMutation.isPending,
                localeCode,
                namespaceLoading: namespacesQuery.isLoading,
                namespaceOptions: (namespacesQuery.data ?? []).map((item) => item.name),
                onChange: (value) => {
                  setFormValues(value)
                  invalidatePreflight()
                },
                onSubmit: () => runPreflight(),
                submitText: isChinese ? '生成 Manifest 并预检' : 'Build manifest and preflight',
                value: formValues,
              })
            ) : (
              <div className="soha-resource-create-loading">
                <Spin size="large" />
              </div>
            ))}
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="soha-resource-create-loading">
              <Spin size="large" />
            </div>
          }
        >
          <K8sYamlEditor
            applyDisabled={!content.trim() || namespaceRequired || preflightMutation.isPending}
            applyDisabledReason={
              namespaceRequired
                ? isChinese
                  ? '列表创建必须选择命名空间。'
                  : 'Select a namespace for list creation.'
                : undefined
            }
            applyLabel={isChinese ? '预检' : 'Preflight'}
            applying={preflightMutation.isPending}
            editorHeight={
              initialContext.source === 'global_yaml' ? 'min(44vh, 460px)' : 'min(46vh, 480px)'
            }
            onApply={runPreflight}
            onChange={(value) => {
              setDraft(value)
              invalidatePreflight()
            }}
            onReset={() => {
              setDraft(defaultTemplate)
              invalidatePreflight()
            }}
            onSave={() => undefined}
            saveDisabled
            value={draft}
          />
        </Suspense>
      )}

      {mode === 'form' && form ? (
        <div className="soha-resource-create-form-actions">
          <Button
            disabled={!form.valid || namespaceRequired}
            loading={preflightMutation.isPending}
            onClick={runPreflight}
            type="primary"
          >
            {isChinese ? '生成 Manifest 并预检' : 'Build manifest and preflight'}
          </Button>
        </div>
      ) : null}

      {preflightMutation.isError ? (
        <Alert
          description={preflightMutation.error.message}
          showIcon
          title={isChinese ? '预检失败' : 'Preflight failed'}
          type="error"
        />
      ) : null}

      {preflightMutation.data ? (
        <section className="soha-resource-create-section">
          <div className="soha-resource-create-section-heading">
            <Title level={5}>{isChinese ? '预检结果' : 'Preflight result'}</Title>
            <StatusSummary ready={preflightMutation.data.ready} />
          </div>
          <ResourcePreflightTable items={preflightMutation.data.items} />
          <div className="soha-resource-create-submit">
            <Button
              disabled={!canExecute}
              icon={<CheckCircleOutlined />}
              loading={executeMutation.isPending}
              onClick={execute}
              type="primary"
            >
              {isChinese ? '确认创建' : 'Create resources'}
            </Button>
          </div>
        </section>
      ) : null}

      {executeMutation.data ? (
        <section className="soha-resource-create-section">
          <div className="soha-resource-create-section-heading">
            <Title level={5}>{isChinese ? '创建结果' : 'Creation result'}</Title>
            <Text type="secondary">Operation {executeMutation.data.operationId}</Text>
          </div>
          <ResourceCreateResultTable items={executeMutation.data.items} />
        </section>
      ) : null}
    </div>
  )
}

function StatusSummary({ ready }: { ready: boolean }) {
  const { localeCode } = useI18n()
  return (
    <Text type={ready ? 'success' : 'danger'}>
      {ready
        ? localeCode === 'zh_CN'
          ? '全部通过'
          : 'Ready'
        : localeCode === 'zh_CN'
          ? '存在阻止项'
          : 'Blocked'}
    </Text>
  )
}

export function CreateShell(props: CreateShellProps) {
  const { localeCode } = useI18n()
  const title =
    props.title ??
    (localeCode === 'zh_CN'
      ? `新增${props.label ? ` ${props.label}` : ' Kubernetes 资源'}`
      : `Create${props.label ? ` ${props.label}` : ' Kubernetes resources'}`)
  if (props.presentation === 'page') {
    return <ShellBody {...props} visible />
  }
  return (
    <Modal
      destroyOnHidden
      footer={null}
      mask={{ closable: false }}
      onCancel={props.onClose}
      open={props.open}
      styles={{ body: { maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' } }}
      title={title}
      width="min(1120px, calc(100vw - 32px))"
    >
      <ShellBody {...props} visible={Boolean(props.open)} />
    </Modal>
  )
}
