import { Button, Card, Descriptions, Space, Tag, Timeline, Typography } from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ManagementDetailHeader, ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { isApiError } from '@/services/api-error'
import { formatDateTime } from '@/utils/time'
import { runtimeDetailQueries } from '../queries'
import type {
  ApplicationEnvironment,
  BuildRecord,
  DeliveryRuntimeKind,
  DeliveryRuntimeRecord,
  DeliveryEnvironment,
  DeliveryApplicationBindingSummary,
  ExecutionTask,
  ExecutionArtifact,
  ReleaseBundle,
  ReleaseRecord,
  RuntimeObjectDetail,
  RuntimeObjectLinks,
  RuntimeObjectPermissions,
  WorkflowRun,
  DeliveryApplicationDetail,
} from '../types'

const { Paragraph, Text } = Typography

type RuntimeKind = DeliveryRuntimeKind
type RuntimeRecord = DeliveryRuntimeRecord

type RuntimeEnvironment = DeliveryApplicationBindingSummary | undefined

type ExecutionLogItem = { id: string; logLevel: string; message: string; createdAt: string }

const DEFAULT_RUNTIME_PERMISSIONS: RuntimeObjectPermissions = {
  canViewArtifacts: false,
  canViewAudit: false,
  canViewOperations: false,
}

function runtimeKindLabel(kind: RuntimeKind) {
  switch (kind) {
    case 'build':
      return 'Build'
    case 'workflow':
      return 'Workflow Run'
    case 'release':
      return 'Release'
    case 'release_bundle':
      return 'Release Bundle'
    case 'execution_task':
      return 'Execution Task'
  }
}

function runtimeKindTitle(kind: RuntimeKind) {
  switch (kind) {
    case 'build':
      return '构建详情'
    case 'workflow':
      return '工作流详情'
    case 'release':
      return '发布详情'
    case 'release_bundle':
      return '版本包详情'
    case 'execution_task':
      return '执行任务详情'
  }
}

function runtimeStatus(record: RuntimeRecord | undefined) {
  if (!record) return 'unknown'
  return record.status || 'unknown'
}

function renderMetadata(value?: Record<string, unknown>) {
  const text = value && Object.keys(value).length > 0 ? JSON.stringify(value, null, 2) : ''
  return text ? (
    <pre className="soha-system-json-block">{text}</pre>
  ) : (
    <ManagementState
      bordered={false}
      compact
      title="暂无元数据"
      description="当前对象没有附加元数据。"
    />
  )
}

function runtimeListPath(kind: RuntimeKind) {
  switch (kind) {
    case 'build':
      return '/applications'
    case 'workflow':
      return '/workflows'
    case 'release':
      return '/releases'
    case 'release_bundle':
      return '/delivery/release-bundles'
    case 'execution_task':
      return '/delivery/execution-tasks'
  }
}

function isNotFoundError(error: unknown) {
  return isApiError(error) && error.status === 404
}

function compactApplicationName(detail?: DeliveryApplicationDetail) {
  return detail?.application.name || detail?.application.key || detail?.application.id || '-'
}

function bindingEnvironmentName(environment?: DeliveryEnvironment) {
  return environment?.name || environment?.key || environment?.id || ''
}

function buildRuntimeBindingSummary(
  kind: RuntimeKind,
  record: RuntimeRecord,
  binding?: ApplicationEnvironment,
  environment?: DeliveryEnvironment,
  runtimeDetail?: RuntimeObjectDetail<RuntimeRecord>,
): DeliveryApplicationBindingSummary | undefined {
  if (!binding) return undefined
  const summary: DeliveryApplicationBindingSummary = {
    applicationEnvironmentId: binding.id,
    environmentId: binding.environmentId,
    environmentName: bindingEnvironmentName(environment),
    environmentKey: environment?.key || binding.environmentKey,
    actionKind: binding.releasePolicy?.actionKind,
    requiresApproval: Boolean(
      environment?.requiresApproval || binding.releasePolicy?.requiresApproval,
    ),
    workflowTemplateId: runtimeDetail?.workflowTemplate?.id || binding.workflowTemplateId,
    workflowTemplateName: runtimeDetail?.workflowTemplate?.name,
    workflowTemplate: runtimeDetail?.workflowTemplate || binding.workflowTemplate,
    targetCount: binding.targets?.length ?? 0,
    targets: binding.targets,
    buildSourceId: runtimeDetail?.buildSource?.id || binding.buildPolicy?.sourceId,
    buildSource: runtimeDetail?.buildSource,
    buildPolicy: binding.buildPolicy,
  }
  if (kind === 'build') summary.latestBuild = record as BuildRecord
  if (kind === 'workflow') summary.latestWorkflow = record as WorkflowRun
  if (kind === 'release') summary.latestRelease = record as ReleaseRecord
  if (kind === 'release_bundle') summary.latestBundle = record as ReleaseBundle
  if (kind === 'execution_task') summary.latestExecutionTask = record as ExecutionTask
  return summary
}

