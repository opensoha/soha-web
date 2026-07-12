import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './styles.css'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ManagementIconButton,
  ManagementSearchableListPane,
  ManagementState,
  TemplateDesignerShell,
} from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { StatusTag } from '@/components/status-tag'
import {
  TemplateUsageImpactPanel,
  shouldConfirmTemplateUsageSave,
  templateUsageConfirmText,
} from '../template-usage-impact'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type { BlueprintBootstrapResult, DeliveryBlueprint, RenderedDeliverySpec } from '../types'
import { formatDateTime } from '@/utils/time'

const { Text } = Typography

const BUILD_SOURCE_TYPE_OPTIONS = [
  { value: 'repo_dockerfile', label: '仓库 Dockerfile' },
  { value: 'platform_build_template', label: '平台构建模板' },
  { value: 'external_pipeline', label: '外部流水线' },
]

const LANGUAGE_OPTIONS = [
  { value: 'go', label: 'Go' },
  { value: 'node', label: 'Node.js' },
  { value: 'java', label: 'Java' },
  { value: 'python', label: 'Python' },
  { value: 'other', label: 'Other' },
]

const REF_TYPE_OPTIONS = [
  { value: 'branch', label: 'branch' },
  { value: 'tag', label: 'tag' },
  { value: 'commit', label: 'commit' },
]

const IMAGE_TAG_MODE_OPTIONS = [
  { value: 'input', label: '手工输入' },
  { value: 'template', label: '模板生成' },
  { value: 'build_output', label: '构建输出' },
]

const ACTION_KIND_OPTIONS = [
  { value: 'deploy', label: 'deploy' },
  { value: 'release', label: 'release' },
]

const VERIFICATION_MODE_OPTIONS = [
  { value: 'workflow', label: '发布流程验证' },
  { value: 'none', label: '不运行验证' },
]

const FILE_KIND_OPTIONS = [
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'helm_values', label: 'Helm Values' },
  { value: 'deployment', label: 'Deployment' },
  { value: 'service', label: 'Service' },
  { value: 'readme', label: 'README' },
  { value: 'other', label: 'Other' },
]

type BlueprintFormValues = Record<string, unknown>

interface BlueprintListItem {
  applicationName: string
  bindingCount: number
  blueprint?: DeliveryBlueprint
  buildSourceCount: number
  description?: string
  enabled: boolean
  fileCount: number
  id: string
  isDraft?: boolean
  key: string
  name: string
  updatedAt?: string
}

function stringify(value: unknown, fallback: string) {
  if (value == null) return fallback
  return JSON.stringify(value, null, 2)
}

function trimString(value: unknown) {
  return String(value ?? '').trim()
}

