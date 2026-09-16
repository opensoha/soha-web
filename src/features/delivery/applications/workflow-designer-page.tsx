import { lazy, Suspense, useEffect, useState } from 'react'
import './styles.css'
import { App, Button, Input, Space, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ManagementState, TemplateDesignerShell } from '@/components/management-list'
import { useI18n } from '@/i18n'
import {
  analyzeReleaseDagDefinition,
  normalizeReleaseDagDefinition,
  type ReleaseDagDefinition,
} from '@/components/release-flow-dag-definition'
import { deliveryMutations } from '../mutations'
import { deliveryQueries } from '../queries'
import type { ApplicationEnvironment, WorkflowTemplate } from '../types'

const { Text } = Typography

const ReleaseFlowDagEditor = lazy(async () => {
  const module = await import('@/components/release-flow-dag-editor')
  return { default: module.ReleaseFlowDagEditor }
})

const EMPTY_WORKFLOW: ReleaseDagDefinition = {
  schemaVersion: 2,
  mode: 'release_dag',
  nodes: [],
  edges: [],
}

const RELEASE_DAG_ERROR_KEYS: Record<string, string> = {
  '至少需要 1 个 DAG 节点': 'page.applicationWorkflowDesigner.issue.nodeRequired',
  '节点 ID 不能重复': 'page.applicationWorkflowDesigner.issue.duplicateNodeIds',
  '连线 source/target 必须指向存在的节点': 'page.applicationWorkflowDesigner.issue.invalidEdges',
  'DAG 连线不能指向自身': 'page.applicationWorkflowDesigner.issue.selfLoop',
  'DAG 不能包含环路': 'page.applicationWorkflowDesigner.issue.cycle',
}

function ApplicationWorkflowCanvas({
  applicationId,
  binding,
  boundTemplate,
  initialName,
  sourceTemplate,
}: {
  applicationId: string
  binding: ApplicationEnvironment
  boundTemplate?: WorkflowTemplate
  initialName: string
  sourceTemplate?: WorkflowTemplate
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const [name, setName] = useState(initialName)
  const [expectedRevision] = useState(boundTemplate?.revision)
  const [initialDefinition] = useState<ReleaseDagDefinition>(
    sourceTemplate ? normalizeReleaseDagDefinition(sourceTemplate.definition) : EMPTY_WORKFLOW,
  )
  const [definition, setDefinition] = useState<ReleaseDagDefinition>(initialDefinition)
  const dirty =
    name !== initialName || JSON.stringify(definition) !== JSON.stringify(initialDefinition)
  const saveMutation = useMutation(deliveryMutations.environments.saveWorkflow(queryClient))

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const returnToApplication = () => {
    if (
      dirty &&
      !window.confirm(
        t('page.applicationWorkflowDesigner.unsavedConfirm', '当前工作流有未保存更改，确认离开？'),
      )
    )
      return
    navigate(`/applications/${encodeURIComponent(applicationId)}?tab=delivery`)
  }

  const save = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      message.error(t('page.applicationWorkflowDesigner.nameRequired', '请输入工作流名称'))
      return
    }
    const error = analyzeReleaseDagDefinition(definition).issues.find(
      (issue) => issue.severity === 'error',
    )
    if (error) {
      const key = RELEASE_DAG_ERROR_KEYS[error.message]
      message.error(
        key
          ? t(key, error.message)
          : t('page.applicationWorkflowDesigner.invalidDefinition', '工作流定义无效'),
      )
      return
    }
    try {
      await saveMutation.mutateAsync({
        applicationId,
        id: binding.id,
        payload: {
          expectedRevision,
          name: trimmedName,
          description:
            boundTemplate?.description ||
            t('page.applicationWorkflowDesigner.description', '应用内工作流'),
          definition,
          enabled: true,
        },
      })
      message.success(t('page.applicationWorkflowDesigner.saved', '工作流已保存'))
      navigate(`/applications/${encodeURIComponent(applicationId)}?tab=delivery`)
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t('page.applicationWorkflowDesigner.saveFailed', '工作流保存失败'),
      )
    }
  }

  return (
    <TemplateDesignerShell
      className="soha-page soha-application-workflow-designer"
      designer={
        <Suspense
          fallback={
            <ManagementState
              kind="loading"
              title={t('page.applicationWorkflowDesigner.canvasLoading', '正在加载画布')}
            />
          }
        >
          <ReleaseFlowDagEditor
            className="soha-application-workflow-designer__canvas"
            height="calc(100vh - 190px)"
            initialDefinition={initialDefinition}
            layout="palette-right-floating-inspector"
            variant="embedded"
            onChange={setDefinition}
          />
        </Suspense>
      }
      designerClassName="soha-application-workflow-designer__designer"
      list={null}
      toolbar={
        <>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={returnToApplication}>
              {t('page.applicationWorkflowDesigner.back', '返回工作流')}
            </Button>
            <span>
              <Text strong>{t('page.applicationWorkflowDesigner.title', '项目工作流设计')}</Text>
              <br />
              <Text type="secondary">
                {binding.alias || binding.environmentKey || binding.environmentId}
                {sourceTemplate
                  ? ` · ${t('page.applicationWorkflowDesigner.basedOn', '基于')} ${sourceTemplate.name}`
                  : ` · ${t('page.applicationWorkflowDesigner.blankCanvas', '空白画布')}`}
              </Text>
            </span>
          </Space>
          <Space>
            <Input
              aria-label={t('page.applicationWorkflowDesigner.nameLabel', '工作流名称')}
              maxLength={80}
              style={{ width: 280 }}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Tag color={dirty ? 'gold' : undefined}>
              {dirty
                ? t('page.applicationWorkflowDesigner.unsaved', '未保存')
                : t('page.applicationWorkflowDesigner.synced', '已同步')}
            </Tag>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saveMutation.isPending}
              onClick={() => void save()}
            >
              {t('page.applicationWorkflowDesigner.save', '保存工作流')}
            </Button>
          </Space>
        </>
      }
      workspaceClassName="soha-application-workflow-designer__workspace"
    />
  )
}