function buildApplicationDetailFromRuntime(
  kind: RuntimeKind,
  runtimeDetail?: RuntimeObjectDetail<RuntimeRecord>,
): DeliveryApplicationDetail | undefined {
  const record = runtimeDetail?.object
  const application = runtimeDetail?.application
  if (!record || !application) return undefined
  const binding = buildRuntimeBindingSummary(
    kind,
    record,
    runtimeDetail.binding,
    runtimeDetail.environment,
    runtimeDetail,
  )
  const detail: DeliveryApplicationDetail = {
    application,
    bindings: binding ? [binding] : [],
  }
  if (kind === 'build') detail.latestBuild = record as BuildRecord
  if (kind === 'workflow') detail.latestWorkflow = record as WorkflowRun
  if (kind === 'release') detail.latestRelease = record as ReleaseRecord
  if (kind === 'release_bundle') detail.latestBundle = record as ReleaseBundle
  if (kind === 'execution_task') detail.latestExecutionTask = record as ExecutionTask
  return detail
}

function findMatchedBinding(
  detail?: DeliveryApplicationDetail,
  record?: RuntimeRecord,
  runtimeKind?: RuntimeKind,
) {
  const bindings = detail?.bindings ?? []
  if (!bindings.length) return undefined
  const directEnvironmentId =
    (record as ReleaseBundle | ExecutionTask | undefined)?.applicationEnvironmentId ||
    (record as ReleaseRecord | undefined)?.metadata?.applicationEnvironmentId ||
    ''
  if (directEnvironmentId) {
    const directMatch = bindings.find(
      (binding) => binding.applicationEnvironmentId === directEnvironmentId,
    )
    if (directMatch) return directMatch
  }
  const recordId = record?.id
  if (!recordId) return undefined
  return bindings.find((binding) => {
    if (binding.latestBuild?.id === recordId) return true
    if (binding.latestWorkflow?.id === recordId) return true
    if (binding.latestRelease?.id === recordId) return true
    if (binding.latestBundle?.id === recordId) return true
    if (binding.latestExecutionTask?.id === recordId) return true
    if (
      runtimeKind === 'workflow' &&
      binding.workflowTemplate?.name &&
      binding.latestWorkflow?.workflowName === (record as WorkflowRun)?.workflowName
    )
      return true
    return false
  })
}

function runtimeTemplateLabel(
  detail?: DeliveryApplicationDetail,
  record?: RuntimeRecord,
  runtimeKind?: RuntimeKind,
) {
  const binding = findMatchedBinding(detail, record, runtimeKind)
  if (binding?.workflowTemplate?.name) return binding.workflowTemplate.name
  if (binding?.workflowTemplateName) return binding.workflowTemplateName
  if (binding?.buildSource?.name) return binding.buildSource.name
  if (binding?.buildSourceId) return binding.buildSourceId
  return '-'
}

function runtimeEnvironmentLabel(
  detail?: DeliveryApplicationDetail,
  record?: RuntimeRecord,
  runtimeKind?: RuntimeKind,
) {
  const binding = findMatchedBinding(detail, record, runtimeKind)
  if (binding?.environmentName) return binding.environmentName
  if (binding?.environmentKey) return binding.environmentKey
  if (binding?.environmentId) return binding.environmentId
  return (record as ReleaseBundle | ExecutionTask | undefined)?.applicationEnvironmentId || '-'
}

