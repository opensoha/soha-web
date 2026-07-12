import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './styles.css'
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import {
  CopyOutlined,
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
import {
  analyzeReleaseDagDefinition,
  createDefaultReleaseDagDefinition,
  normalizeReleaseDagDefinition,
  type ReleaseDagDefinition,
} from '@/components/release-flow-dag-definition'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { formatDateTime } from '@/utils/time'
import {
  TemplateUsageImpactPanel,
  shouldConfirmTemplateUsageSave,
  templateUsageConfirmText,
} from '../template-usage-impact'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type { WorkflowTemplate } from '../types'

const RELEASE_TEMPLATE_CATEGORY_OPTIONS = [
  { value: 'release', label: 'Release Flow' },
  { value: 'verification', label: 'Verification' },
  { value: 'promotion', label: 'Promotion' },
]

const { Text } = Typography
type WorkflowTemplateListItem = Omit<WorkflowTemplate, 'definition'> & { definition?: unknown }

const ReleaseFlowDagEditor = lazy(async () => {
  const mod = await import('@/components/release-flow-dag-editor')
  return { default: mod.ReleaseFlowDagEditor }
})

function normalizeWorkflowTemplateDagDefinition(raw: unknown): ReleaseDagDefinition {
  const definition = normalizeReleaseDagDefinition(raw)
  return {
    ...definition,
    schemaVersion: 2,
  }
}

function serializeWorkflowTemplateDagDefinition(raw: unknown) {
  return JSON.stringify(normalizeWorkflowTemplateDagDefinition(raw))
}

export function WorkflowTemplatesPage() {
  const { t, localeCode } = useI18n()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm<Record<string, unknown>>()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [searchText, setSearchText] = useState('')
  const [editorDefinition, setEditorDefinition] = useState<ReleaseDagDefinition>(
    createDefaultReleaseDagDefinition(),
  )
  const [editorInitialDefinition, setEditorInitialDefinition] = useState<ReleaseDagDefinition>(
    createDefaultReleaseDagDefinition(),
  )
  const [isDirty, setIsDirty] = useState(false)
  const [jsonPreviewVisible, setJsonPreviewVisible] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [templateFormSnapshot, setTemplateFormSnapshot] = useState<Record<string, unknown>>({})
  const suppressEditorChangeRef = useRef(false)
  const suppressFormChangeRef = useRef(false)
  const formDirtyRef = useRef(false)
  const dagDirtyRef = useRef(false)
  const savedDefinitionRef = useRef(
    serializeWorkflowTemplateDagDefinition(createDefaultReleaseDagDefinition()),
  )
  const canManageWorkflowTemplates = hasPermission(
    permissionSnapshotQuery.data?.data,
    'delivery.workflow-templates.manage',
  )

  const { data, isFetching, isLoading, refetch } = useQuery(
    deliveryQueries.workflowTemplates.list(),
  )

  const confirmDiscardChanges = useCallback(() => {
    if (!isDirty) return true
    return window.confirm(
      localeCode === 'zh_CN'
        ? '当前模板有未保存更改，确认放弃？'
        : 'This template has unsaved changes. Discard them?',
    )
  }, [isDirty, localeCode])

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

  const applyTemplateFormValues = useCallback(
    (values: Record<string, unknown>, dirtyAfterApply: boolean) => {
      suppressFormChangeRef.current = true
      setTemplateFormSnapshot(values)
      window.setTimeout(() => {
        form.setFieldsValue(values)
        window.setTimeout(() => {
          suppressFormChangeRef.current = false
          formDirtyRef.current = dirtyAfterApply
          setIsDirty(dirtyAfterApply || dagDirtyRef.current)
        }, 0)
      }, 0)
    },
    [form],
  )

  const getTemplateFormValues = useCallback(
    (template: WorkflowTemplate, overrides?: Record<string, unknown>) => ({
      key: template.key,
      name: template.name,
      description: template.description,
      category: template.category || 'release',
      enabled: template.enabled,
      ...overrides,
    }),
    [],
  )

  const loadTemplate = useCallback(
    (
      template: WorkflowTemplate,
      options?: {
        dirtyAfterLoad?: boolean
        formOverrides?: Record<string, unknown>
        openSettings?: boolean
      },
    ) => {
      const definition = normalizeWorkflowTemplateDagDefinition(template.definition)
      const dirtyAfterLoad = Boolean(options?.dirtyAfterLoad)
      suppressEditorChangeRef.current = true
      setSelectedTemplateId(template.id)
      setEditorDefinition(definition)
      setEditorInitialDefinition(definition)
      savedDefinitionRef.current = serializeWorkflowTemplateDagDefinition(definition)
      formDirtyRef.current = dirtyAfterLoad
      dagDirtyRef.current = false
      setIsDirty(dirtyAfterLoad)
      applyTemplateFormValues(
        getTemplateFormValues(template, options?.formOverrides),
        dirtyAfterLoad,
      )
      if (options?.openSettings) {
        setSettingsModalOpen(true)
      }
      updateTemplateSearchParam(template.id)
    },
    [applyTemplateFormValues, getTemplateFormValues, updateTemplateSearchParam],
  )

  const createOptions = deliveryMutations.workflowTemplates.create(queryClient)
  const createMutation = useMutation({
    ...createOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void createOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success(
        localeCode === 'zh_CN' ? 'DAG 发布流程模板创建成功' : 'DAG release flow template created',
      )
    },
    onError: (err: Error) => message.error(err.message),
  })
  const updateOptions = deliveryMutations.workflowTemplates.update(queryClient)
  const updateMutation = useMutation({
    ...updateOptions,
    onSuccess: (result, variables, onMutateResult, context) => {
      void updateOptions.onSuccess?.(result, variables, onMutateResult, context)
      message.success(
        localeCode === 'zh_CN' ? 'DAG 发布流程模板更新成功' : 'DAG release flow template updated',
      )
    },
    onError: (err: Error) => message.error(err.message),
  })
  const deleteOptions = deliveryMutations.workflowTemplates.delete(queryClient)
  const deleteMutation = useMutation({
    ...deleteOptions,
    onSuccess: (result, deletedId, onMutateResult, context) => {
      void deleteOptions.onSuccess?.(result, deletedId, onMutateResult, context)
      message.success(
        localeCode === 'zh_CN' ? 'DAG 发布流程模板已删除' : 'DAG release flow template deleted',
      )
      if (selectedTemplateId === deletedId) {
        const nextTemplate = (data ?? []).find((item) => item.id !== deletedId)
        if (nextTemplate) {
          loadTemplate(nextTemplate)
        } else {
          form.resetFields()
          setSelectedTemplateId('')
          setEditorDefinition(createDefaultReleaseDagDefinition())
          setEditorInitialDefinition(createDefaultReleaseDagDefinition())
          setIsDirty(false)
        }
      }
    },
    onError: (err: Error) => message.error(err.message),
  })

  const templates = data ?? []
  const selectedTemplate =
    selectedTemplateId && selectedTemplateId !== 'new'
      ? (templates.find((item) => item.id === selectedTemplateId) ?? null)
      : null
  const selectedTemplateUsageQuery = useQuery(
    deliveryQueries.workflowTemplates.usage(
      selectedTemplate?.id ?? '',
      Boolean(selectedTemplate?.id),
    ),
  )
  const selectedTemplateUsage = selectedTemplateUsageQuery.data
  const isNewDraft = selectedTemplateId === 'new'
  const hasSelection = isNewDraft || !!selectedTemplate
  const dagAnalysis = useMemo(
    () => analyzeReleaseDagDefinition(editorDefinition),
    [editorDefinition],
  )
  const errorIssues = dagAnalysis.issues.filter((issue) => issue.severity === 'error')
  const warningIssues = dagAnalysis.issues.filter((issue) => issue.severity === 'warning')
  const previewDefinition = useMemo(
    () => JSON.stringify(editorDefinition, null, 2),
    [editorDefinition],
  )
  const listTemplates = useMemo(() => {
    const draftKey = String(templateFormSnapshot.key || '').trim()
    const draftName = String(templateFormSnapshot.name || '').trim()
    const draftCategory = String(templateFormSnapshot.category || 'release').trim()
    if (!isNewDraft) return templates
    return [
      {
        id: 'new',
        key: draftKey || 'new-workflow-template',
        name: draftName || (localeCode === 'zh_CN' ? '新建模板草稿' : 'New Template Draft'),
        description: String(templateFormSnapshot.description || ''),
        category: draftCategory || 'release',
        enabled: templateFormSnapshot.enabled !== false,
        definition: editorDefinition,
        createdAt: '',
        updatedAt: '',
      },
      ...templates,
    ] as WorkflowTemplateListItem[]
  }, [editorDefinition, isNewDraft, localeCode, templateFormSnapshot, templates])

  const visibleTemplates = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return listTemplates
    return listTemplates.filter((item) =>
      [item.name, item.key, item.category, item.description].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(keyword),
      ),
    )
  }, [listTemplates, searchText])

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

  const handleSelectTemplate = (template: WorkflowTemplate) => {
    if (template.id === selectedTemplateId) return
    if (!confirmDiscardChanges()) return
    loadTemplate(template)
  }

  const handleSelectTemplateListItem = (template: WorkflowTemplateListItem) => {
    if (template.id === 'new') {
      setSelectedTemplateId('new')
      return
    }
    handleSelectTemplate(template as WorkflowTemplate)
  }

  const handleNewTemplate = () => {
    if (!confirmDiscardChanges()) return
    const definition = createDefaultReleaseDagDefinition()
    const draftKey = `workflow-template-${Date.now().toString(36)}`
    savedDefinitionRef.current = serializeWorkflowTemplateDagDefinition(definition)
    suppressEditorChangeRef.current = true
    setSelectedTemplateId('new')
    setEditorDefinition(definition)
    setEditorInitialDefinition(definition)
    formDirtyRef.current = true
    dagDirtyRef.current = true
    setIsDirty(true)
    applyTemplateFormValues(
      {
        key: draftKey,
        name: localeCode === 'zh_CN' ? '新建模板' : 'New Template',
        description: '',
        category: 'release',
        enabled: true,
      },
      true,
    )
    setSettingsModalOpen(true)
    updateTemplateSearchParam()
  }

  const handleCopyTemplate = () => {
    if (!hasSelection) return
    const values = form.getFieldsValue()
    const definition = normalizeWorkflowTemplateDagDefinition(editorDefinition)
    savedDefinitionRef.current = serializeWorkflowTemplateDagDefinition(definition)
    suppressEditorChangeRef.current = true
    setSelectedTemplateId('new')
    setEditorDefinition(definition)
    setEditorInitialDefinition(definition)
    formDirtyRef.current = true
    dagDirtyRef.current = true
    setIsDirty(true)
    applyTemplateFormValues(
      {
        ...values,
        key: `${String(values.key || 'workflow-template')}-copy`,
        name: `${String(values.name || 'Workflow Template')} Copy`,
        enabled: true,
      },
      true,
    )
    setSettingsModalOpen(true)
    updateTemplateSearchParam()
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
    setTemplateFormSnapshot({})
    setSelectedTemplateId('')
    setSettingsModalOpen(false)
    setEditorDefinition(createDefaultReleaseDagDefinition())
    setEditorInitialDefinition(createDefaultReleaseDagDefinition())
    savedDefinitionRef.current = serializeWorkflowTemplateDagDefinition(
      createDefaultReleaseDagDefinition(),
    )
    formDirtyRef.current = false
    dagDirtyRef.current = false
    setIsDirty(false)
  }

  const handleSave = async () => {
    const errors = errorIssues.filter((issue) => issue.severity === 'error')
    if (errors.length > 0) {
      message.error(errors[0].message)
      return
    }
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        category: values.category || 'release',
        definition: editorDefinition,
      }
      if (selectedTemplate) {
        const usageForSave =
          selectedTemplateUsage ?? (await selectedTemplateUsageQuery.refetch()).data
        if (
          shouldConfirmTemplateUsageSave(usageForSave) &&
          !window.confirm(templateUsageConfirmText(selectedTemplate.name, usageForSave, localeCode))
        ) {
          return
        }
        await updateMutation.mutateAsync({ id: selectedTemplate.id, payload })
        setEditorInitialDefinition(editorDefinition)
        savedDefinitionRef.current = serializeWorkflowTemplateDagDefinition(editorDefinition)
        formDirtyRef.current = false
        dagDirtyRef.current = false
        setIsDirty(false)
        setSettingsModalOpen(false)
        return
      }
      const createdTemplate = await createMutation.mutateAsync(payload)
      setEditorInitialDefinition(editorDefinition)
      savedDefinitionRef.current = serializeWorkflowTemplateDagDefinition(editorDefinition)
      formDirtyRef.current = false
      dagDirtyRef.current = false
      setIsDirty(false)
      if (createdTemplate?.id) {
        setSelectedTemplateId(createdTemplate.id)
        setSettingsModalOpen(false)
        updateTemplateSearchParam(createdTemplate.id)
      }
    } catch {
      // antd Form and mutation handlers surface validation or API errors.
    }
  }

  const handleEditorChange = useCallback(
    (definition: ReleaseDagDefinition) => {
      setEditorDefinition(definition)
      if (suppressEditorChangeRef.current) {
        suppressEditorChangeRef.current = false
        return
      }
      const hasDagChanges =
        selectedTemplateId === 'new' ||
        serializeWorkflowTemplateDagDefinition(definition) !== savedDefinitionRef.current
      dagDirtyRef.current = hasDagChanges
      setIsDirty(formDirtyRef.current || dagDirtyRef.current)
    },
    [selectedTemplateId],
  )

  const handleOpenTemplateSettings = (template: WorkflowTemplateListItem) => {
    if (template.id === 'new') {
      setSettingsModalOpen(true)
      return
    }
    if (template.id !== selectedTemplateId) {
      if (!confirmDiscardChanges()) return
      loadTemplate(template as WorkflowTemplate, { openSettings: true })
      return
    }
    setSettingsModalOpen(true)
  }

  const handleTemplateEnabledChange = (template: WorkflowTemplateListItem, enabled: boolean) => {
    if (template.id === 'new') {
      form.setFieldsValue({ enabled })
      setTemplateFormSnapshot((current) => ({ ...current, enabled }))
      formDirtyRef.current = true
      setIsDirty(true)
      return
    }
    if (template.id !== selectedTemplateId) {
      if (!confirmDiscardChanges()) return
      loadTemplate(template as WorkflowTemplate, {
        dirtyAfterLoad: true,
        formOverrides: { enabled },
      })
      return
    }
    form.setFieldsValue({ enabled })
    setTemplateFormSnapshot((current) => ({ ...current, enabled }))
    formDirtyRef.current = true
    setIsDirty(true)
  }

  const templateToolbar = (
    <>
      <Space wrap>
        <Button
          icon={<PlusOutlined />}
          type="primary"
          disabled={!canManageWorkflowTemplates}
          onClick={handleNewTemplate}
        >
          {localeCode === 'zh_CN' ? '新建模板' : 'New Template'}
        </Button>
        <Button
          icon={<SaveOutlined />}
          disabled={!hasSelection || !canManageWorkflowTemplates}
          loading={createMutation.isPending || updateMutation.isPending}
          onClick={() => void handleSave()}
        >
          {localeCode === 'zh_CN' ? '保存' : 'Save'}
        </Button>
        <Button disabled={!hasSelection || !isDirty} onClick={handleCancelChanges}>
          {localeCode === 'zh_CN' ? '取消更改' : 'Discard'}
        </Button>
        <Button
          icon={<CopyOutlined />}
          disabled={!hasSelection || !canManageWorkflowTemplates}
          onClick={handleCopyTemplate}
        >
          {localeCode === 'zh_CN' ? '复制模板' : 'Copy'}
        </Button>
        <Popconfirm
          title={localeCode === 'zh_CN' ? '确认删除当前模板？' : 'Delete the selected template?'}
          onConfirm={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)}
        >
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={!selectedTemplate || !canManageWorkflowTemplates}
            loading={deleteMutation.isPending}
          >
            {localeCode === 'zh_CN' ? '删除' : 'Delete'}
          </Button>
        </Popconfirm>
      </Space>
      <Space wrap>
        {isDirty ? (
          <Tag color="gold">{localeCode === 'zh_CN' ? '未保存' : 'Unsaved'}</Tag>
        ) : (
          <Tag>{localeCode === 'zh_CN' ? '已同步' : 'Synced'}</Tag>
        )}
        <Button
          type={jsonPreviewVisible ? 'primary' : 'default'}
          onClick={() => setJsonPreviewVisible((value) => !value)}
        >
          JSON
        </Button>
        <Button
          icon={<ReloadOutlined />}
          loading={isFetching}
          onClick={() => {
            if (confirmDiscardChanges()) void refetch()
          }}
        >
          {t('common.refresh', 'Refresh')}
        </Button>
      </Space>
    </>
  )

  const templateList = (
    <ManagementSearchableListPane
      activeKey={selectedTemplateId}
      className="soha-workflow-template-list"
      emptyDescription={localeCode === 'zh_CN' ? '暂无模板' : 'No templates'}
      getItemKey={(template) => template.id}
      isLoading={isLoading}
      itemClassName="soha-workflow-template-list__item"
      items={visibleTemplates}
      searchPlaceholder={localeCode === 'zh_CN' ? '搜索模板' : 'Search templates'}
      searchValue={searchText}
      onItemSelect={handleSelectTemplateListItem}
      onSearchChange={setSearchText}
      renderItem={(template) => {
        const analysis = analyzeReleaseDagDefinition(template.definition)
        const isActive = template.id === selectedTemplateId
        const enabledValue = isActive ? templateFormSnapshot.enabled !== false : template.enabled
        return (
          <>
            <span className="soha-workflow-template-list__item-head">
              <span className="soha-workflow-template-list__item-main">
                <strong>{template.name}</strong>
                <Text type="secondary">{template.key}</Text>
              </span>
              <span
                className="soha-workflow-template-list__item-actions"
                onClick={(event) => event.stopPropagation()}
              >
                <Switch
                  checked={enabledValue}
                  disabled={!canManageWorkflowTemplates}
                  size="small"
                  onChange={(checked) => handleTemplateEnabledChange(template, checked)}
                />
                <ManagementIconButton
                  aria-label={localeCode === 'zh_CN' ? '编辑模板设置' : 'Edit template settings'}
                  icon={<EditOutlined />}
                  size="small"
                  tooltip={localeCode === 'zh_CN' ? '设置' : 'Settings'}
                  onClick={() => handleOpenTemplateSettings(template)}
                />
              </span>
            </span>
            <span className="soha-workflow-template-list__item-meta">
              <Tag>{template.category || 'release'}</Tag>
              <Tag>{`${analysis.nodeCount} nodes`}</Tag>
              {template.id === 'new' ? (
                <Tag color="gold">{localeCode === 'zh_CN' ? '草稿' : 'Draft'}</Tag>
              ) : null}
            </span>
            <Text type="secondary" className="text-xs">
              {template.updatedAt
                ? formatDateTime(template.updatedAt)
                : localeCode === 'zh_CN'
                  ? '尚未保存'
                  : 'Not saved'}
            </Text>
          </>
        )
      }}
    />
  )

  const templateDesigner = hasSelection ? (
    <Suspense
      fallback={<ManagementState kind="loading" title={t('common.loading', 'Loading...')} />}
    >
      <ReleaseFlowDagEditor
        className="soha-workflow-template-dag-editor"
        height="calc(100vh - 238px)"
        initialDefinition={editorInitialDefinition}
        key={selectedTemplateId || 'workflow-template-empty'}
        layout="palette-right-floating-inspector"
        onChange={handleEditorChange}
        variant="embedded"
      />
    </Suspense>
  ) : (
    <ManagementState
      bordered={false}
      kind="select-scope"
      title={localeCode === 'zh_CN' ? '选择或新建模板' : 'Select or create a template'}
      description={
        localeCode === 'zh_CN'
          ? '左侧选择模板后在此编辑 DAG。'
          : 'Choose a template from the list to edit its DAG.'
      }
    />
  )

  return (
    <TemplateDesignerShell
      className="soha-page soha-workflow-template-page"
      designer={templateDesigner}
      designerClassName="soha-workflow-template-designer"
      list={templateList}
      toolbar={templateToolbar}
      toolbarClassName="soha-workflow-template-toolbar"
      workspaceClassName="soha-workflow-template-workspace"
    >
      {jsonPreviewVisible && hasSelection ? (
        <pre className="soha-json-block soha-workflow-template-json-panel">{previewDefinition}</pre>
      ) : null}

      <Modal
        forceRender
        okButtonProps={{ disabled: !hasSelection || !canManageWorkflowTemplates }}
        okText={localeCode === 'zh_CN' ? '保存模板' : 'Save Template'}
        open={settingsModalOpen && hasSelection}
        title={localeCode === 'zh_CN' ? '模板设置' : 'Template Settings'}
        width={560}
        onCancel={() => setSettingsModalOpen(false)}
        onOk={() => void handleSave()}
      >
        <Form
          className="soha-workflow-template-settings-form"
          form={form}
          layout="vertical"
          onValuesChange={(_changedValues, allValues) => {
            if (suppressFormChangeRef.current) return
            setTemplateFormSnapshot(allValues)
            formDirtyRef.current = true
            setIsDirty(true)
          }}
        >
          <Form.Item
            name="key"
            label={localeCode === 'zh_CN' ? '模板 Key' : 'Template Key'}
            rules={[
              {
                required: true,
                message: localeCode === 'zh_CN' ? '请输入模板 Key' : 'Enter the template key',
              },
            ]}
          >
            <Input disabled={!canManageWorkflowTemplates} />
          </Form.Item>
          <Form.Item
            name="name"
            label={localeCode === 'zh_CN' ? '模板名称' : 'Template Name'}
            rules={[
              {
                required: true,
                message: localeCode === 'zh_CN' ? '请输入模板名称' : 'Enter the template name',
              },
            ]}
          >
            <Input disabled={!canManageWorkflowTemplates} />
          </Form.Item>
          <Form.Item name="description" label={localeCode === 'zh_CN' ? '描述' : 'Description'}>
            <Input disabled={!canManageWorkflowTemplates} />
          </Form.Item>
          <div className="soha-workflow-template-settings-form__grid">
            <Form.Item name="category" label={localeCode === 'zh_CN' ? '分类' : 'Category'}>
              <Select
                disabled={!canManageWorkflowTemplates}
                options={RELEASE_TEMPLATE_CATEGORY_OPTIONS}
              />
            </Form.Item>
            <Form.Item
              className="soha-workflow-template-settings-form__switch"
              name="enabled"
              label={localeCode === 'zh_CN' ? '启用' : 'Enabled'}
              valuePropName="checked"
            >
              <Switch disabled={!canManageWorkflowTemplates} />
            </Form.Item>
          </div>
          <div className="soha-workflow-template-status-tags">
            <Tag>{`${localeCode === 'zh_CN' ? '节点' : 'Nodes'} ${dagAnalysis.nodeCount}`}</Tag>
            <Tag
              color={dagAnalysis.validationNodeCount > 0 ? 'green' : 'default'}
            >{`${localeCode === 'zh_CN' ? '验证' : 'Verify'} ${dagAnalysis.validationNodeCount}`}</Tag>
            <Tag
              color={dagAnalysis.rollbackNodeCount > 0 ? 'green' : 'gold'}
            >{`${localeCode === 'zh_CN' ? '回滚' : 'Rollback'} ${dagAnalysis.rollbackNodeCount}`}</Tag>
            <Tag
              color={dagAnalysis.approvalNodeCount > 0 ? 'gold' : 'default'}
            >{`${localeCode === 'zh_CN' ? '审批' : 'Approval'} ${dagAnalysis.approvalNodeCount}`}</Tag>
            <Tag color={dagAnalysis.isReleaseDagCompatible ? 'green' : 'red'}>
              {dagAnalysis.isReleaseDagCompatible ? 'release_dag compatible' : 'blocked'}
            </Tag>
            <Tag color={(selectedTemplateUsage?.usageCount ?? 0) > 0 ? 'gold' : 'default'}>
              {localeCode === 'zh_CN'
                ? `影响 ${selectedTemplateUsage?.environmentCount ?? 0} 个环境`
                : `${selectedTemplateUsage?.environmentCount ?? 0} environments`}
            </Tag>
          </div>
          {errorIssues.length > 0 ? (
            <Text type="danger" className="text-xs">
              {errorIssues.map((issue) => issue.message).join(' / ')}
            </Text>
          ) : warningIssues.length > 0 ? (
            <Text type="warning" className="text-xs">
              {warningIssues.map((issue) => issue.message).join(' / ')}
            </Text>
          ) : null}
          <TemplateUsageImpactPanel
            loading={selectedTemplateUsageQuery.isFetching && !!selectedTemplate}
            localeCode={localeCode}
            onNavigate={navigate}
            usage={selectedTemplateUsage}
          />
        </Form>
      </Modal>
    </TemplateDesignerShell>
  )
}
