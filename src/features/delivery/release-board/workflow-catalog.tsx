import { lazy, Suspense, useState } from 'react'
import { Button, Card, Form, Pagination, Select, Space, Typography } from 'antd'
import {
  HistoryOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ManagementIconButton,
  ManagementState,
  ManagementKeywordField,
  ManagementQueryField,
  ManagementQueryGrid,
  ManagementRefreshButton,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { applicationWorkspacePath } from '../applications/workspace-navigation'
import { deliveryQueries } from '../queries'
import { TemplateSourcesButton } from '../template-sources/entry'
import type {
  DeliveryWorkflowDefinition,
  DeliveryBatchTemplateDefinition,
  WorkflowCatalogEntry,
} from '../types'
import { deliveryModeLabels } from '../batches/model'
import { definitionHistoryPath, ExecutionTrend } from './execution-trend'
import './styles.css'

const DeliveryBatchEditor = lazy(() =>
  import('../batches/editor').then((module) => ({ default: module.DeliveryBatchEditor })),
)
const ImportDialog = lazy(() =>
  import('../documents/import-dialog').then((module) => ({
    default: module.DeliveryDocumentImportDialog,
  })),
)

function definitionPath(card: WorkflowCatalogEntry, run = false) {
  const scope = card.scopes[0]
  const path = applicationWorkspacePath(
    scope.applicationId,
    card.sourceKind === 'build_source' && !run ? 'application' : 'delivery',
    scope.applicationEnvironmentId,
  )
  return card.sourceKind === 'build_source'
    ? path + '&buildSourceId=' + encodeURIComponent(card.sourceId)
    : path
}

export function WorkflowCatalog() {
  const [urlSearch, setURLSearch] = useSearchParams()
  const navigate = useNavigate()
  const english = useI18n().localeCode === 'en_US'
  const permissionQuery = usePermissionSnapshot()
  const permissions = permissionQuery.data?.data
  const canViewWorkflows = hasPermission(permissions, 'delivery.workflows.view')
  const canViewBuilds = hasPermission(permissions, 'delivery.applications.view')
  const canBuild = canViewBuilds && hasPermission(permissions, 'delivery.builds.trigger')
  const canManage = canViewWorkflows && hasPermission(permissions, 'delivery.workflows.trigger')
  const [importing, setImporting] = useState(false)
  const applicationId = urlSearch.get('applicationId') || undefined
  const environmentId = urlSearch.get('environmentId') || undefined
  const search = urlSearch.get('search') || ''
  const requestedPage = Number(urlSearch.get('page'))
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const updateSearch = (values: Record<string, string | undefined>, resetPage = true) =>
    setURLSearch(
      (current) => {
        const next = new URLSearchParams(current)
        if (resetPage) next.delete('page')
        for (const [key, value] of Object.entries(values)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  const editId = urlSearch.get('workflowId') || ''
  const requestedWorkflow = useQuery(
    deliveryQueries.deliveryWorkflows.detail(editId, canViewWorkflows && Boolean(editId)),
  )
  const catalog = useQuery(
    deliveryQueries.workflowCatalog(
      { applicationId, environmentId, search, offset: (page - 1) * 12, limit: 12 },
      canViewBuilds || canViewWorkflows,
    ),
  )
  const requestedTemplateId = urlSearch.get('templateId') ?? ''
  const requestedVersion = Number(urlSearch.get('templateVersion'))
  const creating = urlSearch.get('create') === 'workflow'
  const creatingFromTemplate = creating && Boolean(requestedTemplateId)
  const validVersion = Number.isSafeInteger(requestedVersion) && requestedVersion > 0
  const templateHead = useQuery(
    deliveryQueries.workflowTemplates.detail(
      requestedTemplateId,
      canManage && creatingFromTemplate,
    ),
  )
  const requestedTemplate = useQuery(
    deliveryQueries.workflowTemplates.version(
      requestedTemplateId,
      validVersion ? requestedVersion : 0,
      canManage && creatingFromTemplate && validVersion,
    ),
  )
  const invalidTemplate =
    creatingFromTemplate &&
    (!validVersion ||
      templateHead.data?.publicationState === 'deprecated' ||
      templateHead.data?.enabled === false ||
      (requestedTemplate.data && requestedTemplate.data.definition?.mode !== 'delivery_batch'))
  const recipe = requestedTemplate.data?.definition as DeliveryBatchTemplateDefinition | undefined
  const initialDefinition: DeliveryWorkflowDefinition | undefined =
    recipe && !invalidTemplate
      ? {
          name: requestedTemplate.data!.name,
          workflowTemplateId: requestedTemplateId,
          workflowTemplateVersion: requestedVersion,
          mode: recipe.executionMode,
          stopOnFailure: recipe.stopOnFailure,
          maxConcurrency: recipe.maxConcurrency,
          targets: [],
        }
      : undefined
  const editor =
    requestedWorkflow.data && editId
      ? { workflow: requestedWorkflow.data, initialDefinition: undefined }
      : creating &&
          (!creatingFromTemplate || (initialDefinition && templateHead.data)) &&
          !invalidTemplate
        ? { workflow: undefined, initialDefinition }
        : undefined
  const closeEditor = () => {
    updateSearch(
      {
        workflowId: undefined,
        create: undefined,
        templateId: undefined,
        templateVersion: undefined,
      },
      false,
    )
    void catalog.refetch()
  }
  const openDefinition = (card: WorkflowCatalogEntry, run: boolean) => {
    if (card.sourceKind !== 'delivery_workflow') {
      navigate(
        definitionPath(card, run) +
          (run ? '&launch=' + (card.sourceKind === 'build_source' ? 'build' : 'workflow') : ''),
      )
      return
    }
    updateSearch({ workflowId: card.sourceId, create: undefined }, false)
  }
  if (permissionQuery.isLoading) return <ManagementState kind="loading" />
  if (permissionQuery.isError)
    return (
      <ManagementState
        kind="error"
        title={english ? 'Permissions unavailable' : '权限加载失败'}
        actions={
          <Button onClick={() => void permissionQuery.refetch()}>
            {english ? 'Retry' : '重试'}
          </Button>
        }
      />
    )
  return (
    <section
      aria-label={english ? 'All workflows' : '全部工作流'}
      className="soha-workflow-catalog"
    >
      {invalidTemplate ? (
        <ManagementState compact kind="error" title="模板版本不可用于创建工作流" />
      ) : null}
      {requestedTemplate.isError || templateHead.isError ? (
        <ManagementState
          compact
          kind="error"
          title="流程模板版本读取失败"
          actions={
            <Button
              onClick={() => {
                void requestedTemplate.refetch()
                void templateHead.refetch()
              }}
            >
              重试
            </Button>
          }
        />
      ) : null}
      {editId && requestedWorkflow.isError ? (
        <ManagementState
          compact
          kind="error"
          title={english ? 'Failed to load workflow' : '工作流读取失败'}
          actions={
            <Space>
              <Button onClick={() => void requestedWorkflow.refetch()}>
                {english ? 'Retry' : '重试'}
              </Button>
              <Button onClick={closeEditor}>{english ? 'Close' : '关闭'}</Button>
            </Space>
          }
        />
      ) : editId && requestedWorkflow.isPending ? (
        <ManagementState compact kind="loading" />
      ) : null}
      <Form className="soha-management-query-form" layout="horizontal">
        <ManagementQueryGrid
          actions={
            <Button
              onClick={() =>
                updateSearch({
                  search: undefined,
                  applicationId: undefined,
                  environmentId: undefined,
                })
              }
            >
              {english ? 'Reset' : '重置'}
            </Button>
          }
        >
          <ManagementKeywordField
            inputProps={{ 'aria-label': '搜索工作流' }}
            value={search}
            placeholder={english ? 'Search name or application' : '搜索名称或应用'}
            onChange={(value) => updateSearch({ search: value })}
          />
          <ManagementQueryField label={english ? 'Application' : '应用'} width={220}>
            <Select
              aria-label="筛选应用"
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              placeholder={english ? 'All applications' : '全部应用'}
              value={applicationId}
              options={catalog.data?.applications ?? []}
              onChange={(value) => updateSearch({ applicationId: value, environmentId: undefined })}
            />
          </ManagementQueryField>
          <ManagementQueryField label={english ? 'Environment' : '环境'} width={220}>
            <Select
              aria-label="筛选环境"
              allowClear
              placeholder={english ? 'All environments' : '全部环境'}
              value={environmentId}
              options={catalog.data?.environments ?? []}
              onChange={(value) => updateSearch({ environmentId: value })}
            />
          </ManagementQueryField>
        </ManagementQueryGrid>
      </Form>
      <div className="soha-workflow-catalog__toolbar">
        {canManage ? (
          <Space wrap className="soha-workflow-catalog__actions">
            <TemplateSourcesButton />
            <Button onClick={() => setImporting(true)}>
              {english ? 'Import file' : '导入文件'}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() =>
                updateSearch(
                  {
                    create: 'workflow',
                    workflowId: undefined,
                    templateId: undefined,
                    templateVersion: undefined,
                  },
                  false,
                )
              }
            >
              {english ? 'New workflow' : '新建工作流'}
            </Button>
          </Space>
        ) : null}
        <ManagementRefreshButton
          tooltip="刷新"
          aria-label={english ? 'Refresh workflows' : '刷新工作流'}
          loading={catalog.isFetching}
          onClick={() => void catalog.refetch()}
        />
      </div>
      <div
        className="soha-execution-trend__legend"
        aria-label={english ? 'Execution status legend' : '执行状态图例'}
      >
        <span className="soha-execution-trend--success">● {english ? 'Success' : '成功'}</span>
        <span className="soha-execution-trend--danger">● {english ? 'Failed' : '失败'}</span>
        <span className="soha-execution-trend--primary">● {english ? 'Running' : '运行中'}</span>
        <span className="soha-execution-trend--warning">● {english ? 'Approval' : '待审批'}</span>
        <span className="soha-execution-trend--neutral">● {english ? 'Canceled' : '已取消'}</span>
        <span>
          {english
            ? 'Older → Newer · Unknown durations use equal heights'
            : '旧 → 新 · 耗时未知时等高展示'}
        </span>
      </div>
      {!canViewBuilds && !canViewWorkflows ? (
        <ManagementState compact kind="no-permission" />
      ) : catalog.isPending ? (
        <ManagementState compact kind="loading" title="正在读取工作流" />
      ) : catalog.isError ? (
        <ManagementState
          compact
          kind="error"
          title="工作流加载失败"
          actions={<Button onClick={() => void catalog.refetch()}>重试</Button>}
        />
      ) : (
        <>
          <div className="soha-workflow-catalog__list" role="list">
            {catalog.data.items.map((card) => {
              const build = card.sourceKind === 'build_source'
              const appNames = [...new Set(card.scopes.map((scope) => scope.applicationName))].join(
                '、',
              )
              const context =
                card.sourceKind === 'delivery_workflow'
                  ? deliveryModeLabels[card.context as keyof typeof deliveryModeLabels] ||
                    card.context
                  : build
                    ? card.context
                    : card.scopes[0]?.environmentName
              const canRun = build
                ? canBuild
                : canManage && (card.sourceKind === 'delivery_workflow' || canBuild)
              return (
                <Card
                  size="small"
                  key={card.id}
                  role="listitem"
                  className="soha-workflow-definition"
                >
                  <div className="soha-workflow-definition__identity">
                    <div className="soha-workflow-catalog__card-heading">
                      <strong>{card.name}</strong>
                      {build ? <MetadataTag label={english ? 'Build only' : '仅构建'} /> : null}
                    </div>
                    <Typography.Text type="secondary">
                      {appNames} · {context}
                    </Typography.Text>
                    {!card.enabled ? <StatusTag value="disabled" /> : null}
                  </div>
                  <ExecutionTrend card={card} />
                  <div className="soha-workflow-catalog__card-actions">
                    <Space>
                      <ManagementIconButton
                        aria-label={english ? 'View history' : '查看记录'}
                        tooltip={english ? 'View history' : '查看记录'}
                        icon={<HistoryOutlined />}
                        onClick={() => navigate(definitionHistoryPath(card))}
                      />
                      <ManagementIconButton
                        aria-label={english ? 'Configure' : '配置'}
                        tooltip={english ? 'Configure' : '配置'}
                        icon={<SettingOutlined />}
                        loading={editId === card.sourceId && requestedWorkflow.isFetching}
                        onClick={() => openDefinition(card, false)}
                      />
                      {canRun && card.enabled ? (
                        <Button
                          type="primary"
                          icon={<PlayCircleOutlined />}
                          loading={editId === card.sourceId && requestedWorkflow.isFetching}
                          onClick={() => void openDefinition(card, true)}
                        >
                          {english ? 'Run' : '运行'}
                        </Button>
                      ) : null}
                    </Space>
                  </div>
                </Card>
              )
            })}
          </div>
          {!catalog.data.items.length ? (
            <ManagementState
              compact
              kind="not-configured"
              title={english ? 'No matching workflows' : '暂无匹配的工作流'}
            />
          ) : null}
          {catalog.data.total > 12 ? (
            <Pagination
              current={page}
              total={catalog.data.total}
              pageSize={12}
              showSizeChanger={false}
              onChange={(value) =>
                updateSearch({ page: value > 1 ? String(value) : undefined }, false)
              }
            />
          ) : null}
        </>
      )}
      {importing ? (
        <Suspense fallback={<ManagementState compact kind="loading" />}>
          <ImportDialog
            onClose={() => setImporting(false)}
            onImported={() => {
              void catalog.refetch()
            }}
          />
        </Suspense>
      ) : null}
      {editor ? (
        <Suspense fallback={<ManagementState compact kind="loading" />}>
          <DeliveryBatchEditor
            key={editor.workflow?.id || `${requestedTemplateId}/${requestedVersion}`}
            workflow={editor.workflow}
            initialDefinition={editor.initialDefinition}
            onSaved={(workflow) =>
              updateSearch(
                {
                  workflowId: workflow.id,
                  create: undefined,
                  templateId: undefined,
                  templateVersion: undefined,
                },
                false,
              )
            }
            onClose={closeEditor}
          />
        </Suspense>
      ) : null}
    </section>
  )
}