function runtimeEnvironment(
  detail?: DeliveryApplicationDetail,
  record?: RuntimeRecord,
  runtimeKind?: RuntimeKind,
): RuntimeEnvironment {
  const binding = findMatchedBinding(detail, record, runtimeKind)
  return binding
}

function runtimeAuditPath(kind: RuntimeKind, id: string) {
  const metadataKey = `runtime.${kind}.id`
  return `/system/audit?metadataKey=${encodeURIComponent(metadataKey)}&metadataValue=${encodeURIComponent(id)}`
}

function runtimeOperationPath(kind: RuntimeKind, id: string) {
  const metadataKey = `runtime.${kind}.id`
  return `/system/operations?metadataKey=${encodeURIComponent(metadataKey)}&metadataValue=${encodeURIComponent(id)}`
}

function runtimeApplicationPath(applicationId: string, focus?: Record<string, string>) {
  const params = new URLSearchParams({ tab: 'delivery', ...focus })
  return `/applications/${encodeURIComponent(applicationId)}?${params.toString()}`
}

function runtimeSummaryItems(
  kind: RuntimeKind,
  record: RuntimeRecord | undefined,
  detail?: DeliveryApplicationDetail,
  runtimeDetail?: RuntimeObjectDetail<RuntimeRecord>,
) {
  const binding = runtimeEnvironment(detail, record, kind)
  return [
    { key: 'application', label: '应用', children: compactApplicationName(detail) },
    { key: 'environment', label: '环境', children: runtimeEnvironmentLabel(detail, record, kind) },
    { key: 'template', label: '模板 / 来源', children: runtimeTemplateLabel(detail, record, kind) },
    { key: 'binding', label: '绑定 ID', children: binding?.applicationEnvironmentId || '-' },
    {
      key: 'templateId',
      label: '模板 ID',
      children: binding?.workflowTemplateId || binding?.buildSourceId || '-',
    },
    {
      key: 'artifactCount',
      label: 'Artifacts',
      children:
        runtimeDetail?.artifacts?.length ?? String(runtimeDetail?.evidence?.artifactCount ?? '-'),
    },
  ]
}

function buildTimelineItems(
  items: Array<{
    id: unknown
    title: unknown
    status: unknown
    summary?: unknown
    createdAt?: unknown
  }>,
) {
  return items.map((item, index) => {
    const id = String(item.id || index)
    const title = String(item.title || id)
    const status = String(item.status || 'unknown')
    const summary = item.summary === undefined || item.summary === null ? '' : String(item.summary)
    const createdAt =
      item.createdAt === undefined || item.createdAt === null ? '' : String(item.createdAt)
    return {
      key: id,
      content: (
        <Space orientation="vertical" size={0}>
          <Text strong>{title}</Text>
          <Text type="secondary">
            {status}
            {summary ? ` · ${summary}` : ''}
          </Text>
          {createdAt ? <Text type="secondary">{formatDateTime(createdAt)}</Text> : null}
        </Space>
      ),
      color: status === 'failed' ? 'red' : status === 'running' ? 'blue' : 'green',
    }
  })
}

function runtimeAssociationHints(
  kind: RuntimeKind,
  record: RuntimeRecord | undefined,
  links?: RuntimeObjectLinks,
  navigate?: (path: string) => void,
) {
  if (!record) return null
  const applicationPath =
    links?.application ||
    (kind === 'build'
      ? runtimeApplicationPath(record.applicationId, { buildId: record.id })
      : kind === 'workflow'
        ? runtimeApplicationPath(record.applicationId, { workflowRunId: record.id })
        : kind === 'release'
          ? runtimeApplicationPath(record.applicationId, { releaseId: record.id })
          : kind === 'release_bundle'
            ? runtimeApplicationPath(record.applicationId, { releaseBundleId: record.id })
            : runtimeApplicationPath(record.applicationId, { executionTaskId: record.id }))
  return (
    <Space wrap size={[8, 8]}>
      <Button icon={<LinkOutlined />} onClick={() => navigate?.(applicationPath)}>
        打开应用运行态
      </Button>
      <Button
        icon={<LinkOutlined />}
        onClick={() => navigate?.(links?.audit || runtimeAuditPath(kind, record.id))}
      >
        审计日志
      </Button>
      <Button
        icon={<LinkOutlined />}
        onClick={() => navigate?.(links?.operations || runtimeOperationPath(kind, record.id))}
      >
        操作日志
      </Button>
      {links?.artifacts ? (
        <Button icon={<LinkOutlined />} onClick={() => navigate?.(links.artifacts!)}>
          Artifacts
        </Button>
      ) : null}
    </Space>
  )
}

