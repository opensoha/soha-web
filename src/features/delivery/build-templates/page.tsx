import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './styles.css'
import {
  App,
  Button,
  Form,
  Input,
  Popconfirm,
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
import { BooleanTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import {
  TemplateUsageImpactPanel,
  shouldConfirmTemplateUsageSave,
  templateUsageConfirmText,
} from '../template-usage-impact'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type { BuildTemplate } from '../types'

const { Text } = Typography

type JsonObject = Record<string, unknown>

export interface BuildTemplateFormValues {
  key?: string
  name?: string
  description?: string
  builderKind?: string
  dockerfileTemplate?: string
  buildCommandsText?: string
  variableSchemaText?: string
  defaultVariablesText?: string
  variables?: BuildTemplateVariableFormValue[]
  enabled?: boolean
}

export interface BuildTemplatePayload {
  key?: string
  name?: string
  description?: string
  builderKind?: string
  dockerfileTemplate?: string
  buildCommands: string[]
  variableSchema: JsonObject
  defaultVariables: JsonObject
  enabled?: boolean
}

export interface BuildTemplateVariableFormValue {
  key?: string
  label?: string
  type?: string
  required?: boolean
  defaultValue?: string
  description?: string
}

type BuildTemplateListItem = {
  builderKind?: string
  commandCount: number
  description?: string
  enabled: boolean
  id: string
  isDraft?: boolean
  key: string
  name: string
  template?: BuildTemplate
  updatedAt?: string
  variableCount: number
}

function parseJSONObject(raw: unknown, field: string): JsonObject {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid')
    }
    return parsed
  } catch {
    throw new Error(`${field} 需要是合法 JSON 对象`)
  }
}

