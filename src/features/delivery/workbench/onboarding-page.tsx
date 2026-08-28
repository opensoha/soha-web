import './styles.css'
import { useEffect, useState } from 'react'
import { DeleteOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  type FormInstance,
} from 'antd'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { scrollableModalBodyStyle, viewportModalStyle } from '@/components/modal-styles'
import { useAIGlobalAssistant } from '@/features/copilot'
import { ApplicationForm, type ApplicationCenterState } from '../application-center-model'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type {
  ApplicationServiceKind,
  DeliveryApplication,
  DeliveryBlueprint,
  DeliveryDraft,
  DeliveryDraftConfirmResult,
  DeliveryDraftInput,
  RenderedDeliverySpec,
} from '../types'

const { Text } = Typography

export type ApplicationEntryMode = 'quick' | 'manual' | 'ai'

interface OnboardingDraftFormValues {
  appGroup?: string
  appKey?: string
  appName?: string
  blueprintId?: string
  clusterId?: string
  defaultBranch?: string
  environmentKey?: string
  language?: string
  namespace?: string
  repositoryPath?: string
  repositoryUrl?: string
  services?: OnboardingServiceFormValues[]
}

interface OnboardingServiceFormValues {
  buildContextDir?: string
  dockerfilePath?: string
  key?: string
  name?: string
  serviceKind?: ApplicationServiceKind
  workloadName?: string
}

const SERVICE_KIND_OPTIONS = [
  { value: 'kubernetes_workload', label: 'Kubernetes 工作负载' },
  { value: 'helm_release', label: 'Helm Release' },
  { value: 'job', label: 'Job' },
  { value: 'external_service', label: '外部服务' },
]

function createOnboardingService(): OnboardingServiceFormValues {
  return { serviceKind: 'kubernetes_workload' }
}

