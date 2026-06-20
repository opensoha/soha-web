import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Key } from 'react'
import { Alert, App, BorderBeam, Button, Card, Collapse, Descriptions, Dropdown, Form, Input, Modal, Popconfirm, Select, Space, Switch, Tabs, Tag, Timeline, Typography } from 'antd'
import { ApiOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, FileTextOutlined, LinkOutlined, MoreOutlined, PlayCircleOutlined, PlusOutlined, ReloadOutlined, RocketOutlined, SaveOutlined, StopOutlined } from '@ant-design/icons'
import type { BorderBeamGradient, MenuProps, TableColumnsType } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementSearchableListPane,
  ManagementState,
  TemplateDesignerShell,
} from '@/components/management-list'
import { DeliveryTable } from '@/features/delivery/delivery-table'
import { BooleanTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth/permission-snapshot'
import { useI18n } from '@/i18n'
import { api } from '@/services/api-client'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import {
  canCancelExecutionTask,
  canRetryExecutionTask,
  summarizeDeliveryBuildSignal,
  summarizeDeliveryValidationSignal,
  summarizeExecutionTaskArtifacts,
  summarizeExecutionTaskStatus,
  summarizeReleaseBundleArtifact,
  summarizeReleaseBundleStatus,
} from '@/features/delivery/delivery-status'
import {
  ApplicationCenterModals,
  defaultBuildSources,
  splitApplicationGroups,
  useApplicationCenterState,
} from '@/features/delivery/application-center-model'
import {
  TemplateUsageImpactPanel,
  shouldConfirmTemplateUsageSave,
  templateUsageConfirmText,
} from '@/features/delivery/template-usage-impact'
import type {
  ApiResponse,
  BuildSource,
  BuildTemplate,
  DeliveryApplication,
  DeliveryApplicationDetail,
  ExecutionArtifact,
  ExecutionTask,
  ReleaseBoardEntry,
  ReleaseBundle,
  TemplateUsageSummary,
  WorkflowNodeRun,
  WorkflowRun,
} from '@/types'

const { Text } = Typography
type ColumnProps<T> = TableColumnsType<T>[number]
type ApplicationBindingRow = NonNullable<DeliveryApplicationDetail['bindings']>[number]
type JsonObject = Record<string, unknown>
type ApplicationWorkspaceCard = {
  app: DeliveryApplication
  bindings: ReleaseBoardEntry[]
  deliverySignal: { color: string; label: string }
  gateSignal: { color: string; label: string }
  activeTargets: number
  serviceClues: number
  latestEnvironmentName: string
}

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
  return String(raw || '').split('\n').map((item) => item.trim()).filter(Boolean)
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

function extractBuildTemplateVariables(template: Pick<BuildTemplate, 'variableSchema' | 'defaultVariables'> | undefined): BuildTemplateVariableFormValue[] {
  if (!template?.variableSchema || typeof template.variableSchema !== 'object' || Array.isArray(template.variableSchema)) return []
  return Object.entries(template.variableSchema).map(([key, value]) => {
    const spec = value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
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

function defaultBuildTemplateValues(key = `build-template-${Date.now().toString(36)}`): BuildTemplateFormValues {
  return {
    key,
    name: '新建构建模板',
    description: '',
    builderKind: 'docker',
    dockerfileTemplate: 'FROM node:22-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n',
    buildCommandsText: 'npm ci\nnpm run build',
    variableSchemaText: '{}',
    defaultVariablesText: '{}',
    variables: [
      { key: 'imageTag', label: '镜像 Tag', type: 'string', required: true, defaultValue: 'latest', description: '默认镜像标签' },
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

function buildBuildTemplatePayloadFromDesigner(values: BuildTemplateFormValues): BuildTemplatePayload {
  const variables = values.variables ?? []
  const hasStructuredVariables = variables.some((item) => trimFormString(item.key))
  return {
    key: values.key,
    name: values.name,
    description: values.description,
    builderKind: values.builderKind,
    dockerfileTemplate: values.dockerfileTemplate,
    buildCommands: splitLines(values.buildCommandsText),
    variableSchema: hasStructuredVariables ? buildTemplateVariableSchema(variables) : parseJSONObject(values.variableSchemaText, '变量 Schema'),
    defaultVariables: hasStructuredVariables ? buildTemplateDefaultVariables(variables) : parseJSONObject(values.defaultVariablesText, '默认变量'),
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

function summarizeBuildSource(source?: BuildSource) {
  if (!source) return '-'
  switch (source.type) {
    case 'repo_dockerfile':
      return 'Repo Dockerfile'
    case 'platform_build_template':
      return 'Platform Template'
    case 'external_pipeline':
      return 'External Pipeline'
    default:
      return source.type
  }
}

function renderTargetSummary(targets?: ApplicationBindingRow['targets']) {
  if (!targets?.length) {
    return '-'
  }
  const visibleTargets = targets.slice(0, 2)
  return (
    <Space orientation="vertical" size={2}>
      {visibleTargets.map((target, index) => (
        <Text key={`${target.clusterId}-${target.namespace}-${target.workloadName}-${index}`}>
          {`${target.clusterId} / ${target.namespace} / ${target.workloadName}`}
        </Text>
      ))}
      {targets.length > visibleTargets.length ? (
        <Text type="secondary">{`+${targets.length - visibleTargets.length}`}</Text>
      ) : null}
    </Space>
  )
}

function summarizeApplicationRole(app: DeliveryApplication) {
  const language = app.language ? app.language.toUpperCase() : 'APP'
  return language
}

function applicationBeamTone(app: DeliveryApplication, index: number) {
  const seed = `${app.language || ''}:${app.key || app.id || app.name}`.toLowerCase()
  if (seed.includes('go')) return 'cyan'
  if (seed.includes('java')) return 'volcano'
  if (seed.includes('node') || seed.includes('js') || seed.includes('ts')) return 'lime'
  if (seed.includes('python') || seed.includes('py')) return 'purple'
  return ['blue', 'cyan', 'purple', 'lime', 'volcano'][index % 5]
}

function applicationBeamGradient(tone: string): BorderBeamGradient {
  switch (tone) {
    case 'cyan':
      return [
        { color: 'var(--soha-primary)', percent: 0 },
        { color: 'var(--soha-accent-cyan)', percent: 52 },
        { color: 'var(--soha-info)', percent: 100 },
      ]
    case 'purple':
      return [
        { color: 'var(--soha-primary)', percent: 0 },
        { color: 'var(--soha-graph-span)', percent: 48 },
        { color: 'var(--soha-graph-hypothesis)', percent: 100 },
      ]
    case 'lime':
      return [
        { color: 'var(--soha-success)', percent: 0 },
        { color: 'var(--soha-accent-teal)', percent: 54 },
        { color: 'var(--soha-warning)', percent: 100 },
      ]
    case 'volcano':
      return [
        { color: 'var(--soha-warning)', percent: 0 },
        { color: 'var(--soha-danger)', percent: 46 },
        { color: 'var(--soha-primary)', percent: 100 },
      ]
    default:
      return [
        { color: 'var(--soha-primary)', percent: 0 },
        { color: 'var(--soha-accent-cyan)', percent: 52 },
        { color: 'var(--soha-accent-teal)', percent: 100 },
      ]
  }
}

function summarizeApplicationServiceClues(app: DeliveryApplication, bindings: ReleaseBoardEntry[]) {
  const sourceIDs = new Set([
    ...(app.buildSources ?? []).map((source) => source.id || source.name || source.type),
    ...bindings.map((binding) => binding.buildSourceId || binding.buildSource?.id || binding.buildSource?.name).filter(Boolean),
  ])
  return Math.max(sourceIDs.size, app.buildSources?.length ?? 0)
}

function summarizeEnvironmentCoverage(bindings: ReleaseBoardEntry[]) {
  const names = Array.from(
    new Set(bindings.map((item) => item.environmentName || item.environmentKey || item.environmentId).filter(Boolean)),
  )
  if (names.length === 0) return '尚未绑定环境'
  if (names.length === 1) return names[0]
  return `${names.slice(0, 2).join(' / ')}${names.length > 2 ? ` +${names.length - 2}` : ''}`
}

function metadataText(metadata: Record<string, unknown> | undefined, ...keys: string[]) {
  if (!metadata) return ''
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return ''
}

function workflowGatewayTrace(run: WorkflowRun) {
  return {
    approvalRequestId: metadataText(run.metadata, 'aiGatewayApprovalRequestId', 'approvalRequestId'),
    approvalPolicyRef: metadataText(run.metadata, 'aiGatewayApprovalPolicyRef'),
    policyId: metadataText(run.metadata, 'aiGatewayPolicyId'),
    toolName: metadataText(run.metadata, 'aiGatewayToolName'),
    skillId: metadataText(run.metadata, 'aiGatewaySkillId'),
    aiClientId: metadataText(run.metadata, 'aiGatewayAIClientId'),
  }
}

function workflowGatewayPath(approvalRequestId: string) {
  const search = new URLSearchParams()
  if (approvalRequestId) search.set('approvalRequestId', approvalRequestId)
  const suffix = search.toString()
  return `/ai-gateway/governance${suffix ? `?${suffix}` : ''}`
}

function workflowManualApprovalNode(run: WorkflowRun) {
  return run.nodeRuns?.find((item) => item.type === 'manual_approval') ?? null
}

function workflowNodeTimelineColor(status: string) {
  const normalized = status.toLowerCase()
  if (['completed', 'success', 'approved'].includes(normalized)) return 'var(--soha-success)'
  if (['failed', 'rejected', 'canceled', 'callback_timeout'].includes(normalized)) return 'var(--soha-danger)'
  if (['waiting_approval', 'pending_approval', 'pending'].includes(normalized)) return 'var(--soha-warning)'
  if (['running', 'dispatching'].includes(normalized)) return 'var(--soha-primary)'
  return 'var(--soha-graph-muted)'
}

function workflowNodeSummary(node: WorkflowNodeRun) {
  return node.summary || [node.type, node.status].filter(Boolean).join(' / ') || '-'
}

function WorkflowNodeTimeline({ nodes }: { nodes?: WorkflowNodeRun[] }) {
  if (!nodes?.length) {
    return <ManagementState bordered={false} compact description="No workflow nodes" />
  }
  return (
    <Timeline
      mode="start"
      items={nodes.map((node) => ({
        color: workflowNodeTimelineColor(node.status),
        title: <Text type="secondary">{node.finishedAt ? formatDateTime(node.finishedAt) : node.startedAt ? formatDateTime(node.startedAt) : '-'}</Text>,
        content: (
          <Space orientation="vertical" size={2}>
            <Space size={6} wrap>
              <Text strong>{node.name || node.nodeId}</Text>
              <Tag>{node.type}</Tag>
              <StatusTag value={node.status} />
            </Space>
            <Text type="secondary">{node.nodeId}</Text>
            <Text>{workflowNodeSummary(node)}</Text>
          </Space>
        ),
      }))}
    />
  )
}

function WorkflowManualApprovalDetail({ run }: { run: WorkflowRun }) {
  const trace = workflowGatewayTrace(run)
  const approvalNode = workflowManualApprovalNode(run)
  if (!approvalNode) {
    return <ManagementState bordered={false} compact description="No manual approval node" />
  }
  return (
    <Descriptions
      size="small"
      bordered
      column={3}
      items={[
        { key: 'nodeId', label: 'Node ID', children: approvalNode.nodeId },
        { key: 'name', label: 'Name', children: approvalNode.name || '-' },
        { key: 'type', label: 'Type', children: approvalNode.type || '-' },
        { key: 'status', label: 'Status', children: <StatusTag value={approvalNode.status} /> },
        { key: 'startedAt', label: 'Started', children: approvalNode.startedAt ? formatDateTime(approvalNode.startedAt) : '-' },
        { key: 'finishedAt', label: 'Finished', children: approvalNode.finishedAt ? formatDateTime(approvalNode.finishedAt) : '-' },
        { key: 'summary', label: 'Summary', span: 3, children: approvalNode.summary || '-' },
        { key: 'approvalRequestId', label: 'Gateway Approval', children: trace.approvalRequestId || '-' },
        { key: 'policy', label: 'Policy', children: trace.approvalPolicyRef || trace.policyId || '-' },
        { key: 'tool', label: 'Tool', children: trace.toolName || '-' },
        { key: 'skill', label: 'Skill', children: trace.skillId || '-' },
        { key: 'client', label: 'AI Client', children: trace.aiClientId || '-' },
      ]}
    />
  )
}

function WorkflowGatewayTracePanel({ run }: { run: WorkflowRun }) {
  const navigate = useNavigate()
  const trace = workflowGatewayTrace(run)
  const approvalNode = workflowManualApprovalNode(run)
  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Descriptions size="small" bordered column={3} items={[
        { key: 'approval', label: 'Gateway Approval', children: trace.approvalRequestId ? <Button size="small" type="link" icon={<LinkOutlined />} onClick={() => navigate(workflowGatewayPath(trace.approvalRequestId))}>{trace.approvalRequestId}</Button> : '-' },
        { key: 'policy', label: 'Policy', children: trace.approvalPolicyRef || trace.policyId || '-' },
        { key: 'tool', label: 'Tool', children: trace.toolName || '-' },
        { key: 'skill', label: 'Skill', children: trace.skillId || '-' },
        { key: 'client', label: 'AI Client', children: trace.aiClientId || '-' },
        { key: 'manualNode', label: 'Manual Approval Node', children: approvalNode ? `${approvalNode.name || approvalNode.nodeId} / ${approvalNode.status}` : '-' },
      ]} />
      <Collapse
        size="small"
        defaultActiveKey={['manual-approval', 'node-timeline']}
        items={[
          {
            key: 'manual-approval',
            label: 'Manual approval detail',
            children: <WorkflowManualApprovalDetail run={run} />,
          },
          {
            key: 'node-timeline',
            label: 'Workflow node timeline',
            children: <WorkflowNodeTimeline nodes={run.nodeRuns} />,
          },
          {
            key: 'raw-trace',
            label: 'Raw trace',
            children: <pre className="soha-json-block">{JSON.stringify({ id: run.id, metadata: run.metadata, nodeRuns: run.nodeRuns }, null, 2)}</pre>,
          },
        ]}
      />
    </Space>
  )
}

export function ApplicationsPage() {
  const navigate = useNavigate()
  const managementState = useApplicationCenterState()
  const [activeGroup, setActiveGroup] = useState<string>('all')
  const [deleteConfirmApp, setDeleteConfirmApp] = useState<DeliveryApplication | null>(null)

  const applicationsQuery = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.get<ApiResponse<DeliveryApplication[]>>('/applications'),
  })
  const releaseBoardQuery = useQuery({
    queryKey: ['delivery-release-board'],
    queryFn: () => api.get<ApiResponse<ReleaseBoardEntry[]>>('/delivery/release-board'),
  })

  const boardByApp = useMemo(() => {
    const items = releaseBoardQuery.data?.data ?? []
    return items.reduce<Record<string, ReleaseBoardEntry[]>>((acc, item) => {
      acc[item.applicationId] = [...(acc[item.applicationId] ?? []), item]
      return acc
    }, {})
  }, [releaseBoardQuery.data])
  const applicationCards = useMemo<ApplicationWorkspaceCard[]>(() => {
    return (applicationsQuery.data?.data ?? []).map((app) => {
      const bindings = boardByApp[app.id] ?? []
      return {
        app,
        bindings,
        deliverySignal: summarizeDeliveryBuildSignal(bindings, { completedLabel: '最近已构建' }),
        gateSignal: summarizeDeliveryValidationSignal(bindings, { readyLabel: '可验证' }),
        activeTargets: bindings.reduce((sum, item) => sum + (item.targets?.length ?? 0), 0),
        serviceClues: summarizeApplicationServiceClues(app, bindings),
        latestEnvironmentName: summarizeEnvironmentCoverage(bindings),
      }
    })
  }, [applicationsQuery.data, boardByApp])
  const groupOptions = useMemo(() => {
    return ['all', ...managementState.applicationGroupOptions]
  }, [managementState.applicationGroupOptions])
  const visibleApplicationCards = useMemo(
    () => applicationCards.filter(({ app }) => activeGroup === 'all' || splitApplicationGroups(app.group).includes(activeGroup)),
    [activeGroup, applicationCards],
  )
  useEffect(() => {
    if (!groupOptions.includes(activeGroup)) {
      setActiveGroup('all')
    }
  }, [activeGroup, groupOptions])
  const openCreateApplication = () => {
    managementState.setEditingApp(null)
    managementState.setBuildSources(defaultBuildSources())
    managementState.setAppModalVisible(true)
  }
  const openOnboarding = () => {
    navigate('/delivery/onboarding')
  }
  const openEditApplication = (app: DeliveryApplication) => {
    managementState.setEditingApp(app)
    managementState.setBuildSources(app.buildSources ?? [])
    managementState.setAppModalVisible(true)
  }

  return (
    <div className="soha-page">
      <div className="soha-application-center-toolbar">
        <div className="soha-application-group-tags">
          {groupOptions.map((group) => (
            <Tag
              key={group}
              className={`soha-application-group-tag ${activeGroup === group ? 'is-active' : ''}`}
              variant="filled"
              onClick={() => setActiveGroup(group)}
            >
              {group === 'all' ? '全部' : group}
            </Tag>
          ))}
        </div>
        <Space className="soha-application-center-toolbar__actions" size={8} wrap>
          <Button icon={<RocketOutlined />} onClick={openOnboarding}>
            接入应用/服务
          </Button>
          <Button type="primary" icon={<PlusOutlined />} disabled={!managementState.canCreateApplication} onClick={openCreateApplication}>
            新建应用档案
          </Button>
        </Space>
      </div>

      {applicationsQuery.isLoading || releaseBoardQuery.isLoading ? (
        <ManagementState kind="loading" />
      ) : visibleApplicationCards.length > 0 ? (
        <div className="soha-application-card-list">
          {visibleApplicationCards.map(({ app, bindings, deliverySignal, gateSignal, activeTargets, serviceClues, latestEnvironmentName }, index) => {
            const beamTone = applicationBeamTone(app, index)
            const actionMenuItems: MenuProps['items'] = [
              ...(managementState.canUpdateApplication ? [{ key: 'edit', icon: <EditOutlined />, label: '编辑' }] : []),
              ...(managementState.canDeleteApplication ? [{ key: 'delete', danger: true, icon: <DeleteOutlined />, label: '删除' }] : []),
            ]
            return (
              <BorderBeam key={app.id} color={applicationBeamGradient(beamTone)} outset={0}>
                <Card
                  className="soha-application-card"
                  hoverable
                  onClick={() => navigate(`/applications/${app.id}`)}
                >
                  <div className="soha-application-card__header">
                    <div className="soha-application-card__title-wrap">
                      <div className="soha-application-card__title-row">
                        <h3 className="soha-application-card__title">{app.name}</h3>
                      </div>
                      <div className="soha-application-card__subline">
                        <Tag className="soha-application-card__language-tag" color={beamTone}>
                          {summarizeApplicationRole(app)}
                        </Tag>
                        <Tag className="soha-application-card__state-tag" color={app.enabled ? 'success' : 'default'}>
                          {app.enabled ? 'enabled' : 'disabled'}
                        </Tag>
                      </div>
                    </div>
                    <div className="soha-application-card__header-actions">
                      {actionMenuItems.length > 0 ? (
                        <Popconfirm
                          title="确认删除应用？"
                          description={deleteConfirmApp?.id === app.id ? `删除 ${app.name} 后不可恢复。` : undefined}
                          open={deleteConfirmApp?.id === app.id}
                          okText="删除"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                          placement="bottomRight"
                          onCancel={(event) => {
                            event?.stopPropagation()
                            setDeleteConfirmApp(null)
                          }}
                          onConfirm={(event) => {
                            event?.stopPropagation()
                            managementState.deleteAppMutation.mutate(app.id)
                            setDeleteConfirmApp(null)
                          }}
                          onOpenChange={(open) => {
                            if (!open && deleteConfirmApp?.id === app.id) {
                              setDeleteConfirmApp(null)
                            }
                          }}
                        >
                          <Dropdown
                            trigger={['click']}
                            placement="bottomRight"
                            menu={{
                              items: actionMenuItems,
                              onClick: ({ key, domEvent }) => {
                                domEvent.stopPropagation()
                                if (key === 'edit') {
                                  openEditApplication(app)
                                }
                                if (key === 'delete') {
                                  setDeleteConfirmApp(app)
                                }
                              },
                            }}
                          >
                            <Button
                              aria-label={`${app.name} 操作`}
                              className="soha-application-card__more"
                              icon={<MoreOutlined />}
                              size="small"
                              type="text"
                              onClick={(event) => event.stopPropagation()}
                            />
                          </Dropdown>
                        </Popconfirm>
                      ) : null}
                    </div>
                  </div>

                  <div className="soha-application-card__signals">
                    <Tag color={deliverySignal.color}>{`交付: ${deliverySignal.label}`}</Tag>
                    <Tag color={gateSignal.color}>{`门禁: ${gateSignal.label}`}</Tag>
                  </div>

                  <div className="soha-application-card__stats">
                    <div className="soha-application-card__stat">
                      <Tag className="soha-application-card__metric-tag" color="processing">服务线索 {serviceClues}</Tag>
                    </div>
                    <div className="soha-application-card__stat">
                      <Tag className="soha-application-card__metric-tag" color={(bindings.length || app.environmentCount || 0) > 0 ? 'success' : 'default'}>环境 {bindings.length || app.environmentCount || 0}</Tag>
                    </div>
                    <div className="soha-application-card__stat">
                      <Tag className="soha-application-card__metric-tag" color={activeTargets > 0 ? 'geekblue' : 'default'}>目标 {activeTargets}</Tag>
                    </div>
                    <div className="soha-application-card__stat is-wide">
                      <Tag className="soha-application-card__metric-tag soha-application-card__metric-tag--wide" color={bindings.length > 0 ? 'purple' : 'default'}>最近环境 {latestEnvironmentName}</Tag>
                    </div>
                  </div>
                </Card>
              </BorderBeam>
            )
          })}
        </div>
      ) : (
        <Card className="soha-application-empty-card">
          <ManagementState bordered={false} compact title={activeGroup === 'all' ? '暂无应用' : '分组暂无应用'} description="" />
        </Card>
      )}
      <ApplicationCenterModals state={managementState} />
    </div>
  )
}

export function ApplicationDetailPage() {
  const { applicationId } = useParams()
  const navigate = useNavigate()
  const detailQuery = useQuery({
    queryKey: ['application-detail', applicationId],
    queryFn: () => api.get<ApiResponse<DeliveryApplicationDetail>>(`/applications/${applicationId}/detail`),
    enabled: !!applicationId,
  })
  const detail = detailQuery.data?.data
  const application = detail?.application

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title={application?.name || 'Application Detail'}
        description="应用总览、构建来源、环境矩阵与最近执行记录。"
        actions={<Button onClick={() => navigate('/applications')}>返回应用中心</Button>}
      />
      <Card className="soha-management-panel-card">
        <Descriptions items={[
          { key: 'group', label: '分组', children: application?.group || '-' },
          { key: 'language', label: '语言', children: application?.language || '-' },
          { key: 'status', label: '最近状态', children: <StatusTag value={detail?.latestRelease?.status || detail?.latestWorkflow?.status || detail?.latestBuild?.status || 'unknown'} /> },
        ]} />
      </Card>
      <DeliveryTable
        title="构建来源"
        rowKey="id"
        pagination={false}
        dataSource={application?.buildSources ?? []}
        loading={detailQuery.isLoading}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '类型', dataIndex: 'type', render: (value: string) => <Tag>{value}</Tag> },
          { title: '镜像', dataIndex: 'buildImage', render: (value: string) => value || '-' },
          { title: '默认', dataIndex: 'isDefault', render: (value: boolean) => <BooleanTag value={value} /> },
          { title: '启用', dataIndex: 'enabled', render: (value: boolean) => <BooleanTag value={value} /> },
        ]}
      />
      <DeliveryTable
        title="环境矩阵"
        rowKey="applicationEnvironmentId"
        pagination={false}
        dataSource={detail?.bindings ?? []}
        loading={detailQuery.isLoading}
        columns={[
          { title: '环境', dataIndex: 'environmentName', render: (value: string, record: ApplicationBindingRow) => value || record.environmentKey || record.environmentId },
          { title: '部署目标', dataIndex: 'targets', render: (value: ApplicationBindingRow['targets']) => renderTargetSummary(value) },
          { title: '动作', dataIndex: 'actionKind', render: (value: string) => value || 'deploy' },
          { title: '构建来源', dataIndex: 'buildSource', render: (value: BuildSource | undefined) => summarizeBuildSource(value) },
          { title: '目标数', dataIndex: 'targetCount' },
          { title: '审批', dataIndex: 'requiresApproval', render: (value: boolean) => <BooleanTag value={value} /> },
          { title: 'Bundle', dataIndex: 'latestBundle', render: (value: ApplicationBindingRow['latestBundle']) => <StatusTag value={value?.status || 'unknown'} /> },
          { title: 'Task', dataIndex: 'latestExecutionTask', render: (value: ApplicationBindingRow['latestExecutionTask']) => <StatusTag value={value?.status || 'unknown'} /> },
          { title: 'Workflow', dataIndex: 'latestWorkflow', render: (value: WorkflowRun | undefined) => <StatusTag value={value?.status || 'unknown'} /> },
          { title: 'Release', dataIndex: 'latestRelease', render: (value: ApplicationBindingRow['latestRelease']) => <StatusTag value={value?.status || 'unknown'} /> },
          {
            ...tableColumnPresets.action,
            title: '操作',
            dataIndex: 'applicationEnvironmentId',
            render: () => (
              <ManagementIconButton
                aria-label="查看应用配置"
                icon={<LinkOutlined />}
                size="small"
                tooltip="应用配置"
                onClick={() => navigate(`/applications/${applicationId ?? ''}`)}
              />
            ),
          },
        ]}
      />
    </div>
  )
}

export function BuildTemplatesPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canManage = hasPermission(permissionSnapshotQuery.data?.data, 'delivery.build-templates.manage')
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm<BuildTemplateFormValues>()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [searchText, setSearchText] = useState('')
  const [activeTabKey, setActiveTabKey] = useState('basic')
  const [isDirty, setIsDirty] = useState(false)
  const [formSnapshot, setFormSnapshot] = useState<BuildTemplateFormValues>({})
  const suppressFormChangeRef = useRef(false)

  const templatesQuery = useQuery({
    queryKey: ['build-templates'],
    queryFn: () => api.get<ApiResponse<BuildTemplate[]>>('/build-templates'),
  })
  const templates = templatesQuery.data?.data ?? []
  const selectedTemplate = selectedTemplateId && selectedTemplateId !== 'new'
    ? templates.find((item) => item.id === selectedTemplateId) ?? null
    : null
  const selectedTemplateUsageQuery = useQuery({
    queryKey: ['build-template-usage', selectedTemplate?.id ?? ''],
    queryFn: () => api.get<ApiResponse<TemplateUsageSummary>>(`/build-templates/${selectedTemplate?.id ?? ''}/usage`),
    enabled: !!selectedTemplate?.id,
  })
  const selectedTemplateUsage = selectedTemplateUsageQuery.data?.data
  const isNewDraft = selectedTemplateId === 'new'
  const hasSelection = isNewDraft || !!selectedTemplate

  const createMutation = useMutation({
    mutationFn: (values: BuildTemplatePayload) => api.post<ApiResponse<BuildTemplate>>('/build-templates', values),
    onSuccess: () => {
      message.success('构建模板创建成功')
      queryClient.invalidateQueries({ queryKey: ['build-templates'] })
    },
    onError: (err: Error) => message.error(err.message),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: BuildTemplatePayload }) => api.put<ApiResponse<BuildTemplate>>(`/build-templates/${id}`, values),
    onSuccess: () => {
      message.success('构建模板更新成功')
      queryClient.invalidateQueries({ queryKey: ['build-templates'] })
      queryClient.invalidateQueries({ queryKey: ['build-template-usage'] })
    },
    onError: (err: Error) => message.error(err.message),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/build-templates/${id}`),
    onSuccess: (_payload, deletedId) => {
      message.success('构建模板已删除')
      queryClient.invalidateQueries({ queryKey: ['build-templates'] })
      queryClient.invalidateQueries({ queryKey: ['build-template-usage'] })
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

  const updateTemplateSearchParam = useCallback((templateId?: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (templateId) {
        next.set('templateId', templateId)
      } else {
        next.delete('templateId')
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const confirmDiscardChanges = useCallback(() => {
    if (!isDirty) return true
    return window.confirm('当前构建模板有未保存更改，确认放弃？')
  }, [isDirty])

  const applyFormValues = useCallback((values: BuildTemplateFormValues, dirtyAfterApply: boolean) => {
    suppressFormChangeRef.current = true
    setFormSnapshot(values)
    form.setFieldsValue(values)
    window.setTimeout(() => {
      suppressFormChangeRef.current = false
      setIsDirty(dirtyAfterApply)
    }, 0)
  }, [form])

  const loadTemplate = useCallback((template: BuildTemplate, options?: { dirtyAfterLoad?: boolean; formOverrides?: BuildTemplateFormValues; tabKey?: string }) => {
    const values = {
      ...buildTemplateToFormValues(template),
      ...options?.formOverrides,
    }
    setSelectedTemplateId(template.id)
    setActiveTabKey(options?.tabKey ?? 'basic')
    applyFormValues(values, Boolean(options?.dirtyAfterLoad))
    updateTemplateSearchParam(template.id)
  }, [applyFormValues, updateTemplateSearchParam])

  useEffect(() => {
    if (!templates.length) return
    const queryTemplateId = searchParams.get('templateId')
    const queryTemplate = queryTemplateId ? templates.find((item) => item.id === queryTemplateId) : undefined
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
    const fromValues = (values: BuildTemplateFormValues, id: string, isDraft: boolean, template?: BuildTemplate): BuildTemplateListItem => ({
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
    return listItems.filter((item) => [
      item.name,
      item.key,
      item.description,
      item.builderKind,
    ].some((value) => String(value || '').toLowerCase().includes(keyword)))
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
        const usageForSave = selectedTemplateUsage ?? (await selectedTemplateUsageQuery.refetch()).data?.data
        if (shouldConfirmTemplateUsageSave(usageForSave) && !window.confirm(templateUsageConfirmText(selectedTemplate.name, usageForSave))) {
          return
        }
        await updateMutation.mutateAsync({ id: selectedTemplate.id, values: payload })
        setFormSnapshot(values)
        setIsDirty(false)
        return
      }
      const created = await createMutation.mutateAsync(payload) as ApiResponse<BuildTemplate> | undefined
      const createdTemplate = created?.data
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
        loadTemplate(item.template, { dirtyAfterLoad: true, formOverrides: { enabled }, tabKey: 'basic' })
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
          <Form.Item name="key" label="模板 Key" rules={[{ required: true, message: '请输入模板 Key' }]}>
            <Input placeholder="docker-node" />
          </Form.Item>
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="Node Docker 标准构建" />
          </Form.Item>
          <Form.Item name="builderKind" label="Builder Kind">
            <Select options={[
              { value: 'docker', label: 'docker' },
              { value: 'buildx', label: 'buildx' },
              { value: 'kaniko', label: 'kaniko' },
              { value: 'custom', label: 'custom' },
            ]} />
          </Form.Item>
          <Form.Item className="soha-build-template-switch-field" name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item className="soha-build-template-form-grid__wide" name="description" label="描述">
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
          <Text type="secondary">维护平台推荐的 Dockerfile 草稿，应用接入时可按规范生成或落盘。</Text>
          <Form.Item name="dockerfileTemplate" label="Dockerfile 模板">
            <Input.TextArea className="soha-build-template-code-area" rows={18} spellCheck={false} />
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
            <Input.TextArea className="soha-build-template-code-area" rows={14} placeholder="npm ci&#10;npm run build" spellCheck={false} />
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
                <Text type="secondary">用结构化字段维护构建参数，保存时自动生成 variableSchema 和默认变量。</Text>
                <Button icon={<PlusOutlined />} onClick={() => add({ key: '', label: '', type: 'string', required: false, defaultValue: '', description: '' })}>添加变量</Button>
              </div>
              {fields.length === 0 ? (
                <ManagementState bordered={false} compact kind="empty" title="暂无变量" description="没有变量时，模板会使用高级预览里的兼容 JSON 配置。" />
              ) : null}
              {fields.map((field, index) => (
                <div className="soha-build-template-variable-item" key={field.key}>
                  <div className="soha-build-template-variable-item__head">
                    <strong>{`变量 ${index + 1}`}</strong>
                    <Button danger icon={<DeleteOutlined />} size="small" onClick={() => remove(field.name)}>删除</Button>
                  </div>
                  <div className="soha-build-template-form-grid">
                    <Form.Item name={[field.name, 'key']} label="变量 Key" rules={[{ required: true, message: '请输入变量 Key' }]}>
                      <Input placeholder="imageTag" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'label']} label="显示名称">
                      <Input placeholder="镜像 Tag" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'type']} label="类型">
                      <Select options={[
                        { value: 'string', label: 'string' },
                        { value: 'number', label: 'number' },
                        { value: 'boolean', label: 'boolean' },
                      ]} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'defaultValue']} label="默认值">
                      <Input placeholder="latest" />
                    </Form.Item>
                    <Form.Item className="soha-build-template-switch-field" name={[field.name, 'required']} label="必填" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item className="soha-build-template-form-grid__wide" name={[field.name, 'description']} label="说明">
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
            <Form.Item className="soha-build-template-form-grid__wide" name="variableSchemaText" label="兼容变量 Schema(JSON)">
              <Input.TextArea rows={5} spellCheck={false} />
            </Form.Item>
            <Form.Item className="soha-build-template-form-grid__wide" name="defaultVariablesText" label="兼容默认变量(JSON)">
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
          <Button icon={<PlusOutlined />} type="primary" disabled={!canManage} onClick={handleNewTemplate}>
            新建模板
          </Button>
          <Button icon={<SaveOutlined />} disabled={!hasSelection || !canManage} loading={createMutation.isPending || updateMutation.isPending} onClick={() => void handleSave()}>
            保存
          </Button>
          <Button disabled={!hasSelection || !isDirty} onClick={handleCancelChanges}>
            取消更改
          </Button>
          <Popconfirm title="确认删除当前构建模板？" onConfirm={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)}>
            <Button danger icon={<DeleteOutlined />} disabled={!selectedTemplate || !canManage} loading={deleteMutation.isPending}>
              删除
            </Button>
          </Popconfirm>
        </Space>
        <Space wrap>
          {isDirty ? <Tag color="gold">未保存</Tag> : <Tag>已同步</Tag>}
          <Button icon={<ReloadOutlined />} loading={templatesQuery.isFetching} onClick={() => { if (confirmDiscardChanges()) void templatesQuery.refetch() }}>
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
                  <Text type="secondary" className="text-xs">{item.updatedAt ? formatDateTime(item.updatedAt) : '尚未保存'}</Text>
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

export function WorkflowsPage() {
  const { t, localeCode } = useI18n()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusedWorkflowRunId = searchParams.get('workflowRunId')?.trim() ?? ''
  const focusedGatewayApprovalRequestId = searchParams.get('gatewayApprovalRequestId')?.trim() ?? ''
  const [expandedWorkflowRunIds, setExpandedWorkflowRunIds] = useState<string[]>([])
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canTriggerWorkflow = hasPermission(permissionSnapshotQuery.data?.data, 'delivery.workflows.trigger')

  const workflowsQuery = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.get<ApiResponse<WorkflowRun[]>>('/workflows'),
  })

  const triggerMutation = useMutation({
    mutationFn: (record: WorkflowRun) => api.post('/workflows/trigger', {
      applicationId: record.applicationId,
      workflowName: record.workflowName,
      clusterId: record.clusterId,
      namespace: record.namespace,
      deploymentName: record.deploymentName,
      triggerBuild: true,
      triggerRelease: true,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
    onError: (err: Error) => message.error(err.message),
  })
  const approveMutation = useMutation({
    mutationFn: (record: WorkflowRun) => api.post(`/workflows/${record.id}/approve`, { comment: 'Approved from console' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
    onError: (err: Error) => message.error(err.message),
  })
  const rejectMutation = useMutation({
    mutationFn: (record: WorkflowRun) => api.post(`/workflows/${record.id}/reject`, { comment: 'Rejected from console' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
    onError: (err: Error) => message.error(err.message),
  })

  const workflows = workflowsQuery.data?.data ?? []
  const focusedRun = focusedWorkflowRunId ? workflows.find((item) => item.id === focusedWorkflowRunId) : undefined
  useEffect(() => {
    if (!focusedWorkflowRunId) return
    setExpandedWorkflowRunIds((current) => current.includes(focusedWorkflowRunId) ? current : [focusedWorkflowRunId, ...current])
  }, [focusedWorkflowRunId])

  const columns: ColumnProps<WorkflowRun>[] = [
    {
      title: t('common.workflow', 'Workflow'),
      dataIndex: 'workflowName',
      render: (value: string, record: WorkflowRun) => (
        <Space orientation="vertical" size={0}>
          <Space size={6} wrap>
            <Text strong>{value}</Text>
            {record.id === focusedWorkflowRunId ? <Tag color="blue">已定位</Tag> : null}
          </Space>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    { title: t('common.application', 'Application'), dataIndex: 'applicationId' },
    { title: t('common.cluster', 'Cluster'), dataIndex: 'clusterId' },
    { title: t('common.namespace', 'Namespace'), dataIndex: 'namespace' },
    { ...tableColumnPresets.status, title: t('common.status', 'Status'), dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
    {
      title: t('page.delivery.workflows.nodeProgress', 'Node Progress'),
      dataIndex: 'nodeRuns',
      render: (value: WorkflowRun['nodeRuns']) => `${value?.filter((item) => item.status !== 'pending').length ?? 0}/${value?.length ?? 0}`,
    },
    {
      title: 'Gateway',
      key: 'gateway',
      width: 220,
      render: (_: unknown, record: WorkflowRun) => {
        const trace = workflowGatewayTrace(record)
        return trace.approvalRequestId ? (
          <Space orientation="vertical" size={0}>
            <Button size="small" type="link" icon={<LinkOutlined />} onClick={() => navigate(workflowGatewayPath(trace.approvalRequestId))}>
              {trace.approvalRequestId}
            </Button>
            <Text type="secondary">{trace.toolName || 'AI Gateway'}</Text>
          </Space>
        ) : <Text type="secondary">-</Text>
      },
    },
    { ...tableColumnPresets.datetime, title: localeCode === 'zh_CN' ? '最近运行' : 'Last Run', dataIndex: 'updatedAt', render: (value: string) => formatDateTime(value) },
    {
      ...tableColumnPresets.action,
      title: t('common.actions', 'Actions'),
            dataIndex: 'id',
            render: (_: unknown, record: WorkflowRun) => (
        <Space className="soha-row-action-icons" size={2}>
          {canTriggerWorkflow ? (
            <ManagementIconButton
              aria-label={localeCode === 'zh_CN' ? '触发工作流' : 'Trigger workflow'}
              icon={<PlayCircleOutlined />}
              size="small"
              tooltip={localeCode === 'zh_CN' ? '触发' : 'Trigger'}
              onClick={() => triggerMutation.mutate(record)}
            />
          ) : null}
          {canTriggerWorkflow && record.status === 'waiting_approval' ? (
            <ManagementIconButton
              aria-label="批准工作流"
              icon={<CheckOutlined />}
              size="small"
              tooltip="批准"
              onClick={() => approveMutation.mutate(record)}
            />
          ) : null}
          {canTriggerWorkflow && record.status === 'waiting_approval' ? (
            <ManagementIconButton
              aria-label="拒绝工作流"
              danger
              icon={<CloseOutlined />}
              size="small"
              tooltip="拒绝"
              onClick={() => rejectMutation.mutate(record)}
            />
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <div className="soha-page">
      {focusedWorkflowRunId || focusedGatewayApprovalRequestId ? (
        <Alert
          type={focusedWorkflowRunId && !workflowsQuery.isLoading && !focusedRun ? 'warning' : 'info'}
          showIcon
          title={focusedRun ? `已定位工作流 ${focusedRun.id}` : 'Gateway 审批关联工作流定位'}
          description={[
            focusedWorkflowRunId ? `workflowRunId=${focusedWorkflowRunId}` : '',
            focusedGatewayApprovalRequestId ? `gatewayApprovalRequestId=${focusedGatewayApprovalRequestId}` : '',
          ].filter(Boolean).join(' / ') || undefined}
        />
      ) : null}
      <DeliveryTable
        refreshing={workflowsQuery.isFetching}
        onRefresh={() => void workflowsQuery.refetch()}
        columns={columns}
        dataSource={workflows}
        rowKey="id"
        loading={workflowsQuery.isLoading}
        expandable={{
          expandedRowKeys: expandedWorkflowRunIds,
          expandedRowRender: (record: WorkflowRun) => <WorkflowGatewayTracePanel run={record} />,
          onExpandedRowsChange: (keys: readonly Key[]) => setExpandedWorkflowRunIds(keys.map(String)),
        }}
      />
    </div>
  )
}

export function ReleaseBundlesPage() {
  const [searchParams] = useSearchParams()
  const focusedReleaseBundleId = searchParams.get('releaseBundleId')?.trim() ?? ''
  const bundlesQuery = useQuery({
    queryKey: ['release-bundles'],
    queryFn: () => api.get<ApiResponse<ReleaseBundle[]>>('/delivery/release-bundles'),
  })
  const bundles = bundlesQuery.data?.data ?? []
  const focusedBundle = focusedReleaseBundleId ? bundles.find((item) => item.id === focusedReleaseBundleId) : undefined
  const bundleSummary = useMemo(() => summarizeReleaseBundleStatus(bundles), [bundles])

  return (
    <div className="soha-page">
      {focusedReleaseBundleId ? (
        <Alert
          showIcon
          title={focusedBundle ? `已定位版本包 ${focusedBundle.id}` : '版本包定位'}
          description={`releaseBundleId=${focusedReleaseBundleId}`}
          type={focusedBundle || bundlesQuery.isLoading ? 'info' : 'warning'}
        />
      ) : null}
      <div className="soha-release-bundle-summary">
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">候选版本</Text>
          <strong>{bundleSummary.total}</strong>
          <Text type="secondary">{bundleSummary.ready} 个可验证 / 可推广</Text>
        </Card>
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">阻塞版本</Text>
          <strong>{bundleSummary.blocked}</strong>
          <Text type="secondary">构建或发布失败</Text>
        </Card>
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">交付物</Text>
          <strong>{bundleSummary.artifacts}</strong>
          <Text type="secondary">镜像 / 包 / digest</Text>
        </Card>
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">缺少交付物</Text>
          <strong>{bundleSummary.missingArtifacts}</strong>
          <Text type="secondary">需要回填 artifact</Text>
        </Card>
      </div>
      <DeliveryTable
        rowKey="id"
        refreshing={bundlesQuery.isFetching}
        onRefresh={() => void bundlesQuery.refetch()}
        loading={bundlesQuery.isLoading}
        dataSource={bundles}
        columns={[
          {
            title: 'Version',
            dataIndex: 'version',
            render: (value: string, record: ReleaseBundle) => (
              <Space orientation="vertical" size={0}>
                <Space size={6} wrap>
                  <Text strong>{value}</Text>
                  {record.id === focusedReleaseBundleId ? <Tag color="blue">已定位</Tag> : null}
                </Space>
                <Text type="secondary">{record.id}</Text>
              </Space>
            ),
          },
          { title: 'Application', dataIndex: 'applicationId' },
          { title: 'Environment Binding', dataIndex: 'applicationEnvironmentId', render: (value: string) => value || '-' },
          { title: 'Source', dataIndex: 'sourceType' },
          { title: 'Artifact', dataIndex: 'artifactRef', render: (_: unknown, record: ReleaseBundle) => summarizeReleaseBundleArtifact(record) },
          { title: 'Digest', dataIndex: 'artifactDigest', render: (value: string) => value || '-' },
          { title: 'Status', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
          { ...tableColumnPresets.datetime, title: 'Updated', dataIndex: 'updatedAt', render: (value: string) => formatDateTime(value) },
        ]}
      />
    </div>
  )
}

export function ExecutionTasksPage() {
  const { message } = App.useApp()
  const [searchParams] = useSearchParams()
  const focusedExecutionTaskId = searchParams.get('executionTaskId')?.trim() ?? ''
  const focusedReleaseBundleId = searchParams.get('releaseBundleId')?.trim() ?? ''
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canManage = hasPermission(permissionSnapshotQuery.data?.data, 'delivery.execution-tasks.manage')
  const [selectedTask, setSelectedTask] = useState<ExecutionTask | null>(null)
  const tasksQuery = useQuery({
    queryKey: ['execution-tasks'],
    queryFn: () => api.get<ApiResponse<ExecutionTask[]>>('/delivery/execution-tasks'),
    refetchInterval: 5000,
  })
  const logsQuery = useQuery({
    queryKey: ['execution-task-logs', selectedTask?.id],
    queryFn: () => api.get<ApiResponse<Array<{ id: string; logLevel: string; message: string; createdAt: string }>>>(`/delivery/execution-tasks/${selectedTask!.id}/logs`),
    enabled: !!selectedTask?.id,
    refetchInterval: selectedTask?.id ? 5000 : false,
  })
  const callbackMutation = useMutation({
    mutationFn: (task: ExecutionTask) => api.post('/delivery/execution-callbacks', {
      callbackToken: task.callbackToken,
      status: 'completed',
      payload: {
        logs: [`manual callback for ${task.id}`],
      },
    }),
    onSuccess: () => {
      message.success('回调已记录')
      tasksQuery.refetch()
      if (selectedTask?.id) {
        logsQuery.refetch()
      }
    },
    onError: (err: Error) => message.error(err.message),
  })
  const cancelMutation = useMutation({
    mutationFn: (task: ExecutionTask) => api.post(`/delivery/execution-tasks/${task.id}/cancel`, {
      reason: 'Canceled from execution tasks console',
    }),
    onSuccess: () => {
      message.success('任务已取消')
      tasksQuery.refetch()
      if (selectedTask?.id) {
        logsQuery.refetch()
      }
    },
    onError: (err: Error) => message.error(err.message),
  })
  const retryMutation = useMutation({
    mutationFn: (task: ExecutionTask) => api.post(`/delivery/execution-tasks/${task.id}/retry`, {
      reason: 'Retried from execution tasks console',
    }),
    onSuccess: () => {
      message.success('任务已重新入队')
      tasksQuery.refetch()
      if (selectedTask?.id) {
        logsQuery.refetch()
      }
    },
    onError: (err: Error) => message.error(err.message),
  })
  const executionTasks = tasksQuery.data?.data ?? []
  const focusedTask = focusedExecutionTaskId ? executionTasks.find((item) => item.id === focusedExecutionTaskId) : undefined
  const executionSummary = useMemo(() => summarizeExecutionTaskStatus(executionTasks), [executionTasks])

  useEffect(() => {
    if (!focusedTask || selectedTask?.id === focusedTask.id) return
    setSelectedTask(focusedTask)
  }, [focusedTask, selectedTask?.id])

  return (
    <div className="soha-page">
      {focusedExecutionTaskId || focusedReleaseBundleId ? (
        <Alert
          showIcon
          title={focusedTask ? `已定位执行任务 ${focusedTask.id}` : '执行任务定位'}
          description={[
            focusedExecutionTaskId ? `executionTaskId=${focusedExecutionTaskId}` : '',
            focusedReleaseBundleId ? `releaseBundleId=${focusedReleaseBundleId}` : '',
          ].filter(Boolean).join(' / ')}
          type={focusedTask || tasksQuery.isLoading ? 'info' : 'warning'}
        />
      ) : null}
      <div className="soha-execution-task-summary">
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">任务总数</Text>
          <strong>{executionSummary.total}</strong>
          <Text type="secondary">{executionSummary.active} 个执行中</Text>
        </Card>
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">阻塞任务</Text>
          <strong>{executionSummary.blocked}</strong>
          <Text type="secondary">{executionSummary.retryable} 个可重试</Text>
        </Card>
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">交付物线索</Text>
          <strong>{executionSummary.artifacts}</strong>
          <Text type="secondary">来自任务结果</Text>
        </Card>
        <Card className="soha-management-panel-card" size="small">
          <Text type="secondary">回调可用</Text>
          <strong>{executionSummary.callbackReady}</strong>
          <Text type="secondary">agent / callback token</Text>
        </Card>
      </div>
      <DeliveryTable
        rowKey="id"
        refreshing={tasksQuery.isFetching}
        onRefresh={() => void tasksQuery.refetch()}
        loading={tasksQuery.isLoading}
        dataSource={executionTasks}
        columns={[
          {
            title: 'Task',
            dataIndex: 'taskKind',
            render: (value: string, record: ExecutionTask) => (
              <Space orientation="vertical" size={0}>
                <Space size={6} wrap>
                  <Text strong>{value}</Text>
                  {record.id === focusedExecutionTaskId ? <Tag color="blue">已定位</Tag> : null}
                </Space>
                <Text type="secondary">{record.id}</Text>
              </Space>
            ),
          },
          { title: 'Provider', dataIndex: 'providerKind' },
          { title: 'Target', dataIndex: 'targetKind' },
          {
            title: 'Application',
            dataIndex: 'applicationId',
            render: (value: string, record: ExecutionTask) => (
              <Space orientation="vertical" size={0}>
                <Text>{value}</Text>
                <Text type="secondary">{record.applicationEnvironmentId || '-'}</Text>
              </Space>
            ),
          },
          { title: 'Bundle', dataIndex: 'releaseBundleId', render: (value: string) => value || '-' },
          { title: 'Artifacts', dataIndex: 'artifacts', render: (value?: ExecutionArtifact[]) => summarizeExecutionTaskArtifacts(value) },
          { title: 'Status', dataIndex: 'status', render: (value: string) => <StatusTag value={value} /> },
          { title: 'Retries', dataIndex: 'attemptCount', render: (value: number, record: ExecutionTask) => `${value}/${record.maxRetries}` },
          { title: 'Timeout(s)', dataIndex: 'timeoutSeconds' },
          { ...tableColumnPresets.datetime, title: 'Heartbeat', dataIndex: 'lastHeartbeatAt', render: (value?: string) => value ? formatDateTime(value) : '-' },
          { ...tableColumnPresets.datetime, title: 'Updated', dataIndex: 'updatedAt', render: (value: string) => formatDateTime(value) },
          {
            ...tableColumnPresets.action,
            title: '操作',
            dataIndex: 'id',
            render: (_: unknown, record: ExecutionTask) => (
              <Space className="soha-row-action-icons" size={2}>
                <ManagementIconButton
                  aria-label="查看执行日志"
                  icon={<FileTextOutlined />}
                  size="small"
                  tooltip="日志"
                  onClick={() => setSelectedTask(record)}
                />
                {canManage && canCancelExecutionTask(record) ? (
                  <Popconfirm title="确认取消该任务？" onConfirm={() => cancelMutation.mutate(record)}>
                    <ManagementIconButton
                      aria-label="取消执行任务"
                      danger
                      icon={<StopOutlined />}
                      size="small"
                      tooltip="取消"
                    />
                  </Popconfirm>
                ) : null}
                {canManage && canRetryExecutionTask(record) ? (
                  <ManagementIconButton
                    aria-label="重试执行任务"
                    icon={<ReloadOutlined />}
                    size="small"
                    tooltip="重试"
                    onClick={() => retryMutation.mutate(record)}
                  />
                ) : null}
                {canManage && record.providerKind !== 'k8s_job_runner' && record.callbackToken ? (
                  <ManagementIconButton
                    aria-label="模拟执行回调"
                    icon={<ApiOutlined />}
                    size="small"
                    tooltip="模拟回调"
                    onClick={() => callbackMutation.mutate(record)}
                  />
                ) : null}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={selectedTask ? `任务日志 · ${selectedTask.id}` : '任务日志'}
        open={!!selectedTask}
        onCancel={() => setSelectedTask(null)}
        footer={null}
        width={920}
        destroyOnHidden
      >
        <Descriptions
          items={selectedTask ? [
            { key: 'provider', label: 'Provider', children: selectedTask.providerKind },
            { key: 'status', label: 'Status', children: <StatusTag value={selectedTask.status} /> },
            { key: 'bundle', label: 'Bundle', children: selectedTask.releaseBundleId || '-' },
            { key: 'heartbeat', label: 'Last Heartbeat', children: selectedTask.lastHeartbeatAt ? formatDateTime(selectedTask.lastHeartbeatAt) : '-' },
            { key: 'callback', label: 'Callback Token', children: selectedTask.callbackToken || '-' },
          ] : []}
        />
        {canManage && selectedTask ? (
          <Space style={{ marginBottom: 12 }}>
            {canCancelExecutionTask(selectedTask) ? (
              <Button
                danger
                icon={<StopOutlined />}
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(selectedTask)}
                size="small"
              >
                取消任务
              </Button>
            ) : null}
            {canRetryExecutionTask(selectedTask) ? (
              <Button
                icon={<ReloadOutlined />}
                loading={retryMutation.isPending}
                onClick={() => retryMutation.mutate(selectedTask)}
                size="small"
              >
                重新入队
              </Button>
            ) : null}
          </Space>
        ) : null}
        <Card className="soha-management-panel-card" size="small" title="Execution Logs">
          <pre className="soha-json-block">
            {logsQuery.data?.data?.map((item) => `[${item.createdAt}] ${item.logLevel.toUpperCase()} ${item.message}`).join('\n') || 'No logs'}
          </pre>
        </Card>
        <Card className="soha-management-panel-card" size="small" title="Artifacts">
          <pre className="soha-json-block">{JSON.stringify(selectedTask?.artifacts ?? [], null, 2)}</pre>
        </Card>
        <Card className="soha-management-panel-card" size="small" title="Result">
          <pre className="soha-json-block">{JSON.stringify(selectedTask?.result ?? {}, null, 2)}</pre>
        </Card>
      </Modal>
    </div>
  )
}