function RuntimeHeader({
  kind,
  record,
  detail,
}: {
  kind: RuntimeKind
  record?: RuntimeRecord
  detail?: DeliveryApplicationDetail
}) {
  return (
    <Space wrap size={[8, 8]}>
      <Tag
        color={
          runtimeStatus(record) === 'failed'
            ? 'red'
            : runtimeStatus(record) === 'running'
              ? 'blue'
              : 'green'
        }
      >
        {runtimeStatus(record)}
      </Tag>
      <Tag>{compactApplicationName(detail)}</Tag>
      <Tag>{runtimeEnvironmentLabel(detail, record, kind)}</Tag>
      <Tag>{runtimeTemplateLabel(detail, record, kind)}</Tag>
    </Space>
  )
}

function renderArtifactTimeline(
  artifacts?: ExecutionArtifact[],
  emptyDescription = '当前对象没有返回可展示的制品。',
) {
  return artifacts?.length ? (
    <Timeline
      items={buildTimelineItems(
        artifacts.map((artifact, index) => ({
          id:
            artifact.id ||
            `${artifact.kind}:${artifact.name || artifact.ref || artifact.digest || index}`,
          title: `${artifact.kind}${artifact.name ? ` · ${artifact.name}` : ''}`,
          status: artifact.status || 'available',
          summary:
            artifact.ref || artifact.digest || artifact.path || artifact.workflowNodeId || '-',
          createdAt: artifact.createdAt || artifact.updatedAt || artifact.modifiedAt,
        })),
      )}
    />
  ) : (
    <ManagementState bordered={false} compact title="暂无制品" description={emptyDescription} />
  )
}

function RuntimeEvidenceCard({
  kind,
  record,
  navigate,
  links,
  bundleArtifacts,
  executionArtifacts,
  executionLogs,
}: {
  kind: RuntimeKind
  record?: RuntimeRecord
  links?: RuntimeObjectLinks
  bundleArtifacts?: ExecutionArtifact[]
  executionArtifacts?: ExecutionArtifact[]
  executionLogs?: ExecutionLogItem[]
  navigate?: (path: string) => void
}) {
  if (!record) return null
  if (kind === 'workflow') {
    const workflow = record as WorkflowRun
    const timelineItems = buildTimelineItems(
      (workflow.nodeRuns?.length ? workflow.nodeRuns : workflow.steps).map((item, index) => ({
        id: ('nodeId' in item ? item.nodeId : '') || `${item.name || 'step'}:${index}`,
        title: item.name || ('nodeId' in item ? item.nodeId : `step-${index + 1}`),
        status: item.status,
        summary: item.summary,
      })),
    )
    return (
      <Card title="关键证据" className="soha-detail-card" size="small">
        <Timeline items={timelineItems} />
        <Paragraph className="soha-detail-card__paragraph" type="secondary">
          {workflow.clusterId || workflow.namespace || workflow.deploymentName
            ? `${workflow.clusterId || '-'} / ${workflow.namespace || '-'} / ${workflow.deploymentName || '-'}`
            : '没有额外运行证据。'}
        </Paragraph>
        <Text strong>制品</Text>
        {renderArtifactTimeline(executionArtifacts, '该工作流没有返回 artifact store 明细。')}
        {runtimeAssociationHints(kind, record, links, navigate)}
      </Card>
    )
  }
  if (kind === 'release_bundle') {
    const bundle = record as ReleaseBundle
    return (
      <Card title="关键证据" className="soha-detail-card" size="small">
        <Space orientation="vertical" size={6}>
          <Text strong>Artifact</Text>
          <Text>{bundle.artifactRef || '-'}</Text>
          <Text type="secondary">Digest: {bundle.artifactDigest || '-'}</Text>
          {renderArtifactTimeline(bundleArtifacts, '该版本包没有单独的制品明细。')}
        </Space>
        {runtimeAssociationHints(kind, record, links, navigate)}
      </Card>
    )
  }
  if (kind === 'execution_task') {
    const task = record as ExecutionTask
    return (
      <Card title="关键证据" className="soha-detail-card" size="small">
        <Space orientation="vertical" size={8}>
          <Text strong>日志</Text>
          {executionLogs?.length ? (
            <Timeline
              items={buildTimelineItems(
                executionLogs.map((item) => ({
                  id: item.id,
                  title: item.logLevel,
                  status: item.logLevel,
                  summary: item.message,
                  createdAt: item.createdAt,
                })),
              )}
            />
          ) : (
            <ManagementState
              bordered={false}
              compact
              title="暂无日志"
              description="该执行任务没有返回可展示的日志。"
            />
          )}
          <Text strong>制品</Text>
          {renderArtifactTimeline(executionArtifacts, '该执行任务没有返回可展示的制品。')}
          <Text type="secondary">
            {task.releaseBundleId ? `releaseBundleId=${task.releaseBundleId}` : '没有关联版本包'}
          </Text>
        </Space>
        {runtimeAssociationHints(kind, record, links, navigate)}
      </Card>
    )
  }
  return (
    <Card title="关键证据" className="soha-detail-card" size="small">
      {renderMetadata((record as BuildRecord | ReleaseRecord).metadata)}
      {runtimeAssociationHints(kind, record, links, navigate)}
    </Card>
  )
}