function slugFrom(value: unknown, fallback: string) {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

function buildManualDeliveryDraftPayload(
  values: OnboardingDraftFormValues,
  blueprint?: DeliveryBlueprint,
): DeliveryDraftInput {
  const appKey = slugFrom(
    values.appKey || values.appName || blueprint?.applicationDraft?.key,
    'sample-app',
  )
  const appName = String(values.appName || blueprint?.applicationDraft?.name || appKey).trim()
  const defaultBranch = String(
    values.defaultBranch || blueprint?.applicationDraft?.defaultBranch || 'main',
  ).trim()
  const repositoryPath = String(
    values.repositoryPath || blueprint?.applicationDraft?.repositoryPath || '',
  ).trim()
  const repositoryUrl = String(
    values.repositoryUrl ||
      blueprint?.applicationDraft?.metadata?.repositoryURL ||
      blueprint?.buildSources?.[0]?.config?.repositoryURL ||
      '',
  ).trim()
  const buildSourceId = blueprint?.buildSources?.[0]?.id || 'source-1'
  const environmentKey = String(
    values.environmentKey || blueprint?.environmentBindings?.[0]?.environmentKey || 'dev',
  ).trim()
  const clusterId = String(values.clusterId || '').trim()
  const namespace = String(values.namespace || '').trim()
  const serviceValues = values.services?.length ? values.services : [createOnboardingService()]
  const services = serviceValues.map((service, index) => {
    const serviceKey = slugFrom(service.key || service.name, `service-${index + 1}`)
    return {
      key: serviceKey,
      name: String(service.name || serviceKey).trim(),
      serviceKind: service.serviceKind || 'kubernetes_workload',
      repositoryPath: repositoryPath || undefined,
      defaultBranch,
      buildSourceId,
      enabled: true,
      metadata: {},
      containers: [
        {
          name: serviceKey,
          imageRepository: '',
          dockerfilePath:
            String(service.dockerfilePath || '').trim() ||
            blueprint?.applicationDraft?.dockerfilePath ||
            'Dockerfile',
          buildContextDir:
            String(service.buildContextDir || '').trim() ||
            blueprint?.applicationDraft?.buildContextDir ||
            '.',
          metadata: {},
        },
      ],
    }
  })
  const buildSources = blueprint?.buildSources?.length
    ? blueprint.buildSources.map((source, index) =>
        index === 0 && repositoryUrl
          ? { ...source, config: { ...source.config, repositoryURL: repositoryUrl } }
          : source,
      )
    : [
        {
          id: buildSourceId,
          name: 'Repo Dockerfile',
          type: 'repo_dockerfile' as const,
          enabled: true,
          isDefault: true,
          config: {
            contextDir: blueprint?.applicationDraft?.buildContextDir || '.',
            dockerfilePath: blueprint?.applicationDraft?.dockerfilePath || 'Dockerfile',
            ...(repositoryUrl ? { repositoryURL: repositoryUrl } : {}),
          },
        },
      ]

  return {
    source: blueprint ? 'blueprint' : 'manual',
    applicationDraft: {
      ...(blueprint?.applicationDraft ?? {}),
      name: appName,
      key: appKey,
      group: String(values.appGroup || blueprint?.applicationDraft?.group || 'default').trim(),
      language: String(values.language || blueprint?.applicationDraft?.language || 'go').trim(),
      repositoryPath: repositoryPath || undefined,
      defaultBranch,
      enabled: true,
      metadata: {
        ...(blueprint?.applicationDraft?.metadata ?? {}),
        ...(repositoryUrl ? { repositoryURL: repositoryUrl } : {}),
      },
    },
    services,
    buildSources,
    environmentBindings: [
      {
        ...(blueprint?.environmentBindings?.[0] ?? {}),
        environmentKey,
        buildPolicy: {
          ...(blueprint?.environmentBindings?.[0]?.buildPolicy ?? {}),
          sourceId: buildSourceId,
          refType: 'branch',
          refValue: defaultBranch,
        },
        releasePolicy: {
          ...(blueprint?.environmentBindings?.[0]?.releasePolicy ?? {}),
          actionKind: 'deploy',
          requiresApproval:
            blueprint?.environmentBindings?.[0]?.releasePolicy?.requiresApproval ?? false,
          verificationMode: 'workflow',
        },
        targets:
          clusterId && namespace
            ? services.flatMap((service, index) =>
                service.serviceKind === 'external_service'
                  ? []
                  : [
                      {
                        id: `target-${index + 1}`,
                        clusterId,
                        namespace,
                        workloadKind: service.serviceKind === 'job' ? 'Job' : 'Deployment',
                        workloadName:
                          String(serviceValues[index]?.workloadName || '').trim() || service.key,
                        containerName: service.containers?.[0]?.name || service.key,
                        enabled: true,
                      },
                    ],
              )
            : (blueprint?.environmentBindings?.[0]?.targets ?? []),
      },
    ],
    files: blueprint?.files ?? [],
    executionHints: {
      ...(blueprint?.executionHints ?? {}),
      onboardingMode: 'manual',
    },
    postCreateActions: blueprint?.postCreateActions ?? ['render_spec', 'create_manifest_package'],
  }
}

function specFromDraft(draft: DeliveryDraft): RenderedDeliverySpec {
  return {
    applicationDraft: draft.applicationDraft,
    services: draft.services,
    buildSources: draft.buildSources,
    environmentBindings: draft.environmentBindings,
    files: draft.files,
    executionHints: draft.executionHints,
    postCreateActions: draft.postCreateActions,
  }
}

function DeliveryDraftPreview({ spec }: { spec: RenderedDeliverySpec }) {
  return (
    <div className="soha-delivery-draft-preview">
      <Card size="small" title="应用档案">
        <Space orientation="vertical" size={2}>
          <Text strong>{spec.applicationDraft?.name || '-'}</Text>
          <Text type="secondary">
            {spec.applicationDraft?.key || '-'} / {spec.applicationDraft?.group || '-'}
          </Text>
          <Text type="secondary">
            {spec.applicationDraft?.repositoryPath ||
              spec.applicationDraft?.repositoryProjectId ||
              '未填写仓库'}
          </Text>
        </Space>
      </Card>
      <Card size="small" title="服务组件">
        <Space size={6} wrap>
          {(spec.services ?? []).map((service) => (
            <Tag key={service.key}>{service.name || service.key}</Tag>
          ))}
        </Space>
      </Card>
      <Card size="small" title="构建源">
        <Space size={6} wrap>
          {(spec.buildSources ?? []).map((source) => (
            <Tag key={source.id}>{source.name || source.type}</Tag>
          ))}
        </Space>
      </Card>
      <Card size="small" title="环境绑定">
        <Space size={6} wrap>
          {(spec.environmentBindings ?? []).map((binding, index) => (
            <Tag key={`${binding.environmentId || binding.environmentKey || index}`}>
              {binding.environmentKey || binding.environmentId || '未映射环境'}
            </Tag>
          ))}
        </Space>
      </Card>
      <Card size="small" title="规范文件">
        <Space size={6} wrap>
          {(spec.files ?? []).map((file) => (
            <Tag key={file.path}>
              {file.kind}: {file.path}
            </Tag>
          ))}
          {(spec.files?.length ?? 0) === 0 ? (
            <Text type="secondary">未附带规范文件草稿</Text>
          ) : null}
        </Space>
      </Card>
    </div>
  )
}

function ManualOnboardingForm({
  blueprints,
  form,
  loading,
  onCancel,
  onFinish,
  selectedBlueprint,
}: {
  blueprints: DeliveryBlueprint[]
  form: FormInstance<OnboardingDraftFormValues>
  loading: boolean
  onCancel: () => void
  onFinish: (values: OnboardingDraftFormValues) => void
  selectedBlueprint?: DeliveryBlueprint
}) {
  return (
    <Form
      clearOnDestroy
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{
        appGroup: 'default',
        language: 'go',
        defaultBranch: 'main',
        environmentKey: 'dev',
        services: [createOnboardingService()],
      }}
    >
      <div className="soha-delivery-onboarding-form-grid">
        <Form.Item label="接入模板" name="blueprintId">
          <Select
            allowClear
            placeholder="可选，未选择时使用手工默认规范"
            options={blueprints.map((item) => ({
              value: item.id,
              label: `${item.name} (${item.key})`,
            }))}
          />
        </Form.Item>
        <Form.Item
          label="应用名称"
          name="appName"
          rules={[{ required: true, message: '请输入应用名称' }]}
        >
          <Input placeholder={selectedBlueprint?.applicationDraft?.name || 'Demo API'} />
        </Form.Item>
        <Form.Item
          label="应用 Key"
          name="appKey"
          rules={[{ required: true, message: '请输入应用 Key' }]}
        >
          <Input placeholder={selectedBlueprint?.applicationDraft?.key || 'demo-api'} />
        </Form.Item>
        <Form.Item label="仓库路径" name="repositoryPath">
          <Input placeholder="group/project" />
        </Form.Item>
        <Form.Item
          label="仓库 Clone URL"
          name="repositoryUrl"
          rules={[
            { type: 'url', message: '请输入有效的 HTTP(S) URL' },
            { pattern: /^https?:\/\/\S+$/i, message: '仓库 URL 仅支持 HTTP(S)' },
          ]}
        >
          <Input placeholder="https://github.com/org/repository.git" />
        </Form.Item>
        <Form.Item
          label="环境 Key"
          name="environmentKey"
          rules={[{ required: true, message: '请输入环境 Key' }]}
        >
          <Input placeholder="dev" />
        </Form.Item>
      </div>
      <Collapse
        className="soha-delivery-onboarding-advanced soha-delivery-onboarding-advanced--application"
        ghost
        size="small"
        items={[
          {
            key: 'application-advanced',
            label: '高级应用与发布配置（可选）',
            forceRender: true,
            children: (
              <div className="soha-delivery-onboarding-form-grid">
                <Form.Item label="应用分组" name="appGroup">
                  <Input />
                </Form.Item>
                <Form.Item label="语言" name="language">
                  <Select
                    options={[
                      { value: 'go', label: 'Go' },
                      { value: 'node', label: 'Node.js' },
                      { value: 'java', label: 'Java' },
                      { value: 'python', label: 'Python' },
                      { value: 'other', label: 'Other' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="默认分支" name="defaultBranch">
                  <Input />
                </Form.Item>
                <Form.Item label="集群 ID" name="clusterId">
                  <Input placeholder="可选，填写后生成发布目标" />
                </Form.Item>
                <Form.Item label="命名空间" name="namespace">
                  <Input placeholder="可选" />
                </Form.Item>
              </div>
            ),
          },
        ]}
      />
      <Form.List
        name="services"
        rules={[
          {
            validator: async (_, services) => {
              if (!services?.length) throw new Error('至少配置一个服务组件')
              const keys = services
                .map((service: OnboardingServiceFormValues) => String(service?.key ?? '').trim())
                .filter(Boolean)
              if (new Set(keys).size !== keys.length) throw new Error('服务 Key 不能重复')
            },
          },
        ]}
      >
        {(fields, { add, remove }, { errors }) => (
          <div className="soha-delivery-onboarding-services">
            <div className="soha-delivery-onboarding-services__toolbar">
              <div>
                <Text strong>服务组件</Text>
                <Text type="secondary">每个服务独立生成组件、容器和发布目标。</Text>
              </div>
              <Button icon={<PlusOutlined />} onClick={() => add(createOnboardingService())}>
                添加服务
              </Button>
            </div>
            {fields.map((field, index) => (
              <div className="soha-delivery-onboarding-service" key={field.key}>
                <div className="soha-delivery-onboarding-service__head">
                  <Text strong>{`服务 ${index + 1}`}</Text>
                  <Button
                    danger
                    disabled={fields.length === 1}
                    icon={<DeleteOutlined />}
                    onClick={() => remove(field.name)}
                  >
                    删除
                  </Button>
                </div>
                <div className="soha-delivery-onboarding-form-grid">
                  <Form.Item
                    label="服务名称"
                    name={[field.name, 'name']}
                    rules={[{ required: true, message: '请输入服务名称' }]}
                  >
                    <Input placeholder="API" />
                  </Form.Item>
                  <Form.Item
                    label="服务 Key"
                    name={[field.name, 'key']}
                    rules={[{ required: true, message: '请输入服务 Key' }]}
                  >
                    <Input placeholder="api" />
                  </Form.Item>
                  <Form.Item label="服务类型" name={[field.name, 'serviceKind']}>
                    <Select options={SERVICE_KIND_OPTIONS} />
                  </Form.Item>
                </div>
                <Collapse
                  className="soha-delivery-onboarding-advanced"
                  ghost
                  size="small"
                  items={[
                    {
                      key: 'service-advanced',
                      label: '高级构建与工作负载配置（可选）',
                      forceRender: true,
                      children: (
                        <div className="soha-delivery-onboarding-form-grid">
                          <Form.Item label="工作负载" name={[field.name, 'workloadName']}>
                            <Input placeholder="可选，默认使用服务 Key" />
                          </Form.Item>
                          <Form.Item label="Dockerfile" name={[field.name, 'dockerfilePath']}>
                            <Input placeholder="Dockerfile" />
                          </Form.Item>
                          <Form.Item label="构建目录" name={[field.name, 'buildContextDir']}>
                            <Input placeholder="." />
                          </Form.Item>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            ))}
            <Form.ErrorList errors={errors} />
          </div>
        )}
      </Form.List>
      <div className="soha-form-actions">
        <Button onClick={onCancel}>取消</Button>
        <Button htmlType="submit" type="primary" loading={loading}>
          生成草稿
        </Button>
      </div>
    </Form>
  )
}

export function ApplicationEntryModal({
  mode,
  onCancel,
  onModeChange,
  open,
  state,
  templateId,
}: {
  mode: ApplicationEntryMode
  onCancel: () => void
  onModeChange: (mode: ApplicationEntryMode) => void
  open: boolean
  state: ApplicationCenterState
  templateId?: string | null
}) {
  const { message } = App.useApp()
  const assistant = useAIGlobalAssistant()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<OnboardingDraftFormValues>()
  const [createdDraft, setCreatedDraft] = useState<DeliveryDraft | null>(null)
  const [confirmedResult, setConfirmedResult] = useState<DeliveryDraftConfirmResult | null>(null)
  const applicationsQuery = useQuery(deliveryQueries.applications.list())
  const blueprintsQuery = useQuery(deliveryQueries.blueprints.list())
  const createDraftMutation = useMutation(deliveryMutations.drafts.create(queryClient))
  const confirmDraftMutation = useMutation(deliveryMutations.drafts.confirm(queryClient))
  const blueprints = (blueprintsQuery.data ?? []).filter((item) => item.enabled)
  const selectedBlueprintId = Form.useWatch('blueprintId', form)
  const selectedBlueprint = selectedBlueprintId
    ? blueprints.find((item) => item.id === selectedBlueprintId)
    : undefined
  const canUseMode = mode === 'quick' ? state.canCreateApplication : state.canUpdateApplication

  useEffect(() => {
    if (templateId && blueprints.some((item) => item.id === templateId)) {
      form.setFieldValue('blueprintId', templateId)
    }
  }, [blueprints, form, templateId])

  useEffect(() => {
    if (!selectedBlueprint) return
    form.setFieldsValue({
      appName: selectedBlueprint.applicationDraft?.name ?? form.getFieldValue('appName'),
      appKey: selectedBlueprint.applicationDraft?.key ?? form.getFieldValue('appKey'),
      appGroup: selectedBlueprint.applicationDraft?.group ?? form.getFieldValue('appGroup'),
      language: selectedBlueprint.applicationDraft?.language ?? form.getFieldValue('language'),
      repositoryPath:
        selectedBlueprint.applicationDraft?.repositoryPath ?? form.getFieldValue('repositoryPath'),
      defaultBranch:
        selectedBlueprint.applicationDraft?.defaultBranch ?? form.getFieldValue('defaultBranch'),
      environmentKey:
        selectedBlueprint.environmentBindings?.[0]?.environmentKey ??
        form.getFieldValue('environmentKey'),
      services: selectedBlueprint.services?.length
        ? selectedBlueprint.services.map((service) => ({
            key: service.key,
            name: service.name,
            serviceKind: service.serviceKind,
            dockerfilePath: service.containers?.[0]?.dockerfilePath,
            buildContextDir: service.containers?.[0]?.buildContextDir,
          }))
        : [createOnboardingService()],
    })
  }, [form, selectedBlueprint])

  const close = () => {
    setCreatedDraft(null)
    setConfirmedResult(null)
    form.resetFields()
    onCancel()
  }

  const changeMode = (nextMode: ApplicationEntryMode) => {
    setCreatedDraft(null)
    setConfirmedResult(null)
    onModeChange(nextMode)
  }

  const handleCreateDraft = async (values: OnboardingDraftFormValues) => {
    try {
      const draft = await createDraftMutation.mutateAsync(
        buildManualDeliveryDraftPayload(values, selectedBlueprint),
      )
      setCreatedDraft(draft)
      setConfirmedResult(null)
      void message.success('DeliveryDraft 已生成')
    } catch (error) {
      if (error instanceof Error) void message.error(error.message)
    }
  }

  const handleConfirmDraft = async () => {
    if (!createdDraft) return
    try {
      const result = await confirmDraftMutation.mutateAsync(createdDraft.id)
      setConfirmedResult(result)
      setCreatedDraft(result.draft)
      void message.success('DeliveryDraft 已确认并创建交付对象')
    } catch (error) {
      if (error instanceof Error) void message.error(error.message)
    }
  }

  const handleStartAIOnboarding = () => {
    if (!assistant) {
      void message.error('AI 助手当前不可用')
      return
    }
    void assistant.launchAssistant({
      action: 'analyze-page',
      contextOverride: {
        sourceWorkbench: 'delivery',
        sourceTitle: '创建 / 接入应用',
        entityKind: 'delivery.application',
        pinnedData: {
          onboardingMode: 'ai',
          applicationCount: (applicationsQuery.data ?? []).length,
          enabledBlueprintCount: blueprints.length,
        },
        promptHint:
          '引导我接入已有应用仓库：先确认仓库 Clone URL、应用名称和目标环境，再分析服务、Dockerfile、Helm 或 Kubernetes 配置并生成 DeliveryDraft 草稿。不要直接创建或修改平台对象，必须等待预览确认。',
      },
    })
    close()
  }

  return (
    <Modal
      className="soha-delivery-onboarding-modal"
      title="创建 / 接入应用"
      open={open}
      onCancel={close}
      footer={null}
      destroyOnHidden
      width={mode === 'quick' ? 560 : mode === 'ai' ? 600 : 960}
      style={viewportModalStyle}
      styles={{ body: scrollableModalBodyStyle }}
    >
      {!createdDraft ? (
        <Segmented<ApplicationEntryMode>
          block
          value={mode}
          onChange={changeMode}
          options={[
            { label: '快速创建', value: 'quick', disabled: !state.canCreateApplication },
            { label: '手工接入', value: 'manual', disabled: !state.canUpdateApplication },
            { label: 'AI 接入', value: 'ai', disabled: !state.canUpdateApplication },
          ]}
        />
      ) : null}

      <div className="soha-delivery-onboarding-modal__content">
        {!canUseMode ? (
          <ManagementState
            bordered={false}
            compact
            kind="no-permission"
            title="无权使用此接入方式"
            description={
              mode === 'quick' ? '快速创建需要应用创建权限。' : '手工和 AI 接入需要应用更新权限。'
            }
          />
        ) : createdDraft ? (
          <>
            {confirmedResult ? (
              <Alert
                showIcon
                type="success"
                title="草稿已确认"
                description={`应用 ${confirmedResult.application.name} 已创建或更新，服务 ${confirmedResult.services?.length ?? 0} 个，环境绑定 ${confirmedResult.environmentBindings?.length ?? 0} 个。`}
              />
            ) : (
              <Alert
                showIcon
                type="warning"
                title="确认前不会创建或修改平台对象"
                description="请核对应用、服务、构建源、环境绑定和规范文件，确认后才会写入控制面。"
              />
            )}
            <DeliveryDraftPreview spec={specFromDraft(createdDraft)} />
            <div className="soha-form-actions">
              <Button onClick={close}>{confirmedResult ? '关闭' : '取消'}</Button>
              {confirmedResult ? (
                <Button
                  type="primary"
                  onClick={() => {
                    const applicationId = confirmedResult.application.id
                    close()
                    navigate(`/applications/${applicationId}`)
                  }}
                >
                  进入应用
                </Button>
              ) : (
                <Button
                  type="primary"
                  loading={confirmDraftMutation.isPending}
                  onClick={() => void handleConfirmDraft()}
                >
                  确认创建交付对象
                </Button>
              )}
            </div>
          </>
        ) : mode === 'quick' ? (
          <ApplicationForm
            application={null}
            state={state}
            onCancel={close}
            onCreated={(application: DeliveryApplication) => {
              close()
              navigate(`/applications/${application.id}`)
            }}
          />
        ) : mode === 'manual' ? (
          <ManualOnboardingForm
            blueprints={blueprints}
            form={form}
            loading={blueprintsQuery.isLoading || createDraftMutation.isPending}
            selectedBlueprint={selectedBlueprint}
            onCancel={close}
            onFinish={(values) => void handleCreateDraft(values)}
          />
        ) : (
          <Space orientation="vertical" size={12}>
            <Text strong>AI 接入服务</Text>
            <Text type="secondary">
              AI 将在全局助手中收集仓库与目标环境，分析服务并生成同一个 DeliveryDraft
              草稿；草稿仍需预览确认，不会直接写入控制面。
            </Text>
            <div className="soha-form-actions">
              <Button onClick={close}>取消</Button>
              <Button type="primary" icon={<RobotOutlined />} onClick={handleStartAIOnboarding}>
                开始 AI 接入
              </Button>
            </div>
          </Space>
        )}
      </div>
    </Modal>
  )
}

export function DeliveryOnboardingPage() {
  const [searchParams] = useSearchParams()
  const next = new URLSearchParams(searchParams)
  next.set('action', 'create')
  next.set('mode', next.get('mode') === 'ai' ? 'ai' : 'manual')
  return <Navigate replace to={{ pathname: '/applications', search: next.toString() }} />
}
