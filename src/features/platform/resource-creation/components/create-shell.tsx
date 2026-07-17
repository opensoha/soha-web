import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Alert, App, Button, Drawer, Modal, Segmented, Select, Spin, Typography } from 'antd'
import { CheckCircleOutlined, FileTextOutlined, FormOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import { resourceCreationMutations } from '../mutations'
import { isPreflightCurrent } from '../model'
import { resourceCreationQueries } from '../queries'
import { hasResourceCreateForm, loadResourceCreateForm } from '../registry'
import type { ResourceFormDefinition } from '../forms'
import type { ResourceCreateContext, ResourceCreateResult, ResourceCreateSource } from '../types'
import { ResourceCreateResultTable } from './result-table'
import { ResourceCreateScopeSummary } from './scope-summary'
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
  readonly presentation?: 'drawer' | 'modal' | 'page'
  readonly formSupported?: boolean
  readonly title?: ReactNode
}

function createRequest(context: ResourceCreateContext, content: string, mode: 'form' | 'yaml') {
  const source: ResourceCreateSource = mode === 'form' ? 'form' : context.source
  return {
    source,
    ...(context.defaultNamespace ? { defaultNamespace: context.defaultNamespace } : {}),
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
  const [defaultNamespace, setDefaultNamespace] = useState(initialContext.defaultNamespace || '')
  const [preflightContent, setPreflightContent] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
  const namespacesQuery = useQuery(resourceCreationQueries.namespaces(initialContext.clusterId))
  const preflightMutation = useMutation(resourceCreationMutations.preflight())
  const executeMutation = useMutation(resourceCreationMutations.execute(queryClient))
  const registryManifest = useMemo(() => {
    if (!formDefinition || formValues == null) return ''
    return JSON.stringify(formDefinition.buildManifest(formValues), null, 2)
  }, [formDefinition, formValues])
  const content = mode === 'form' ? form?.manifest || registryManifest : draft
  const context = useMemo(
    () => ({ ...initialContext, defaultNamespace: defaultNamespace || undefined }),
    [defaultNamespace, initialContext],
  )
  const request = useMemo(() => createRequest(context, content, mode), [content, context, mode])
  const namespaceRequired =
    initialContext.scopeMode === 'namespace' &&
    initialContext.source !== 'global_yaml' &&
    !defaultNamespace
  const preflightCurrent = isPreflightCurrent(content, preflightContent, preflightMutation.data)
  const canExecute = Boolean(preflightCurrent && preflightMutation.data?.ready)

  useEffect(() => {
    if (!visible) return
    setMode(form || registryFormSupported ? initialMode : 'yaml')
    setDraft(defaultTemplate)
    setDefaultNamespace(initialContext.defaultNamespace || '')
    setPreflightContent(null)
    setIdempotencyKey(null)
    preflightMutation.reset()
    executeMutation.reset()
  }, [
    defaultTemplate,
    form,
    initialContext.defaultNamespace,
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
      setFormValues(definition.defaultValues({ namespace: defaultNamespace || null }))
    })
    return () => {
      cancelled = true
    }
  }, [defaultNamespace, form, initialContext.expectedKind, registryFormSupported, visible])

  function invalidatePreflight() {
    setPreflightContent(null)
    setIdempotencyKey(null)
    preflightMutation.reset()
    executeMutation.reset()
  }

  function runPreflight() {
    setPreflightContent(null)
    preflightMutation.mutate(
      { clusterId: context.clusterId, request },
      {
        onSuccess: () => {
          setPreflightContent(content)
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
      <div className="soha-resource-create-toolbar">
        {form || registryFormSupported ? (
          <Segmented
            options={[
              { icon: <FormOutlined />, label: isChinese ? '表单创建' : 'Form', value: 'form' },
              { icon: <FileTextOutlined />, label: 'YAML', value: 'yaml' },
            ]}
            onChange={(value) => {
              setMode(value as 'form' | 'yaml')
              invalidatePreflight()
            }}
            value={mode}
          />
        ) : (
          <Text strong>{isChinese ? 'YAML 创建' : 'Create from YAML'}</Text>
        )}
        {initialContext.scopeMode !== 'cluster' ? (
          <Select
            allowClear={initialContext.source === 'global_yaml'}
            aria-label={isChinese ? '默认命名空间' : 'Default namespace'}
            loading={namespacesQuery.isLoading}
            onChange={(value) => {
              setDefaultNamespace(value || '')
              invalidatePreflight()
            }}
            options={(namespacesQuery.data ?? []).map((item) => ({
              label: item.name,
              value: item.name,
            }))}
            placeholder={isChinese ? '选择默认命名空间' : 'Select default namespace'}
            showSearch={{ optionFilterProp: 'label' }}
            value={defaultNamespace || undefined}
          />
        ) : null}
      </div>

      <ResourceCreateScopeSummary context={context} />

      {initialContext.source === 'global_yaml' ? (
        <Alert
          showIcon
          title={
            isChinese
              ? 'YAML 显式 namespace 优先；未填写时使用默认命名空间。每个文档会独立鉴权。'
              : 'Explicit YAML namespaces take precedence; omitted values use the default. Every document is authorized independently.'
          }
          type="info"
        />
      ) : (
        <Alert
          showIcon
          title={
            initialContext.scopeMode === 'cluster'
              ? isChinese
                ? '集群级资源中的 metadata.namespace 会被移除并产生提示。'
                : 'metadata.namespace is removed from cluster-scoped resources with a warning.'
              : isChinese
                ? '列表创建只允许当前命名空间；YAML 中的其他 namespace 会在预检中被拒绝。'
                : 'List creation is restricted to the current namespace; a different YAML namespace is rejected during preflight.'
          }
          type="info"
        />
      )}

      {mode === 'form' && (form || registryFormSupported) ? (
        <div className="soha-resource-create-form">
          {form?.content ??
            (formDefinition && formValues != null ? (
              formDefinition.renderForm({
                cancelText: isChinese ? '切换到 YAML' : 'Switch to YAML',
                loading: preflightMutation.isPending,
                localeCode,
                onCancel: () => setMode('yaml'),
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
  const presentation = props.presentation ?? 'drawer'
  const title =
    props.title ??
    (localeCode === 'zh_CN'
      ? `新增${props.label ? ` ${props.label}` : ' Kubernetes 资源'}`
      : `Create${props.label ? ` ${props.label}` : ' Kubernetes resources'}`)
  if (presentation === 'page') {
    return <ShellBody {...props} visible />
  }
  if (presentation === 'modal') {
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
  return (
    <Drawer
      destroyOnHidden
      mask={{ closable: false }}
      onClose={props.onClose}
      open={props.open}
      size="min(1120px, 92vw)"
      title={title}
    >
      <ShellBody {...props} visible={Boolean(props.open)} />
    </Drawer>
  )
}
