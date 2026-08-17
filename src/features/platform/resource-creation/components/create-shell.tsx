import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, App, Button, Modal, Spin, Tabs, Typography } from 'antd'
import { CheckCircleOutlined, FileTextOutlined, FormOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { clusterQueries } from '@/features/platform/clusters/queries'
import { useI18n } from '@/i18n'
import { createUUID } from '@/utils/uuid'
import { resourceCreationMutations } from '../mutations'
import { resourceCreationQueries } from '../queries'
import {
  buildResourceCreateRequest,
  isPreflightCurrent,
  resolveResourceCreateDefaultNamespace,
  resourceCreateRequestFingerprint,
} from '../model'
import { hasResourceCreateForm, loadResourceCreateForm } from '../registry'
import type { PreparedResourceManifest, ResourceFormDefinition } from '../forms'
import type { ResourceCreateContext, ResourceCreateResult } from '../types'
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
  const [preparedManifest, setPreparedManifest] = useState<PreparedResourceManifest | null>(null)
  const [preparationError, setPreparationError] = useState<string | null>(null)
  const [preparingManifest, setPreparingManifest] = useState(false)
  const formRevision = useRef(0)
  const [preflightRequestFingerprint, setPreflightRequestFingerprint] = useState<string | null>(
    null,
  )
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
  const clustersQuery = useQuery({
    ...clusterQueries.list(),
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
  const content =
    mode === 'form' ? (form?.manifest ?? preparedManifest?.content ?? registryManifest) : draft
  const context = initialContext
  const clusterName =
    clustersQuery.data?.find((cluster) => cluster.id === initialContext.clusterId)?.name || ''
  const defaultNamespace = resolveResourceCreateDefaultNamespace({
    contextNamespace: context.defaultNamespace,
    formNamespace: registryResource?.metadata.namespace,
    mode,
  })
  const request = useMemo(
    () => buildResourceCreateRequest(context, content, mode, defaultNamespace, preparedManifest),
    [content, context, defaultNamespace, mode, preparedManifest],
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
  const formBusy = preparingManifest || preflightMutation.isPending

  useEffect(() => {
    if (!visible) return
    setMode(form || registryFormSupported ? initialMode : 'yaml')
    setDraft(defaultTemplate)
    setPreparedManifest(null)
    setPreparationError(null)
    setPreparingManifest(false)
    formRevision.current += 1
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
        definition.defaultValues({
          clusterId: initialContext.clusterId,
          namespace: initialContext.defaultNamespace || null,
        }),
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
    formRevision.current += 1
    setPreparedManifest(null)
    setPreparationError(null)
    setPreparingManifest(false)
    setPreflightRequestFingerprint(null)
    setIdempotencyKey(null)
    preflightMutation.reset()
    executeMutation.reset()
  }

  async function runPreflight(submittedValues?: unknown) {
    const revision = formRevision.current
    setPreflightRequestFingerprint(null)
    setIdempotencyKey(null)
    setPreparationError(null)
    preflightMutation.reset()
    executeMutation.reset()

    let nextContent = content
    let nextDefaultNamespace = defaultNamespace
    let nextPreparedManifest = preparedManifest
    try {
      if (mode === 'form' && formDefinition && submittedValues != null) {
        const nextResource = formDefinition.buildManifest(submittedValues)
        nextDefaultNamespace = resolveResourceCreateDefaultNamespace({
          contextNamespace: context.defaultNamespace,
          formNamespace: nextResource.metadata.namespace,
          mode,
        })
        setFormValues(submittedValues)
        if (formDefinition.prepareManifest) {
          setPreparingManifest(true)
          nextPreparedManifest = await formDefinition.prepareManifest(submittedValues, {
            clusterId: context.clusterId,
            namespace: nextDefaultNamespace || null,
          })
          if (revision !== formRevision.current) return
          nextContent = nextPreparedManifest.content
          setPreparedManifest(nextPreparedManifest)
        } else {
          nextContent = JSON.stringify(nextResource, null, 2)
        }
      }
    } catch (error) {
      if (revision !== formRevision.current) return
      const detail = error instanceof Error ? error.message : String(error)
      setPreparationError(detail)
      void message.error(detail)
      return
    } finally {
      if (revision === formRevision.current) setPreparingManifest(false)
    }

    const nextRequest = buildResourceCreateRequest(
      context,
      nextContent,
      mode,
      nextDefaultNamespace,
      nextPreparedManifest,
    )
    const nextFingerprint = resourceCreateRequestFingerprint(context.clusterId, nextRequest)
    preflightMutation.mutate(
      { clusterId: context.clusterId, request: nextRequest },
      {
        onSuccess: () => {
          if (revision !== formRevision.current) return
          setPreflightRequestFingerprint(nextFingerprint)
          setIdempotencyKey(createUUID())
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
        idempotencyKey: idempotencyKey || createUUID(),
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
                clusterId: context.clusterId,
                loading: formBusy,
                localeCode,
                namespaceLoading: namespacesQuery.isLoading,
                namespaceOptions: (namespacesQuery.data ?? []).map((item) => item.name),
                onChange: (value) => {
                  setFormValues(value)
                  invalidatePreflight()
                },
                onSubmit: (values) => void runPreflight(values),
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
            applyDisabled={!content.trim() || namespaceRequired || formBusy}
            applyDisabledReason={
              namespaceRequired
                ? isChinese
                  ? '列表创建必须选择命名空间。'
                  : 'Select a namespace for list creation.'
                : undefined
            }
            applyLabel={isChinese ? '预检' : 'Preflight'}
            applying={formBusy}
            editorHeight={
              initialContext.source === 'global_yaml' ? 'min(44vh, 460px)' : 'min(46vh, 480px)'
            }
            onApply={() => void runPreflight()}
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
            loading={formBusy}
            onClick={() => void runPreflight()}
            type="primary"
          >
            {isChinese ? '生成 Manifest 并预检' : 'Build manifest and preflight'}
          </Button>
        </div>
      ) : null}

      {preparationError ? (
        <Alert
          description={preparationError}
          showIcon
          title={isChinese ? 'Manifest 生成失败' : 'Manifest generation failed'}
          type="error"
        />
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