function splitLines(raw: unknown) {
  return String(raw || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function trimFormString(raw: unknown) {
  return String(raw ?? '').trim()
}

function buildTemplateVariableSchema(variables: BuildTemplateVariableFormValue[] | undefined) {
  const schema: JsonObject = {}
  for (const item of variables ?? []) {
    const key = trimFormString(item.key)
    if (!key) continue
    schema[key] = {
      type: item.type || 'string',
      title: trimFormString(item.label) || key,
      description: trimFormString(item.description),
      required: Boolean(item.required),
    }
  }
  return schema
}

function buildTemplateDefaultVariables(variables: BuildTemplateVariableFormValue[] | undefined) {
  const defaults: JsonObject = {}
  for (const item of variables ?? []) {
    const key = trimFormString(item.key)
    if (!key) continue
    const raw = item.defaultValue
    if (raw === undefined || raw === '') continue
    if (item.type === 'number') {
      const parsed = Number(raw)
      defaults[key] = Number.isFinite(parsed) ? parsed : raw
      continue
    }
    if (item.type === 'boolean') {
      defaults[key] = raw === 'true'
      continue
    }
    defaults[key] = raw
  }
  return defaults
}

function extractBuildTemplateVariables(
  template: Pick<BuildTemplate, 'variableSchema' | 'defaultVariables'> | undefined,
): BuildTemplateVariableFormValue[] {
  if (
    !template?.variableSchema ||
    typeof template.variableSchema !== 'object' ||
    Array.isArray(template.variableSchema)
  )
    return []
  return Object.entries(template.variableSchema).map(([key, value]) => {
    const spec =
      value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
    const defaultValue = template.defaultVariables?.[key]
    return {
      key,
      label: String(spec.title || spec.label || key),
      type: String(spec.type || 'string'),
      required: Boolean(spec.required),
      defaultValue: defaultValue === undefined ? '' : String(defaultValue),
      description: String(spec.description || ''),
    }
  })
}

function defaultBuildTemplateValues(
  key = `build-template-${Date.now().toString(36)}`,
): BuildTemplateFormValues {
  return {
    key,
    name: '新建构建模板',
    description: '',
    builderKind: 'docker',
    dockerfileTemplate:
      'FROM node:22-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n',
    buildCommandsText: 'npm ci\nnpm run build',
    variableSchemaText: '{}',
    defaultVariablesText: '{}',
    variables: [
      {
        key: 'imageTag',
        label: '镜像 Tag',
        type: 'string',
        required: true,
        defaultValue: 'latest',
        description: '默认镜像标签',
      },
    ],
    enabled: true,
  }
}

function buildTemplateToFormValues(template: BuildTemplate): BuildTemplateFormValues {
  return {
    key: template.key,
    name: template.name,
    description: template.description ?? '',
    builderKind: template.builderKind ?? 'docker',
    dockerfileTemplate: template.dockerfileTemplate ?? '',
    buildCommandsText: (template.buildCommands ?? []).join('\n'),
    variableSchemaText: JSON.stringify(template.variableSchema ?? {}, null, 2),
    defaultVariablesText: JSON.stringify(template.defaultVariables ?? {}, null, 2),
    variables: extractBuildTemplateVariables(template),
    enabled: template.enabled,
  }
}

function buildBuildTemplatePayloadFromDesigner(
  values: BuildTemplateFormValues,
): BuildTemplatePayload {
  const variables = values.variables ?? []
  const hasStructuredVariables = variables.some((item) => trimFormString(item.key))
  return {
    key: values.key,
    name: values.name,
    description: values.description,
    builderKind: values.builderKind,
    dockerfileTemplate: values.dockerfileTemplate,
    buildCommands: splitLines(values.buildCommandsText),
    variableSchema: hasStructuredVariables
      ? buildTemplateVariableSchema(variables)
      : parseJSONObject(values.variableSchemaText, '变量 Schema'),
    defaultVariables: hasStructuredVariables
      ? buildTemplateDefaultVariables(variables)
      : parseJSONObject(values.defaultVariablesText, '默认变量'),
    enabled: values.enabled,
  }
}

export function buildBuildTemplatePayload(values: BuildTemplateFormValues): BuildTemplatePayload {
  return {
    key: values.key,
    name: values.name,
    description: values.description,
    builderKind: values.builderKind,
    dockerfileTemplate: values.dockerfileTemplate,
    buildCommands: splitLines(values.buildCommandsText),
    variableSchema: parseJSONObject(values.variableSchemaText, '变量 Schema'),
    defaultVariables: parseJSONObject(values.defaultVariablesText, '默认变量'),
    enabled: values.enabled,
  }
}

export function BuildTemplatesPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canManage = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.build-templates.manage',
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm<BuildTemplateFormValues>()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [searchText, setSearchText] = useState('')
  const [activeTabKey, setActiveTabKey] = useState('basic')
  const [isDirty, setIsDirty] = useState(false)
  const [formSnapshot, setFormSnapshot] = useState<BuildTemplateFormValues>({})
  const suppressFormChangeRef = useRef(false)

  const templatesQuery = useQuery(deliveryQueries.buildTemplates.list())
  const templates = templatesQuery.data ?? []
  const selectedTemplate =
    selectedTemplateId && selectedTemplateId !== 'new'
      ? (templates.find((item) => item.id === selectedTemplateId) ?? null)
      : null
  const selectedTemplateUsageQuery = useQuery(
    deliveryQueries.buildTemplates.usage(selectedTemplate?.id ?? '', Boolean(selectedTemplate?.id)),
  )
  const selectedTemplateUsage = selectedTemplateUsageQuery.data
  const isNewDraft = selectedTemplateId === 'new'
  const hasSelection = isNewDraft || !!selectedTemplate

  const createOptions = deliveryMutations.buildTemplates.create(queryClient)
  const createMutation = useMutation({
    ...createOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void createOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('构建模板创建成功')
    },
    onError: (err: Error) => message.error(err.message),
  })
  const updateOptions = deliveryMutations.buildTemplates.update(queryClient)
  const updateMutation = useMutation({
    ...updateOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void updateOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success('构建模板更新成功')
    },
    onError: (err: Error) => message.error(err.message),
  })
  const deleteOptions = deliveryMutations.buildTemplates.delete(queryClient)
  const deleteMutation = useMutation({
    ...deleteOptions,
    onSuccess: (result, deletedId, onMutateResult, context) => {
      void deleteOptions.onSuccess?.(result, deletedId, onMutateResult, context)
      message.success('构建模板已删除')
      if (selectedTemplateId === deletedId) {
        const nextTemplate = templates.find((item) => item.id !== deletedId)
        if (nextTemplate) {
          loadTemplate(nextTemplate)
        } else {
          form.resetFields()
          setSelectedTemplateId('')
          setFormSnapshot({})
          setIsDirty(false)
          updateTemplateSearchParam()
        }
      }
    },
    onError: (err: Error) => message.error(err.message),
  })

  const updateTemplateSearchParam = useCallback(
    (templateId?: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (templateId) {
            next.set('templateId', templateId)
          } else {
            next.delete('templateId')
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const confirmDiscardChanges = useCallback(() => {
    if (!isDirty) return true
    return window.confirm('当前构建模板有未保存更改，确认放弃？')
  }, [isDirty])

  const applyFormValues = useCallback(
    (values: BuildTemplateFormValues, dirtyAfterApply: boolean) => {
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

  const loadTemplate = useCallback(
    (
      template: BuildTemplate,
      options?: {
        dirtyAfterLoad?: boolean
        formOverrides?: BuildTemplateFormValues
        tabKey?: string
      },
    ) => {
      const values = {
        ...buildTemplateToFormValues(template),
        ...options?.formOverrides,
      }
      setSelectedTemplateId(template.id)
      setActiveTabKey(options?.tabKey ?? 'basic')
      applyFormValues(values, Boolean(options?.dirtyAfterLoad))
      updateTemplateSearchParam(template.id)
    },
    [applyFormValues, updateTemplateSearchParam],
  )

  useEffect(() => {
    if (!templates.length) return
    const queryTemplateId = searchParams.get('templateId')
    const queryTemplate = queryTemplateId
      ? templates.find((item) => item.id === queryTemplateId)
      : undefined
    if (queryTemplate && queryTemplate.id !== selectedTemplateId && !isDirty) {
      loadTemplate(queryTemplate)
      return
    }
    if (!selectedTemplateId) {
      loadTemplate(queryTemplate ?? templates[0])
    }
  }, [isDirty, loadTemplate, searchParams, selectedTemplateId, templates])

  useEffect(() => {
    if (!isDirty) return undefined
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  const listItems = useMemo<BuildTemplateListItem[]>(() => {
    const fromValues = (
      values: BuildTemplateFormValues,
      id: string,
      isDraft: boolean,
      template?: BuildTemplate,
    ): BuildTemplateListItem => ({
      id,
      key: values.key || 'new-build-template',
      name: values.name || '新建构建模板草稿',
      description: values.description,
      builderKind: values.builderKind || 'docker',
      commandCount: splitLines(values.buildCommandsText).length,
      variableCount: (values.variables ?? []).filter((item) => trimFormString(item.key)).length,
      enabled: values.enabled !== false,
      isDraft,
      template,
      updatedAt: template?.updatedAt,
    })
    const items = templates.map((template) => {
      if (template.id === selectedTemplateId) {
        return fromValues(formSnapshot, template.id, false, template)
      }
      return {
        id: template.id,
        key: template.key,
        name: template.name,
        description: template.description,
        builderKind: template.builderKind || 'docker',
        commandCount: template.buildCommands?.length ?? 0,
        variableCount: Object.keys(template.variableSchema ?? {}).length,
        enabled: template.enabled,
        template,
        updatedAt: template.updatedAt,
      }
    })
    if (isNewDraft) {
      return [fromValues(formSnapshot, 'new', true), ...items]
    }
    return items
  }, [formSnapshot, isNewDraft, selectedTemplateId, templates])

  const visibleListItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return listItems
    return listItems.filter((item) =>
      [item.name, item.key, item.description, item.builderKind].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(keyword),
      ),
    )
  }, [listItems, searchText])

  const previewState = useMemo(() => {
    if (!hasSelection) return { error: '', json: '' }
    try {
      return {
        error: '',
        json: JSON.stringify(buildBuildTemplatePayloadFromDesigner(formSnapshot), null, 2),
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '构建模板预览生成失败',
        json: '',
      }
    }
  }, [formSnapshot, hasSelection])

  const handleNewTemplate = () => {
    if (!confirmDiscardChanges()) return
    const values = defaultBuildTemplateValues()
    setSelectedTemplateId('new')
    setActiveTabKey('basic')
    applyFormValues(values, true)
    updateTemplateSearchParam()
  }

  const handleSelectListItem = (item: BuildTemplateListItem) => {
    if (item.id === selectedTemplateId) return
    if (!confirmDiscardChanges()) return
    if (item.isDraft) {
      setSelectedTemplateId('new')
      return
    }
    if (item.template) {
      loadTemplate(item.template)
    }
  }

  const handleCancelChanges = () => {
    if (selectedTemplate) {
      loadTemplate(selectedTemplate)
      return
    }
    const firstTemplate = templates[0]
    if (firstTemplate) {
      loadTemplate(firstTemplate)
      return
    }
    form.resetFields()
    setSelectedTemplateId('')
    setFormSnapshot({})
    setIsDirty(false)
    updateTemplateSearchParam()
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = buildBuildTemplatePayloadFromDesigner(values)
      if (selectedTemplate) {
        const usageForSave =
          selectedTemplateUsage ?? (await selectedTemplateUsageQuery.refetch()).data
        if (
          shouldConfirmTemplateUsageSave(usageForSave) &&
          !window.confirm(templateUsageConfirmText(selectedTemplate.name, usageForSave))
        ) {
          return
        }
        await updateMutation.mutateAsync({ id: selectedTemplate.id, payload })
        setFormSnapshot(values)
        setIsDirty(false)
        return
      }
      const createdTemplate = await createMutation.mutateAsync(payload)
      setFormSnapshot(values)
      setIsDirty(false)
      if (createdTemplate?.id) {
        setSelectedTemplateId(createdTemplate.id)
        updateTemplateSearchParam(createdTemplate.id)
      }
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    }
  }

  const handleTemplateEnabledChange = (item: BuildTemplateListItem, enabled: boolean) => {
    if (item.id !== selectedTemplateId) {
      if (!confirmDiscardChanges()) return
      if (item.template) {
        loadTemplate(item.template, {
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

  const designerTabs = [
    {
      key: 'basic',
      label: '基础信息',
      children: (
        <div className="soha-build-template-form-grid">
          <Form.Item
            name="key"
            label="模板 Key"
            rules={[{ required: true, message: '请输入模板 Key' }]}
          >
            <Input placeholder="docker-node" />
          </Form.Item>
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="Node Docker 标准构建" />
          </Form.Item>
          <Form.Item name="builderKind" label="Builder Kind">
            <Select
              options={[
                { value: 'docker', label: 'docker' },
                { value: 'buildx', label: 'buildx' },
                { value: 'kaniko', label: 'kaniko' },
                { value: 'custom', label: 'custom' },
              ]}
            />
          </Form.Item>
          <Form.Item
            className="soha-build-template-switch-field"
            name="enabled"
            label="启用"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            className="soha-build-template-form-grid__wide"
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} placeholder="说明适用语言、构建器、缓存策略和制品输出约定" />
          </Form.Item>
        </div>
      ),
    },
    {
      key: 'dockerfile',
      label: 'Dockerfile',
      children: (
        <div className="soha-build-template-editor-pane">
          <Text type="secondary">
            维护平台推荐的 Dockerfile 草稿，应用接入时可按规范生成或落盘。
          </Text>
          <Form.Item name="dockerfileTemplate" label="Dockerfile 模板">
            <Input.TextArea
              className="soha-build-template-code-area"
              rows={18}
              spellCheck={false}
            />
          </Form.Item>
        </div>
      ),
    },
    {
      key: 'commands',
      label: '构建命令',
      children: (
        <div className="soha-build-template-editor-pane">
          <Text type="secondary">每行一条命令，执行器会按顺序生成构建步骤。</Text>
          <Form.Item name="buildCommandsText" label="命令列表">
            <Input.TextArea
              className="soha-build-template-code-area"
              rows={14}
              placeholder="npm ci&#10;npm run build"
              spellCheck={false}
            />
          </Form.Item>
        </div>
      ),
    },
    {
      key: 'variables',
      label: '变量',
      children: (
        <Form.List name="variables">
          {(fields, { add, remove }) => (
            <div className="soha-build-template-variable-list">
              <div className="soha-build-template-variable-list__toolbar">
                <Text type="secondary">
                  用结构化字段维护构建参数，保存时自动生成 variableSchema 和默认变量。
                </Text>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() =>
                    add({
                      key: '',
                      label: '',
                      type: 'string',
                      required: false,
                      defaultValue: '',
                      description: '',
                    })
                  }
                >
                  添加变量
                </Button>
              </div>
              {fields.length === 0 ? (
                <ManagementState
                  bordered={false}
                  compact
                  kind="empty"
                  title="暂无变量"
                  description="没有变量时，模板会使用高级预览里的兼容 JSON 配置。"
                />
              ) : null}
              {fields.map((field, index) => (
                <div className="soha-build-template-variable-item" key={field.key}>
                  <div className="soha-build-template-variable-item__head">
                    <strong>{`变量 ${index + 1}`}</strong>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={() => remove(field.name)}
                    >
                      删除
                    </Button>
                  </div>
                  <div className="soha-build-template-form-grid">
                    <Form.Item
                      name={[field.name, 'key']}
                      label="变量 Key"
                      rules={[{ required: true, message: '请输入变量 Key' }]}
                    >
                      <Input placeholder="imageTag" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'label']} label="显示名称">
                      <Input placeholder="镜像 Tag" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'type']} label="类型">
                      <Select
                        options={[
                          { value: 'string', label: 'string' },
                          { value: 'number', label: 'number' },
                          { value: 'boolean', label: 'boolean' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name={[field.name, 'defaultValue']} label="默认值">
                      <Input placeholder="latest" />
                    </Form.Item>
                    <Form.Item
                      className="soha-build-template-switch-field"
                      name={[field.name, 'required']}
                      label="必填"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      className="soha-build-template-form-grid__wide"
                      name={[field.name, 'description']}
                      label="说明"
                    >
                      <Input.TextArea rows={2} placeholder="变量用途、默认策略或允许值说明" />
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
        <div className="soha-build-template-advanced">
          <div className="soha-build-template-form-grid">
            <Form.Item
              className="soha-build-template-form-grid__wide"
              name="variableSchemaText"
              label="兼容变量 Schema(JSON)"
            >
              <Input.TextArea rows={5} spellCheck={false} />
            </Form.Item>
            <Form.Item
              className="soha-build-template-form-grid__wide"
              name="defaultVariablesText"
              label="兼容默认变量(JSON)"
            >
              <Input.TextArea rows={5} spellCheck={false} />
            </Form.Item>
          </div>
          {previewState.error ? <Text type="danger">{previewState.error}</Text> : null}
          <pre className="soha-json-block soha-build-template-json-preview">
            {previewState.error ? '请修正变量 JSON 后再查看完整 payload。' : previewState.json}
          </pre>
        </div>
      ),
    },
  ]

  const templateToolbar = (
    <>
      <Space wrap>
        <Button
          icon={<PlusOutlined />}
          type="primary"
          disabled={!canManage}
          onClick={handleNewTemplate}
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
        <Popconfirm
          title="确认删除当前构建模板？"
          onConfirm={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)}
        >
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={!selectedTemplate || !canManage}
            loading={deleteMutation.isPending}
          >
            删除
          </Button>
        </Popconfirm>
      </Space>
      <Space wrap>
        {isDirty ? <Tag color="gold">未保存</Tag> : <Tag>已同步</Tag>}
        <Button
          icon={<ReloadOutlined />}
          loading={templatesQuery.isFetching}
          onClick={() => {
            if (confirmDiscardChanges()) void templatesQuery.refetch()
          }}
        >
          刷新
        </Button>
      </Space>
    </>
  )

  const templateList = (
    <ManagementSearchableListPane
      activeKey={selectedTemplateId}
      className="soha-build-template-list"
      emptyDescription="新建模板后，可在右侧维护 Dockerfile、命令和变量。"
      emptyTitle="暂无构建模板"
      getItemKey={(item) => item.id}
      isLoading={templatesQuery.isLoading}
      itemClassName="soha-build-template-list__item"
      items={visibleListItems}
      searchPlaceholder="搜索构建模板"
      searchValue={searchText}
      onItemSelect={handleSelectListItem}
      onSearchChange={setSearchText}
      renderItem={(item) => (
        <>
          <span className="soha-build-template-list__item-head">
            <span className="soha-build-template-list__item-main">
              <strong>{item.name}</strong>
              <Text type="secondary">{item.key}</Text>
            </span>
            <span
              className="soha-build-template-list__item-actions"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <Switch
                checked={item.enabled}
                disabled={!canManage}
                size="small"
                onChange={(checked) => handleTemplateEnabledChange(item, checked)}
              />
              <ManagementIconButton
                aria-label="编辑构建模板"
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
          <span className="soha-build-template-list__item-meta">
            <Tag>{item.builderKind || 'docker'}</Tag>
            <Tag>{`命令 ${item.commandCount}`}</Tag>
            <Tag>{`变量 ${item.variableCount}`}</Tag>
            <BooleanTag value={item.enabled} />
            {item.isDraft ? <Tag color="gold">草稿</Tag> : null}
          </span>
          <Text type="secondary" className="text-xs">
            {item.updatedAt ? formatDateTime(item.updatedAt) : '尚未保存'}
          </Text>
        </>
      )}
    />
  )

  const templateDesigner = hasSelection ? (
    <Form
      className="soha-build-template-form"
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
        loading={selectedTemplateUsageQuery.isFetching && !!selectedTemplate}
        onNavigate={navigate}
        usage={selectedTemplateUsage}
      />
      <Tabs
        activeKey={activeTabKey}
        className="soha-build-template-tabs"
        destroyOnHidden={false}
        items={designerTabs}
        onChange={setActiveTabKey}
      />
    </Form>
  ) : (
    <ManagementState
      bordered={false}
      kind="select-scope"
      title="选择或新建构建模板"
      description="左侧选择模板后，在右侧维护 Dockerfile、构建命令和变量。"
    />
  )

  return (
    <TemplateDesignerShell
      className="soha-page soha-build-template-page"
      designer={templateDesigner}
      designerClassName="soha-build-template-designer"
      list={templateList}
      toolbar={templateToolbar}
      toolbarClassName="soha-build-template-toolbar"
      workspaceClassName="soha-build-template-workspace"
    />
  )
}