export function ApplicationWorkflowDesignerPage() {
  const { t } = useI18n()
  const { applicationId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const bindingId = searchParams.get('bindingId')?.trim() || ''
  const requestedTemplateId = searchParams.get('templateId')?.trim() || ''
  const source = searchParams.get('source')
  const applicationsQuery = useQuery(deliveryQueries.applications.list(Boolean(applicationId)))
  const bindingsQuery = useQuery(deliveryQueries.environments.list(Boolean(applicationId)))
  const templatesQuery = useQuery(deliveryQueries.workflowTemplates.list(Boolean(applicationId)))
  const requestedTemplate = templatesQuery.data?.find((item) => item.id === requestedTemplateId)
  const requestedVersion =
    Number(searchParams.get('templateVersion')) || requestedTemplate?.publishedVersion || 0
  const sourceTemplateQuery = useQuery(
    deliveryQueries.workflowTemplates.version(
      requestedTemplateId,
      requestedVersion,
      source === 'template' && Boolean(requestedTemplateId),
    ),
  )

  if (
    applicationsQuery.isLoading ||
    bindingsQuery.isLoading ||
    templatesQuery.isLoading ||
    sourceTemplateQuery.isLoading
  ) {
    return (
      <ManagementState
        kind="loading"
        title={t('page.applicationWorkflowDesigner.loading', '正在加载工作流')}
      />
    )
  }
  if (
    applicationsQuery.isError ||
    bindingsQuery.isError ||
    templatesQuery.isError ||
    sourceTemplateQuery.isError
  ) {
    return (
      <ManagementState
        kind="error"
        title={t('page.applicationWorkflowDesigner.loadFailed', '工作流加载失败')}
      />
    )
  }

  const application = (applicationsQuery.data ?? []).find((item) => item.id === applicationId)
  const binding = (bindingsQuery.data ?? []).find(
    (item) => item.id === bindingId && item.applicationId === applicationId,
  )
  if (!application || !binding) {
    return (
      <ManagementState
        kind="not-found"
        title={t('page.applicationWorkflowDesigner.environmentNotFound', '未找到应用环境')}
      />
    )
  }

  const boundTemplate = binding.workflowTemplate
  if (source === 'template' && !sourceTemplateQuery.data) {
    return (
      <ManagementState
        kind="not-found"
        title={t('page.applicationWorkflowDesigner.templateNotFound', '未找到所选工作流模板版本')}
      />
    )
  }
  const sourceTemplate =
    source === 'blank'
      ? undefined
      : source === 'template'
        ? sourceTemplateQuery.data
        : boundTemplate
  const initialName =
    searchParams.get('name')?.trim() ||
    boundTemplate?.name ||
    `${application.name}${t('page.applicationWorkflowDesigner.defaultNameSuffix', '工作流')}`

  return (
    <ApplicationWorkflowCanvas
      key={`${binding.id}:${source || 'edit'}:${sourceTemplate?.id || 'blank'}:${sourceTemplate?.publishedVersion || 0}`}
      applicationId={applicationId}
      binding={binding}
      boundTemplate={boundTemplate}
      initialName={initialName}
      sourceTemplate={sourceTemplate}
    />
  )
}