function optionalString(value: unknown) {
  const text = trimString(value)
  return text || undefined
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== ''),
  )
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => trimString(item)).filter(Boolean)
  }
  return trimString(value)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function slugFrom(value: unknown, fallback: string) {
  const slug = trimString(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

function normalizeObjectArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : []
}

function parseJSONObject(raw: unknown, field: string) {
  const text = trimString(raw)
  if (!text) return {}
  const value = JSON.parse(text)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} 需要是 JSON 对象`)
  }
  return value as Record<string, unknown>
}

function parseJSONArray(raw: unknown, field: string) {
  const text = trimString(raw)
  if (!text) return []
  const value = JSON.parse(text)
  if (!Array.isArray(value)) {
    throw new Error(`${field} 需要是 JSON 数组`)
  }
  return value
}

function createDefaultBuildSource(index = 0) {
  return {
    id: `source-${index + 1}`,
    name: index === 0 ? '仓库 Dockerfile' : `构建源 ${index + 1}`,
    type: 'repo_dockerfile',
    enabled: true,
    isDefault: index === 0,
    buildImage: '',
    defaultTag: '',
    configText: '{\n  "contextDir": ".",\n  "dockerfilePath": "Dockerfile"\n}',
  }
}

function createDefaultEnvironmentBinding(index = 0) {
  return {
    environmentKey: index === 0 ? 'dev' : '',
    workflowTemplateId: '',
    buildSourceId: 'source-1',
    refType: 'branch',
    refValue: 'main',
    imageTagMode: 'input',
    imageTagTemplate: '',
    buildVariablesText: '{}',
    buildArgsText: '{}',
    actionKind: 'deploy',
    requiresApproval: false,
    approverRoles: [],
    autoRollback: true,
    rolloutTimeoutSeconds: 300,
    verificationMode: 'workflow',
    resourceSelectorText: '{}',
    targetsText: '[]',
  }
}

function createDefaultFileTemplate(index = 0) {
  return {
    path: index === 0 ? 'Dockerfile' : '',
    kind: index === 0 ? 'dockerfile' : 'other',
    purpose: index === 0 ? '平台规范 Dockerfile 草稿' : '',
    required: index === 0,
    content:
      index === 0
        ? 'FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci && npm run build\nCMD ["npm", "start"]\n'
        : '',
  }
}

function createBlueprintDraftValues(
  key = `app-template-${Date.now().toString(36)}`,
): BlueprintFormValues {
  return {
    key,
    name: '新建接入模板',
    description: '',
    enabled: true,
    appName: 'sample-app',
    appKey: 'sample-app',
    appGroup: 'default',
    businessLineId: '',
    language: 'go',
    appDescription: '',
    ownerTeam: '',
    repositoryProvider: 'git',
    repositoryProjectId: '',
    repositoryPath: '',
    defaultBranch: 'main',
    defaultTag: '',
    buildImage: '',
    buildContextDir: '.',
    dockerfilePath: 'Dockerfile',
    appEnabled: true,
    metadataText: '{}',
    buildSources: [createDefaultBuildSource()],
    environmentBindings: [createDefaultEnvironmentBinding()],
    files: [createDefaultFileTemplate()],
    executionHintsText: '{}',
    postCreateActions: ['render_spec'],
  }
}

function blueprintToFormValues(blueprint: DeliveryBlueprint): BlueprintFormValues {
  const draft = blueprint.applicationDraft ?? {}
  return {
    key: blueprint.key,
    name: blueprint.name,
    description: blueprint.description ?? '',
    enabled: blueprint.enabled,
    appName: draft.name ?? '',
    appKey: draft.key ?? '',
    appGroup: draft.group ?? 'default',
    businessLineId: draft.businessLineId ?? '',
    language: draft.language ?? 'go',
    appDescription: draft.description ?? '',
    ownerTeam: draft.ownerTeam ?? '',
    repositoryProvider: draft.repositoryProvider ?? 'git',
    repositoryProjectId: draft.repositoryProjectId ?? '',
    repositoryPath: draft.repositoryPath ?? '',
    defaultBranch: draft.defaultBranch ?? 'main',
    defaultTag: draft.defaultTag ?? '',
    buildImage: draft.buildImage ?? '',
    buildContextDir: draft.buildContextDir ?? '.',
    dockerfilePath: draft.dockerfilePath ?? 'Dockerfile',
    appEnabled: draft.enabled !== false,
    metadataText: stringify(draft.metadata ?? {}, '{}'),
    buildSources: (blueprint.buildSources ?? []).map((source) => ({
      id: source.id,
      name: source.name,
      type: source.type,
      enabled: source.enabled,
      isDefault: source.isDefault,
      buildImage: source.buildImage ?? '',
      defaultTag: source.defaultTag ?? '',
      configText: stringify(source.config ?? {}, '{}'),
    })),
    environmentBindings: (blueprint.environmentBindings ?? []).map((binding) => ({
      environmentId: binding.environmentId ?? '',
      environmentKey: binding.environmentKey ?? '',
      businessLineId: binding.businessLineId ?? '',
      strategyProfileId: binding.strategyProfileId ?? '',
      promotionPolicyId: binding.promotionPolicyId ?? '',
      artifactPolicyId: binding.artifactPolicyId ?? '',
      workflowTemplateId: binding.workflowTemplateId ?? '',
      buildSourceId: binding.buildPolicy?.sourceId ?? '',
      refType: binding.buildPolicy?.refType ?? 'branch',
      refValue: binding.buildPolicy?.refValue ?? 'main',
      imageTagMode: binding.buildPolicy?.imageTagMode ?? 'input',
      imageTagTemplate: binding.buildPolicy?.imageTagTemplate ?? '',
      buildVariablesText: stringify(binding.buildPolicy?.variables ?? {}, '{}'),
      buildArgsText: stringify(binding.buildPolicy?.buildArgs ?? {}, '{}'),
      actionKind: binding.releasePolicy?.actionKind ?? 'deploy',
      requiresApproval: binding.releasePolicy?.requiresApproval ?? false,
      approverRoles: binding.releasePolicy?.approverRoles ?? [],
      autoRollback: binding.releasePolicy?.autoRollback ?? true,
      rolloutTimeoutSeconds: binding.releasePolicy?.rolloutTimeoutSeconds ?? 300,
      verificationMode: binding.releasePolicy?.verificationMode ?? 'workflow',
      resourceSelectorText: stringify(binding.resourceSelector ?? {}, '{}'),
      targetsText: stringify(binding.targets ?? [], '[]'),
    })),
    files: (blueprint.files ?? []).map((file) => ({
      path: file.path,
      kind: file.kind,
      purpose: file.purpose ?? '',
      required: file.required,
      content: file.content ?? '',
    })),
    executionHintsText: stringify(blueprint.executionHints ?? {}, '{}'),
    postCreateActions: blueprint.postCreateActions ?? [],
  }
}

function buildBlueprintPayload(values: BlueprintFormValues, id?: string) {
  const buildSources = normalizeObjectArray(values.buildSources).map((source, index) =>
    compactRecord({
      id: optionalString(source.id) ?? slugFrom(source.name, `source-${index + 1}`),
      name: trimString(source.name) || `构建源 ${index + 1}`,
      type: trimString(source.type) || 'repo_dockerfile',
      enabled: source.enabled !== false,
      isDefault: Boolean(source.isDefault),
      buildImage: optionalString(source.buildImage),
      defaultTag: optionalString(source.defaultTag),
      config: parseJSONObject(source.configText, `构建源 ${index + 1} 配置`),
    }),
  )

  const environmentBindings = normalizeObjectArray(values.environmentBindings).map(
    (binding, index) =>
      compactRecord({
        environmentId: optionalString(binding.environmentId),
        environmentKey: optionalString(binding.environmentKey),
        businessLineId: optionalString(binding.businessLineId),
        strategyProfileId: optionalString(binding.strategyProfileId),
        promotionPolicyId: optionalString(binding.promotionPolicyId),
        artifactPolicyId: optionalString(binding.artifactPolicyId),
        workflowTemplateId: optionalString(binding.workflowTemplateId),
        buildPolicy: compactRecord({
          sourceId: optionalString(binding.buildSourceId),
          refType: trimString(binding.refType) || 'branch',
          refValue: optionalString(binding.refValue),
          imageTagMode: trimString(binding.imageTagMode) || 'input',
          imageTagTemplate: optionalString(binding.imageTagTemplate),
          variables: parseJSONObject(binding.buildVariablesText, `环境绑定 ${index + 1} 构建变量`),
          buildArgs: parseJSONObject(binding.buildArgsText, `环境绑定 ${index + 1} 构建参数`),
        }),
        releasePolicy: compactRecord({
          actionKind: trimString(binding.actionKind) || 'deploy',
          requiresApproval: Boolean(binding.requiresApproval),
          approverRoles: normalizeTags(binding.approverRoles),
          autoRollback: Boolean(binding.autoRollback),
          rolloutTimeoutSeconds: Number(binding.rolloutTimeoutSeconds || 300),
          verificationMode: trimString(binding.verificationMode) || 'workflow',
        }),
        resourceSelector: parseJSONObject(
          binding.resourceSelectorText,
          `环境绑定 ${index + 1} 资源选择器`,
        ),
        targets: parseJSONArray(binding.targetsText, `环境绑定 ${index + 1} 发布目标`),
      }),
  )

  const files = normalizeObjectArray(values.files).map((file, index) =>
    compactRecord({
      path: trimString(file.path) || `template-${index + 1}.yaml`,
      kind: trimString(file.kind) || 'other',
      content: String(file.content ?? ''),
      required: file.required !== false,
      purpose: optionalString(file.purpose),
    }),
  )

  return compactRecord({
    id,
    key: trimString(values.key),
    name: trimString(values.name),
    description: optionalString(values.description),
    applicationDraft: compactRecord({
      name: trimString(values.appName),
      key: trimString(values.appKey),
      group: trimString(values.appGroup) || 'default',
      businessLineId: optionalString(values.businessLineId),
      language: trimString(values.language) || 'go',
      description: optionalString(values.appDescription),
      ownerTeam: optionalString(values.ownerTeam),
      repositoryProvider: optionalString(values.repositoryProvider),
      repositoryProjectId: optionalString(values.repositoryProjectId),
      repositoryPath: optionalString(values.repositoryPath),
      defaultBranch: optionalString(values.defaultBranch),
      defaultTag: optionalString(values.defaultTag),
      buildImage: optionalString(values.buildImage),
      buildContextDir: optionalString(values.buildContextDir),
      dockerfilePath: optionalString(values.dockerfilePath),
      enabled: values.appEnabled !== false,
      metadata: parseJSONObject(values.metadataText, '应用元数据'),
    }),
    buildSources,
    environmentBindings,
    files,
    executionHints: parseJSONObject(values.executionHintsText, '执行提示'),
    postCreateActions: normalizeTags(values.postCreateActions),
    enabled: values.enabled !== false,
  })
}

function createListItemFromForm(values: BlueprintFormValues, isDraft: boolean): BlueprintListItem {
  return {
    id: isDraft ? 'new' : trimString(values.id),
    key: trimString(values.key) || 'new-app-template',
    name: trimString(values.name) || '新建接入模板草稿',
    description: optionalString(values.description),
    enabled: values.enabled !== false,
    applicationName: trimString(values.appName) || trimString(values.appKey) || '-',
    buildSourceCount: normalizeObjectArray(values.buildSources).length,
    bindingCount: normalizeObjectArray(values.environmentBindings).length,
    fileCount: normalizeObjectArray(values.files).length,
    isDraft,
  }
}

function createListItemFromBlueprint(
  blueprint: DeliveryBlueprint,
  activeValues?: BlueprintFormValues,
): BlueprintListItem {
  if (activeValues) {
    return {
      ...createListItemFromForm({ ...activeValues, id: blueprint.id }, false),
      blueprint,
      updatedAt: blueprint.updatedAt,
    }
  }
  return {
    id: blueprint.id,
    key: blueprint.key,
    name: blueprint.name,
    description: blueprint.description,
    enabled: blueprint.enabled,
    applicationName: blueprint.applicationDraft?.name || blueprint.applicationDraft?.key || '-',
    buildSourceCount: blueprint.buildSources?.length ?? 0,
    bindingCount: blueprint.environmentBindings?.length ?? 0,
    fileCount: blueprint.files?.length ?? 0,
    updatedAt: blueprint.updatedAt,
    blueprint,
  }
}

export function DeliveryBlueprintsPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canManage = hasPermission(permissionSnapshotQuery.data?.data, 'delivery.application.update')
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm<BlueprintFormValues>()
  const [selectedBlueprintId, setSelectedBlueprintId] = useState('')
  const [searchText, setSearchText] = useState('')
  const [activeTabKey, setActiveTabKey] = useState('basic')
  const [isDirty, setIsDirty] = useState(false)
  const [formSnapshot, setFormSnapshot] = useState<BlueprintFormValues>({})
  const [specModalVisible, setSpecModalVisible] = useState(false)
  const [bootstrapModalVisible, setBootstrapModalVisible] = useState(false)
  const [renderedSpec, setRenderedSpec] = useState<RenderedDeliverySpec | null>(null)
  const [bootstrapResult, setBootstrapResult] = useState<BlueprintBootstrapResult | null>(null)
  const suppressFormChangeRef = useRef(false)

  const blueprintsQuery = useQuery(deliveryQueries.blueprints.list())
  const createMutation = useMutation(deliveryMutations.blueprints.create(queryClient))
  const updateMutation = useMutation(deliveryMutations.blueprints.update(queryClient))
  const renderMutation = useMutation(deliveryMutations.blueprints.renderSpec())
  const bootstrapMutation = useMutation(
    deliveryMutations.blueprints.bootstrapApplication(queryClient),
  )

  const blueprints = blueprintsQuery.data ?? []
  const selectedBlueprint =
    selectedBlueprintId && selectedBlueprintId !== 'new'
      ? (blueprints.find((item) => item.id === selectedBlueprintId) ?? null)
      : null
  const selectedBlueprintUsageQuery = useQuery(
    deliveryQueries.blueprints.usage(selectedBlueprint?.id ?? '', Boolean(selectedBlueprint?.id)),
  )
  const selectedBlueprintUsage = selectedBlueprintUsageQuery.data
  const isNewDraft = selectedBlueprintId === 'new'
  const hasSelection = isNewDraft || !!selectedBlueprint

  const updateSearchParam = useCallback(
    (blueprintId?: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (blueprintId) {
            next.set('templateId', blueprintId)
          } else {
            next.delete('templateId')
          }
          next.delete('blueprintId')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const confirmDiscardChanges = useCallback(() => {
    if (!isDirty) return true
    return window.confirm('当前接入模板有未保存更改，确认放弃？')
  }, [isDirty])

  const applyFormValues = useCallback(
    (values: BlueprintFormValues, dirtyAfterApply: boolean) => {
      suppressFormChangeRef.current = true
      setFormSnapshot(values)
      form.setFieldsValue(values)
      window.setTimeout(() => {
        suppressFormChangeRef.current = false
        setIsDirty(dirtyAfterApply)
      }, 0)
    },
    [form],
  )

  const loadBlueprint = useCallback(
    (
      blueprint: DeliveryBlueprint,
      options?: { dirtyAfterLoad?: boolean; formOverrides?: BlueprintFormValues; tabKey?: string },
    ) => {
      const values = {
        ...blueprintToFormValues(blueprint),
        ...options?.formOverrides,
      }
      setSelectedBlueprintId(blueprint.id)
      setActiveTabKey(options?.tabKey ?? 'basic')
      applyFormValues(values, Boolean(options?.dirtyAfterLoad))
      updateSearchParam(blueprint.id)
    },
    [applyFormValues, updateSearchParam],
  )

  useEffect(() => {
    if (!blueprints.length) return
    const queryBlueprintId = searchParams.get('templateId') || searchParams.get('blueprintId')
    const queryBlueprint = queryBlueprintId
      ? blueprints.find((item) => item.id === queryBlueprintId)
      : undefined
    if (queryBlueprint && queryBlueprint.id !== selectedBlueprintId && !isDirty) {
      loadBlueprint(queryBlueprint)
      return
    }
    if (!selectedBlueprintId) {
      loadBlueprint(queryBlueprint ?? blueprints[0])
    }
  }, [blueprints, isDirty, loadBlueprint, searchParams, selectedBlueprintId])

  useEffect(() => {
    if (!isDirty) return undefined
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  const previewState = useMemo(() => {
    if (!hasSelection) return { error: '', json: '' }
    try {
      return {
        error: '',
        json: JSON.stringify(buildBlueprintPayload(formSnapshot, selectedBlueprint?.id), null, 2),
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '模板预览生成失败',
        json: '',
      }
    }
  }, [formSnapshot, hasSelection, selectedBlueprint?.id])

  const listItems = useMemo(() => {
    const items = blueprints.map((blueprint) =>
      createListItemFromBlueprint(
        blueprint,
        blueprint.id === selectedBlueprintId ? formSnapshot : undefined,
      ),
    )
    if (isNewDraft) {
      return [createListItemFromForm(formSnapshot, true), ...items]
    }
    return items
  }, [blueprints, formSnapshot, isNewDraft, selectedBlueprintId])

  const visibleListItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return listItems
    return listItems.filter((item) =>
      [item.name, item.key, item.description, item.applicationName].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(keyword),
      ),
    )
  }, [listItems, searchText])

  const handleNewBlueprint = () => {
    if (!confirmDiscardChanges()) return
    const values = createBlueprintDraftValues()
    setSelectedBlueprintId('new')
    setActiveTabKey('basic')
    applyFormValues(values, true)
    updateSearchParam()
  }

  const handleSelectListItem = (item: BlueprintListItem) => {
    if (item.id === selectedBlueprintId) return
    if (!confirmDiscardChanges()) return
    if (item.isDraft) {
      setSelectedBlueprintId('new')
      return
    }
    if (item.blueprint) {
      loadBlueprint(item.blueprint)
    }
  }

  const handleCancelChanges = () => {
    if (selectedBlueprint) {
      loadBlueprint(selectedBlueprint)
      return
    }
    const firstBlueprint = blueprints[0]
    if (firstBlueprint) {
      loadBlueprint(firstBlueprint)
      return
    }
    form.resetFields()
    setSelectedBlueprintId('')
    setFormSnapshot({})
    setIsDirty(false)
    updateSearchParam()
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = buildBlueprintPayload(values, selectedBlueprint?.id)
      if (selectedBlueprint) {
        const usageForSave =
          selectedBlueprintUsage ?? (await selectedBlueprintUsageQuery.refetch()).data
        if (
          shouldConfirmTemplateUsageSave(usageForSave) &&
          !window.confirm(templateUsageConfirmText(selectedBlueprint.name, usageForSave))
        ) {
          return
        }
        await updateMutation.mutateAsync({ id: selectedBlueprint.id, payload })
        void message.success('应用接入模板已更新')
        setFormSnapshot(values)
        setIsDirty(false)
        return
      }
      const createdBlueprint = await createMutation.mutateAsync(payload)
      void message.success('应用接入模板已创建')
      setFormSnapshot(values)
      setIsDirty(false)
      if (createdBlueprint?.id) {
        setSelectedBlueprintId(createdBlueprint.id)
        updateSearchParam(createdBlueprint.id)
      }
    } catch (error) {
      if (error instanceof Error) {
        void message.error(error.message)
      }
    }
  }

  const handleBlueprintEnabledChange = (item: BlueprintListItem, enabled: boolean) => {
    if (item.id !== selectedBlueprintId) {
      if (!confirmDiscardChanges()) return
      if (item.blueprint) {
        loadBlueprint(item.blueprint, {
          dirtyAfterLoad: true,
          formOverrides: { enabled },
          tabKey: 'basic',
        })
      }
      return
    }
    form.setFieldsValue({ enabled })
    setFormSnapshot((current) => ({ ...current, enabled }))
    setIsDirty(true)
  }

  const handleRenderSpec = () => {
    if (!selectedBlueprint) {
      void message.warning('请先保存模板，再渲染规范')
      return
    }
    renderMutation.mutate(selectedBlueprint.id, {
      onSuccess: (payload) => {
        setRenderedSpec(payload)
        setSpecModalVisible(true)
      },
      onError: (error) =>
        void message.error(error instanceof Error ? error.message : '渲染规范失败'),
    })
  }

  const handleBootstrap = () => {
    if (!selectedBlueprint) {
      void message.warning('请先保存模板，再执行平台接入')
      return
    }
    bootstrapMutation.mutate(selectedBlueprint.id, {
      onSuccess: (payload) => {
        setBootstrapResult(payload)
        setBootstrapModalVisible(true)
      },
      onError: (error) =>
        void message.error(error instanceof Error ? error.message : '平台接入失败'),
    })
  }

  const buildSourceOptions = normalizeObjectArray(formSnapshot.buildSources).map((item, index) => ({
    value: trimString(item.id) || `source-${index + 1}`,
    label: trimString(item.name) || `构建源 ${index + 1}`,
  }))

  const designerTabs = [
    {
      key: 'basic',
      label: '基础信息',
      children: (
        <div className="soha-delivery-blueprint-form-grid">
          <Form.Item
            name="key"
            label="模板 Key"
            rules={[{ required: true, message: '请输入模板 Key' }]}
          >
            <Input placeholder="node-service-standard" />
          </Form.Item>
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="Node 服务标准接入" />
          </Form.Item>
          <Form.Item
            className="soha-delivery-blueprint-switch-field"
            name="enabled"
            label="启用"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            className="soha-delivery-blueprint-form-grid__wide"
            name="description"
            label="说明"
          >
            <Input.TextArea rows={3} placeholder="适用语言、仓库形态、默认环境和平台规范说明" />
          </Form.Item>
          <Form.Item
            className="soha-delivery-blueprint-form-grid__wide"
            name="postCreateActions"
            label="接入后动作"
          >
            <Select
              mode="tags"
              tokenSeparators={[',', '\n']}
              options={[
                { value: 'render_spec', label: '渲染规范' },
                { value: 'bootstrap_application', label: '创建应用档案' },
                { value: 'create_environment_bindings', label: '创建环境绑定' },
              ]}
            />
          </Form.Item>
        </div>
      ),
    },
    {
      key: 'application',
      label: '应用档案',
      children: (
        <div className="soha-delivery-blueprint-form-grid">
          <Form.Item
            name="appName"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input placeholder="Sample API" />
          </Form.Item>
          <Form.Item
            name="appKey"
            label="应用 Key"
            rules={[{ required: true, message: '请输入应用 Key' }]}
          >
            <Input placeholder="sample-api" />
          </Form.Item>
          <Form.Item
            name="appGroup"
            label="应用分组"
            rules={[{ required: true, message: '请输入应用分组' }]}
          >
            <Input placeholder="mall / payment / frontend" />
          </Form.Item>
          <Form.Item name="language" label="语言">
            <Select options={LANGUAGE_OPTIONS} />
          </Form.Item>
          <Form.Item name="businessLineId" label="业务线 ID">
            <Input placeholder="business-line-id" />
          </Form.Item>
          <Form.Item name="ownerTeam" label="负责团队">
            <Input placeholder="payments-dev" />
          </Form.Item>
          <Form.Item name="repositoryProvider" label="代码源">
            <Input placeholder="gitlab / github / gitea" />
          </Form.Item>
          <Form.Item name="repositoryProjectId" label="仓库项目 ID">
            <Input placeholder="project-id" />
          </Form.Item>
          <Form.Item
            className="soha-delivery-blueprint-form-grid__wide"
            name="repositoryPath"
            label="仓库路径"
          >
            <Input placeholder="group/project/service" />
          </Form.Item>
          <Form.Item name="defaultBranch" label="默认分支">
            <Input placeholder="main" />
          </Form.Item>
          <Form.Item name="defaultTag" label="默认 Tag">
            <Input placeholder="v1.0.0" />
          </Form.Item>
          <Form.Item name="buildImage" label="构建镜像">
            <Input placeholder="golang:1.23 / node:22" />
          </Form.Item>
          <Form.Item name="buildContextDir" label="构建目录">
            <Input placeholder="." />
          </Form.Item>
          <Form.Item name="dockerfilePath" label="Dockerfile 路径">
            <Input placeholder="Dockerfile" />
          </Form.Item>
          <Form.Item
            className="soha-delivery-blueprint-switch-field"
            name="appEnabled"
            label="应用启用"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            className="soha-delivery-blueprint-form-grid__wide"
            name="appDescription"
            label="应用说明"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            className="soha-delivery-blueprint-form-grid__wide"
            name="metadataText"
            label="应用元数据(JSON)"
          >
            <Input.TextArea
              rows={5}
              spellCheck={false}
              placeholder='{"serviceKind":"kubernetes_workload"}'
            />
          </Form.Item>
        </div>
      ),
    },
    {
      key: 'build',
      label: '构建源',
      children: (
        <Form.List name="buildSources">
          {(fields, { add, remove }) => (
            <div className="soha-delivery-blueprint-repeat-list">
              <div className="soha-delivery-blueprint-repeat-list__toolbar">
                <Text type="secondary">定义应用创建后默认可选的构建来源。</Text>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => add(createDefaultBuildSource(fields.length))}
                >
                  添加构建源
                </Button>
              </div>
              {fields.length === 0 ? (
                <ManagementState
                  bordered={false}
                  compact
                  kind="empty"
                  title="暂无构建源"
                  description="至少添加一个构建源，才能形成可发布的应用接入规范。"
                />
              ) : null}
              {fields.map((field, index) => (
                <div className="soha-delivery-blueprint-repeat-item" key={field.key}>
                  <div className="soha-delivery-blueprint-repeat-item__head">
                    <strong>{`构建源 ${index + 1}`}</strong>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={() => remove(field.name)}
                    >
                      删除
                    </Button>
                  </div>
                  <div className="soha-delivery-blueprint-form-grid">
                    <Form.Item
                      name={[field.name, 'id']}
                      label="Source ID"
                      rules={[{ required: true, message: '请输入 Source ID' }]}
                    >
                      <Input placeholder="source-1" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'name']}
                      label="名称"
                      rules={[{ required: true, message: '请输入名称' }]}
                    >
                      <Input placeholder="Repo Dockerfile" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'type']} label="类型">
                      <Select options={BUILD_SOURCE_TYPE_OPTIONS} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'buildImage']} label="构建镜像">
                      <Input placeholder="node:22 / golang:1.23" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'defaultTag']} label="默认 Tag">
                      <Input placeholder="latest / {{branch}}-{{sha}}" />
                    </Form.Item>
                    <Form.Item
                      className="soha-delivery-blueprint-switch-field"
                      name={[field.name, 'enabled']}
                      label="启用"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      className="soha-delivery-blueprint-switch-field"
                      name={[field.name, 'isDefault']}
                      label="默认"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      className="soha-delivery-blueprint-form-grid__wide"
                      name={[field.name, 'configText']}
                      label="构建配置(JSON)"
                    >
                      <Input.TextArea
                        rows={5}
                        spellCheck={false}
                        placeholder='{"contextDir":".","dockerfilePath":"Dockerfile"}'
                      />
                    </Form.Item>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Form.List>
      ),
    },
    {
      key: 'environment',
      label: '环境绑定',
      children: (
        <Form.List name="environmentBindings">
          {(fields, { add, remove }) => (
            <div className="soha-delivery-blueprint-repeat-list">
              <div className="soha-delivery-blueprint-repeat-list__toolbar">
                <Text type="secondary">
                  定义接入后默认环境、发布流程、构建策略和目标资源选择方式。
                </Text>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => add(createDefaultEnvironmentBinding(fields.length))}
                >
                  添加环境绑定
                </Button>
              </div>
              {fields.length === 0 ? (
                <ManagementState
                  bordered={false}
                  compact
                  kind="empty"
                  title="暂无环境绑定"
                  description="可以先保存应用档案模板，后续再补环境绑定。"
                />
              ) : null}
              {fields.map((field, index) => (
                <div className="soha-delivery-blueprint-repeat-item" key={field.key}>
                  <div className="soha-delivery-blueprint-repeat-item__head">
                    <strong>{`环境绑定 ${index + 1}`}</strong>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={() => remove(field.name)}
                    >
                      删除
                    </Button>
                  </div>
                  <div className="soha-delivery-blueprint-form-grid">
                    <Form.Item name={[field.name, 'environmentKey']} label="环境 Key">
                      <Input placeholder="dev / test / prod" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'environmentId']} label="环境 ID">
                      <Input placeholder="env-id" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'businessLineId']} label="业务线 ID">
                      <Input />
                    </Form.Item>
                    <Form.Item name={[field.name, 'workflowTemplateId']} label="发布流程模板 ID">
                      <Input placeholder="workflow-template-id" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'strategyProfileId']} label="发布策略 Profile">
                      <Input placeholder="rolling-default" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'promotionPolicyId']} label="晋级策略">
                      <Input />
                    </Form.Item>
                    <Form.Item name={[field.name, 'artifactPolicyId']} label="制品策略">
                      <Input />
                    </Form.Item>
                    <Form.Item name={[field.name, 'buildSourceId']} label="构建来源">
                      <Select allowClear options={buildSourceOptions} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'refType']} label="引用类型">
                      <Select options={REF_TYPE_OPTIONS} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'refValue']} label="引用值">
                      <Input placeholder="main / v1.0.0" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'imageTagMode']} label="镜像 Tag 模式">
                      <Select options={IMAGE_TAG_MODE_OPTIONS} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'imageTagTemplate']} label="镜像 Tag 模板">
                      <Input placeholder="{{branch}}-{{timestamp}}" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'actionKind']} label="发布动作">
                      <Select options={ACTION_KIND_OPTIONS} />
                    </Form.Item>
                    <Form.Item
                      className="soha-delivery-blueprint-switch-field"
                      name={[field.name, 'requiresApproval']}
                      label="需要审批"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item name={[field.name, 'approverRoles']} label="审批角色">
                      <Select
                        mode="tags"
                        tokenSeparators={[',', '\n']}
                        placeholder="release-manager, ops-lead"
                      />
                    </Form.Item>
                    <Form.Item
                      className="soha-delivery-blueprint-switch-field"
                      name={[field.name, 'autoRollback']}
                      label="自动回滚"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item name={[field.name, 'rolloutTimeoutSeconds']} label="Rollout 超时">
                      <InputNumber min={30} step={30} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'verificationMode']} label="验证模式">
                      <Select options={VERIFICATION_MODE_OPTIONS} />
                    </Form.Item>
                    <Form.Item
                      className="soha-delivery-blueprint-form-grid__wide"
                      name={[field.name, 'buildVariablesText']}
                      label="构建变量(JSON)"
                    >
                      <Input.TextArea rows={4} spellCheck={false} />
                    </Form.Item>
                    <Form.Item
                      className="soha-delivery-blueprint-form-grid__wide"
                      name={[field.name, 'buildArgsText']}
                      label="构建参数(JSON)"
                    >
                      <Input.TextArea rows={4} spellCheck={false} />
                    </Form.Item>
                    <Form.Item
                      className="soha-delivery-blueprint-form-grid__wide"
                      name={[field.name, 'resourceSelectorText']}
                      label="资源选择器(JSON)"
                    >
                      <Input.TextArea
                        rows={4}
                        spellCheck={false}
                        placeholder='{"matchLabels":{"app":"sample"}}'
                      />
                    </Form.Item>
                    <Form.Item
                      className="soha-delivery-blueprint-form-grid__wide"
                      name={[field.name, 'targetsText']}
                      label="发布目标(JSON Array)"
                    >
                      <Input.TextArea
                        rows={5}
                        spellCheck={false}
                        placeholder='[{"clusterId":"dev","namespace":"default","workloadKind":"Deployment","workloadName":"sample"}]'
                      />
                    </Form.Item>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Form.List>
      ),
    },
    {
      key: 'files',
      label: '规范文件',
      children: (
        <Form.List name="files">
          {(fields, { add, remove }) => (
            <div className="soha-delivery-blueprint-repeat-list">
              <div className="soha-delivery-blueprint-repeat-list__toolbar">
                <Text type="secondary">维护 Dockerfile、Helm Values、Deployment 等规范草稿。</Text>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => add(createDefaultFileTemplate(fields.length))}
                >
                  添加文件模板
                </Button>
              </div>
              {fields.length === 0 ? (
                <ManagementState
                  bordered={false}
                  compact
                  kind="empty"
                  title="暂无规范文件"
                  description="模板可以只创建平台对象，也可以附带规范文件草稿。"
                />
              ) : null}
              {fields.map((field, index) => (
                <div className="soha-delivery-blueprint-repeat-item" key={field.key}>
                  <div className="soha-delivery-blueprint-repeat-item__head">
                    <strong>{`规范文件 ${index + 1}`}</strong>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={() => remove(field.name)}
                    >
                      删除
                    </Button>
                  </div>
                  <div className="soha-delivery-blueprint-form-grid">
                    <Form.Item
                      name={[field.name, 'path']}
                      label="路径"
                      rules={[{ required: true, message: '请输入文件路径' }]}
                    >
                      <Input placeholder="Dockerfile / deploy/values.yaml" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'kind']} label="类型">
                      <Select options={FILE_KIND_OPTIONS} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'purpose']} label="用途">
                      <Input placeholder="构建镜像 / Helm values / K8s deployment" />
                    </Form.Item>
                    <Form.Item
                      className="soha-delivery-blueprint-switch-field"
                      name={[field.name, 'required']}
                      label="必需"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      className="soha-delivery-blueprint-form-grid__wide"
                      name={[field.name, 'content']}
                      label="内容"
                    >
                      <Input.TextArea rows={10} spellCheck={false} />
                    </Form.Item>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Form.List>
      ),
    },
    {
      key: 'advanced',
      label: '高级预览',
      children: (
        <div className="soha-delivery-blueprint-advanced">
          <Form.Item name="executionHintsText" label="执行提示(JSON)">
            <Input.TextArea
              rows={5}
              spellCheck={false}
              placeholder='{"aiGatewaySkill":"delivery-developer"}'
            />
          </Form.Item>
          {previewState.error ? <Text type="danger">{previewState.error}</Text> : null}
          <pre className="soha-json-block soha-delivery-blueprint-json-preview">
            {previewState.error ? '请修正上方 JSON 字段后再查看完整 payload。' : previewState.json}
          </pre>
        </div>
      ),
    },
  ]

  const blueprintToolbar = (
    <>
      <Space wrap>
        <Button
          icon={<PlusOutlined />}
          type="primary"
          disabled={!canManage}
          onClick={handleNewBlueprint}
        >
          新建模板
        </Button>
        <Button
          icon={<SaveOutlined />}
          disabled={!hasSelection || !canManage}
          loading={createMutation.isPending || updateMutation.isPending}
          onClick={() => void handleSave()}
        >
          保存
        </Button>
        <Button disabled={!hasSelection || !isDirty} onClick={handleCancelChanges}>
          取消更改
        </Button>
        <Button
          icon={<EyeOutlined />}
          disabled={!hasSelection}
          loading={renderMutation.isPending}
          onClick={handleRenderSpec}
        >
          渲染规范
        </Button>
        <Button
          icon={<PlayCircleOutlined />}
          disabled={!hasSelection}
          loading={bootstrapMutation.isPending}
          onClick={handleBootstrap}
        >
          平台接入
        </Button>
      </Space>
      <Space wrap>
        {isDirty ? <Tag color="gold">未保存</Tag> : <Tag>已同步</Tag>}
        <Button
          icon={<ReloadOutlined />}
          loading={blueprintsQuery.isFetching}
          onClick={() => {
            if (confirmDiscardChanges()) void blueprintsQuery.refetch()
          }}
        >
          刷新
        </Button>
      </Space>
    </>
  )

  const blueprintList = (
    <ManagementSearchableListPane
      activeKey={selectedBlueprintId}
      className="soha-delivery-blueprint-list"
      emptyDescription="新建模板后，可在右侧维护应用档案、构建源、环境绑定和规范文件。"
      emptyTitle="暂无接入模板"
      getItemKey={(item) => item.id}
      isLoading={blueprintsQuery.isLoading}
      itemClassName="soha-delivery-blueprint-list__item"
      items={visibleListItems}
      searchPlaceholder="搜索接入模板"
      searchValue={searchText}
      onItemSelect={handleSelectListItem}
      onSearchChange={setSearchText}
      renderItem={(item) => (
        <>
          <span className="soha-delivery-blueprint-list__item-head">
            <span className="soha-delivery-blueprint-list__item-main">
              <strong>{item.name}</strong>
              <Text type="secondary">{item.key}</Text>
            </span>
            <span
              className="soha-delivery-blueprint-list__item-actions"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <Switch
                checked={item.enabled}
                disabled={!canManage}
                size="small"
                onChange={(checked) => handleBlueprintEnabledChange(item, checked)}
              />
              <ManagementIconButton
                aria-label="编辑模板"
                icon={<EditOutlined />}
                size="small"
                tooltip="编辑"
                onClick={() => {
                  handleSelectListItem(item)
                  setActiveTabKey('basic')
                }}
              />
            </span>
          </span>
          <span className="soha-delivery-blueprint-list__item-meta">
            <StatusTag value={item.enabled ? 'enabled' : 'disabled'} />
            <Tag>{`构建 ${item.buildSourceCount}`}</Tag>
            <Tag>{`环境 ${item.bindingCount}`}</Tag>
            <Tag>{`文件 ${item.fileCount}`}</Tag>
            {item.isDraft ? <Tag color="gold">草稿</Tag> : null}
          </span>
          <Text type="secondary" className="text-xs">
            {item.applicationName}
          </Text>
          <Text type="secondary" className="text-xs">
            {item.updatedAt ? formatDateTime(item.updatedAt) : '尚未保存'}
          </Text>
        </>
      )}
    />
  )

  const blueprintDesigner = hasSelection ? (
    <Form
      className="soha-delivery-blueprint-form"
      disabled={!canManage}
      form={form}
      layout="vertical"
      onValuesChange={(_changedValues, allValues) => {
        if (suppressFormChangeRef.current) return
        setFormSnapshot(allValues)
        setIsDirty(true)
      }}
    >
      <TemplateUsageImpactPanel
        loading={selectedBlueprintUsageQuery.isFetching && !!selectedBlueprint}
        onNavigate={navigate}
        usage={selectedBlueprintUsage}
      />
      <Tabs
        activeKey={activeTabKey}
        className="soha-delivery-blueprint-tabs"
        destroyOnHidden={false}
        items={designerTabs}
        onChange={setActiveTabKey}
      />
    </Form>
  ) : (
    <ManagementState
      bordered={false}
      kind="select-scope"
      title="选择或新建接入模板"
      description="左侧选择模板后，在右侧设计应用档案、构建源、环境绑定和规范文件。"
    />
  )

  return (
    <TemplateDesignerShell
      className="soha-page soha-delivery-blueprint-page"
      designer={blueprintDesigner}
      designerClassName="soha-delivery-blueprint-designer"
      list={blueprintList}
      toolbar={blueprintToolbar}
      toolbarClassName="soha-delivery-blueprint-toolbar"
      workspaceClassName="soha-delivery-blueprint-workspace"
    >
      <Modal
        width={960}
        title="渲染结果"
        open={specModalVisible}
        onCancel={() => setSpecModalVisible(false)}
        footer={null}
      >
        <pre className="soha-json-block">{JSON.stringify(renderedSpec ?? {}, null, 2)}</pre>
      </Modal>

      <Modal
        width={960}
        title="平台接入结果"
        open={bootstrapModalVisible}
        onCancel={() => setBootstrapModalVisible(false)}
        footer={null}
      >
        <pre className="soha-json-block">{JSON.stringify(bootstrapResult ?? {}, null, 2)}</pre>
      </Modal>
    </TemplateDesignerShell>
  )
}