export function RuntimeDetailPage({ kind }: { kind: RuntimeKind }) {
  const navigate = useNavigate()
  const params = useParams()
  const recordId = String(
    params[
      kind === 'build'
        ? 'buildId'
        : kind === 'workflow'
          ? 'workflowId'
          : kind === 'release'
            ? 'releaseId'
            : kind === 'release_bundle'
              ? 'releaseBundleId'
              : 'executionTaskId'
    ] || '',
  ).trim()

  const runtimeDetailQuery = useQuery(runtimeDetailQueries.detail(kind, recordId))

  if (!recordId) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={`${runtimeKindLabel(kind)} unknown 未找到`}
        />
      </div>
    )
  }
  if (runtimeDetailQuery.isLoading) {
    return (
      <div className="soha-page">
        <ManagementState kind="loading" />
      </div>
    )
  }
  if (runtimeDetailQuery.isError && isNotFoundError(runtimeDetailQuery.error)) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={`${runtimeKindLabel(kind)} ${recordId || 'unknown'} 未找到`}
        />
      </div>
    )
  }
  if (runtimeDetailQuery.isError) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="error"
          description={
            runtimeDetailQuery.error instanceof Error
              ? runtimeDetailQuery.error.message
              : '加载运行态详情失败'
          }
        />
      </div>
    )
  }

  const runtimeDetail = runtimeDetailQuery.data
  const record = runtimeDetail?.object
  if (!record) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="not-found"
          description={`${runtimeKindLabel(kind)} ${recordId || 'unknown'} 未找到`}
        />
      </div>
    )
  }

  const applicationDetail = buildApplicationDetailFromRuntime(kind, runtimeDetail)
  const runtimeArtifacts = runtimeDetail?.artifacts ?? []
  const bundleArtifacts = kind === 'release_bundle' ? runtimeArtifacts : undefined
  const executionArtifacts =
    kind === 'execution_task' || kind === 'workflow' ? runtimeArtifacts : undefined
  const executionLogs = Array.isArray(runtimeDetail?.evidence?.logs)
    ? (runtimeDetail.evidence.logs as ExecutionLogItem[])
    : undefined
  const links = runtimeDetail?.links
  const permissions = runtimeDetail?.permissions ?? DEFAULT_RUNTIME_PERMISSIONS

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title={`${runtimeKindTitle(kind)} · ${record.id}`}
        description="直达运行态对象详情，展示关联应用、环境、模板和关键证据。"
        meta={<RuntimeHeader kind={kind} record={record} detail={applicationDetail} />}
        actions={<Button onClick={() => navigate(runtimeListPath(kind))}>返回列表</Button>}
      />
      <Card className="soha-detail-card" title="基础信息" size="small">
        <Descriptions
          column={2}
          items={[
            { key: 'id', label: '对象 ID', children: record.id },
            { key: 'kind', label: '类型', children: runtimeKindLabel(kind) },
            { key: 'status', label: '状态', children: <StatusTag value={record.status} /> },
            {
              key: 'application',
              label: '关联应用',
              children: compactApplicationName(applicationDetail),
            },
            {
              key: 'environment',
              label: '关联环境',
              children: runtimeEnvironmentLabel(applicationDetail, record, kind),
            },
            {
              key: 'template',
              label: '关联模板/来源',
              children: runtimeTemplateLabel(applicationDetail, record, kind),
            },
            {
              key: 'createdAt',
              label: '创建时间',
              children: formatDateTime(
                (
                  record as
                    | BuildRecord
                    | ReleaseRecord
                    | ReleaseBundle
                    | ExecutionTask
                    | WorkflowRun
                ).createdAt,
              ),
            },
            {
              key: 'updatedAt',
              label: '更新时间',
              children: formatDateTime(
                (record as WorkflowRun | ReleaseBundle | ExecutionTask).updatedAt ||
                  (record as ReleaseRecord).deployedAt ||
                  (record as BuildRecord).finishedAt ||
                  (record as BuildRecord).startedAt ||
                  (record as ReleaseRecord).createdAt,
              ),
            },
          ]}
        />
      </Card>
      <Card className="soha-detail-card" title="关联信息" size="small">
        <Descriptions
          column={2}
          items={runtimeSummaryItems(kind, record, applicationDetail, runtimeDetail).map(
            (item) => ({
              key: item.key,
              label: item.label,
              children: item.children,
            }),
          )}
        />
        <Space wrap size={[8, 8]} style={{ marginTop: 16 }}>
          <Button
            icon={<LinkOutlined />}
            onClick={() =>
              navigate(
                links?.application ||
                  runtimeApplicationPath(
                    record.applicationId,
                    kind === 'build'
                      ? { buildId: record.id }
                      : kind === 'workflow'
                        ? { workflowRunId: record.id }
                        : kind === 'release'
                          ? { releaseId: record.id }
                          : kind === 'release_bundle'
                            ? { releaseBundleId: record.id }
                            : { executionTaskId: record.id },
                  ),
              )
            }
          >
            打开应用运行态
          </Button>
          <Button
            disabled={!permissions.canViewAudit}
            icon={<LinkOutlined />}
            onClick={() => navigate(links?.audit || runtimeAuditPath(kind, record.id))}
          >
            审计日志
          </Button>
          <Button
            disabled={!permissions.canViewOperations}
            icon={<LinkOutlined />}
            onClick={() => navigate(links?.operations || runtimeOperationPath(kind, record.id))}
          >
            操作日志
          </Button>
          <Button
            disabled={!permissions.canViewArtifacts || !links?.artifacts}
            icon={<LinkOutlined />}
            onClick={() => links?.artifacts && navigate(links.artifacts)}
          >
            Artifacts
          </Button>
        </Space>
      </Card>
      {kind === 'workflow' || kind === 'release_bundle' || kind === 'execution_task' ? (
        <RuntimeEvidenceCard
          kind={kind}
          record={record}
          links={links}
          bundleArtifacts={bundleArtifacts}
          executionArtifacts={executionArtifacts}
          executionLogs={executionLogs}
          navigate={navigate}
        />
      ) : (
        <Card className="soha-detail-card" title="关键证据" size="small">
          {renderMetadata((record as BuildRecord | ReleaseRecord).metadata)}
          {runtimeAssociationHints(kind, record, links, navigate)}
        </Card>
      )}
      {kind === 'workflow' ? (
        <Card className="soha-detail-card" title="流程节点" size="small">
          <Timeline
            items={
              (record as WorkflowRun).nodeRuns?.map((node) => ({
                key: node.nodeId,
                content: (
                  <Space orientation="vertical" size={0}>
                    <Text strong>{node.name}</Text>
                    <Text type="secondary">
                      {node.status}
                      {node.summary ? ` · ${node.summary}` : ''}
                    </Text>
                  </Space>
                ),
              })) ?? []
            }
          />
        </Card>
      ) : null}
    </div>
  )
}
