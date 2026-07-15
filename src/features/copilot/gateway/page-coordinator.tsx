import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  KeyOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  useManagementTextFilter,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useAuthStore } from '@/stores/auth-store'
import {
  accessPolicyFormValuesFromRecord,
  approvalTrace,
  asRecord,
  auditActionOptions,
  defaultGatewayTabForSection,
  firstNumber,
  firstValue,
  firstString,
  gatewayTokenPurposeFromRecord,
  gatewayTokenPurposeOptions,
  gatewayMenuMeta,
  gatewaySectionMeta,
  gatewaySectionPaths,
  gatewayTabBelongsToSection,
  gatewayTabSectionMap,
  jsonTextFromRecord,
  governanceApprovalQueueRows,
  governanceCoverageDrilldown,
  governanceCoverageRows,
  governanceFindingDrilldownActions,
  governanceQueueDrilldown,
  governanceRecommendationDrilldownAction,
  governanceTokenFindingDrilldown,
  normalizeGatewayTabKey,
  normalizeRateLimitMode,
  scopeFieldDefs,
  scopeValuesFromRecord,
  stringifyPayload,
  workflowTracePath,
} from './types'
import type {
  AIClient,
  AccessPolicy,
  ApprovalFilterState,
  ApprovalRequest,
  AuditFilterState,
  DrawerKind,
  DrawerState,
  GatewayAuditLog,
  GatewayDrawerFormValues,
  GatewaySectionKey,
  GatewayTabKey,
  GatewayTool,
  GovernanceDrilldownTarget,
  GovernanceFinding,
  GovernanceHealthCheck,
  GovernanceMetricCount,
  GovernanceRecommendationAction,
  GovernanceRedactionRow,
  GovernanceTokenFindingRow,
  LLMCallLog,
  LLMModelRoute,
  LLMRelayMetrics,
  LLMUpstream,
  LLMTokenMetadata,
  ModelCallFilterState,
  PersonalAccessToken,
  ServiceAccount,
  ServiceAccountToken,
  SkillBinding,
  ToolGrant,
} from './types'
import { gatewayKeys } from './keys'
import {
  decideGatewayApproval,
  deleteGatewayResource,
  disableGatewayClient,
  disableGatewayUpstream,
  rotateGatewayToken,
  testGatewayUpstream,
  upsertGatewayResource,
} from './mutations'
import { gatewayQueries } from './queries'
import { compactList, formatDateTime } from './presentation'

const GatewayRelaySection = lazy(() =>
  import('./sections/models').then((module) => ({
    default: module.GatewayRelaySection,
  })),
)
const GatewayManifestSection = lazy(() =>
  import('./sections/manifest').then((module) => ({
    default: module.GatewayManifestSection,
  })),
)
const GatewayClientsSection = lazy(() =>
  import('./sections/clients').then((module) => ({
    default: module.GatewayClientsSection,
  })),
)
const GatewayTokensSection = lazy(() =>
  import('./sections/tokens').then((module) => ({
    default: module.GatewayTokensSection,
  })),
)
const GatewayGovernanceSection = lazy(() =>
  import('./sections/governance').then((module) => ({
    default: module.GatewayGovernanceSection,
  })),
)
const GatewayCallLogsSection = lazy(() =>
  import('./sections/audit').then((module) => ({
    default: module.GatewayCallLogsSection,
  })),
)
const GatewayEditorDrawer = lazy(() =>
  import('./editor-drawer').then((module) => ({
    default: module.GatewayEditorDrawer,
  })),
)

const { Paragraph, Text } = Typography

function scopeSummary(scopes?: Record<string, unknown>) {
  const entries = scopeFieldDefs.flatMap((field) => {
    const values = scopeValuesFromRecord(scopes)[field.name]
    return values?.length ? [`${field.label}:${values.join(',')}`] : []
  })
  if (!entries.length) return <Text type="secondary">全局</Text>
  return (
    <Paragraph ellipsis={{ rows: 2, tooltip: entries.join(' / ') }} style={{ marginBottom: 0 }}>
      {entries.join(' / ')}
    </Paragraph>
  )
}

function auditActionLabel(action?: string) {
  const value = String(action ?? '').trim()
  return auditActionOptions.find((item) => item.value === value)?.label ?? value
}

function auditCallTarget(record: GatewayAuditLog) {
  const metadata = asRecord(record.metadata)
  return (
    record.toolName ||
    firstString(metadata, 'resourceUri', 'promptName', 'mcpToolName', 'resourceName') ||
    firstString(asRecord(metadata.relatedIds), 'toolName', 'resourceName') ||
    record.action ||
    '-'
  )
}

function primitiveScopeValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value))
    return value
      .map((item) => primitiveScopeValue(item))
      .filter(Boolean)
      .join(',')
  return ''
}

function auditScopeItems(record: GatewayAuditLog) {
  const scope = asRecord(record.resourceScope)
  const orderedKeys = [
    'businessLineId',
    'applicationId',
    'applicationEnvironmentId',
    'environmentId',
    'clusterId',
    'namespace',
    'podName',
    'deploymentName',
    'serviceName',
    'releaseBundleId',
    'executionTaskId',
  ]
  const seen = new Set<string>()
  const items: string[] = []
  orderedKeys.forEach((key) => {
    const value = primitiveScopeValue(scope[key])
    if (value) {
      seen.add(key)
      items.push(`${key}:${value}`)
    }
  })
  Object.entries(scope).forEach(([key, value]) => {
    if (seen.has(key)) return
    const text = primitiveScopeValue(value)
    if (text) items.push(`${key}:${text}`)
  })
  return items
}

function auditScopeSummary(record: GatewayAuditLog) {
  const items = auditScopeItems(record)
  return items.length ? compactList(items, 3) : <Text type="secondary">全局</Text>
}

function auditCaller(record: GatewayAuditLog) {
  return (
    <Space orientation="vertical" size={0}>
      <Text strong>{record.actorName || record.actorId}</Text>
      <Text type="secondary">
        {record.actorType}:{record.actorId}
      </Text>
      {record.sourceIp ? <Text type="secondary">{record.sourceIp}</Text> : null}
    </Space>
  )
}

function auditEntryPoint(record: GatewayAuditLog) {
  return (
    <Space orientation="vertical" size={0}>
      <Text>{record.aiClientName || record.aiClientId || '-'}</Text>
      <Text type="secondary">{record.skillId ? `skill:${record.skillId}` : 'skill:-'}</Text>
    </Space>
  )
}

function auditInvocation(record: GatewayAuditLog) {
  const target = auditCallTarget(record)
  return (
    <Space orientation="vertical" size={4}>
      <Space size={4} wrap>
        <Text strong>{target}</Text>
        {record.action ? <Tag>{auditActionLabel(record.action)}</Tag> : null}
      </Space>
      {auditScopeSummary(record)}
    </Space>
  )
}

function auditResult(record: GatewayAuditLog) {
  return (
    <Space orientation="vertical" size={4}>
      <StatusTag value={record.result} />
      {record.riskLevel ? <StatusTag value={record.riskLevel} /> : null}
    </Space>
  )
}

function policyConditionSummary(conditions?: Record<string, unknown>) {
  const items: string[] = []
  const source = asRecord(conditions)
  const rateLimit = asRecord(firstValue(source, 'rateLimit', 'rate_limit', 'rateLimits'))
  const budget = asRecord(firstValue(source, 'budget', 'budgets', 'budgetPolicy'))
  const redactionPolicy = asRecord(
    firstValue(source, 'redactionPolicy', 'redaction', 'sensitiveDataRedaction'),
  )
  const outputRedactionPolicy = asRecord(source.outputRedactionPolicy)

  if (Object.keys(rateLimit).length > 0) {
    const normalizedMode = normalizeRateLimitMode(
      firstString(rateLimit, 'mode', 'algorithm', 'strategy'),
    )
    const mode =
      normalizedMode === 'gcra'
        ? 'GCRA'
        : normalizedMode === 'sliding_window'
          ? 'sliding-window'
          : 'fixed-window'
    const perMinute = firstNumber(
      rateLimit,
      'maxCallsPerMinute',
      'maxInvocationsPerMinute',
      'callsPerMinute',
      'rpm',
    )
    const perHour = firstNumber(
      rateLimit,
      'maxCallsPerHour',
      'maxInvocationsPerHour',
      'callsPerHour',
      'rph',
    )
    items.push(
      `rateLimit:${mode}${perMinute ? ` ${perMinute}/m` : ''}${perHour ? ` ${perHour}/h` : ''}`,
    )
  }
  if (Object.keys(budget).length > 0) {
    const calls = firstNumber(
      budget,
      'maxCallsPerDay',
      'maxInvocationsPerDay',
      'maxDailyCalls',
      'dailyCalls',
      'dailyBudget',
    )
    const tokens = firstNumber(budget, 'maxTokensPerDay', 'dailyTokens', 'dailyTokenBudget')
    const cost = firstNumber(budget, 'maxCostPerDay', 'dailyCost', 'dailyCostBudget')
    items.push(
      `budget${calls ? ` ${calls}/d` : ''}${tokens ? ` ${tokens} tokens/d` : ''}${cost ? ` $${cost}/d` : ''}`,
    )
  }
  if (Object.keys(redactionPolicy).length > 0 || Object.keys(outputRedactionPolicy).length > 0) {
    items.push(
      `redaction:${firstString(redactionPolicy, 'mode', 'strategy', 'redactionMode', 'action') ?? 'sanitize'}`,
    )
  }

  return items.length ? compactList(items, 2) : <Text type="secondary">-</Text>
}

function governanceFindingTarget(record: GovernanceFinding) {
  const values = [
    record.actorId ? `${record.actorType || 'actor'}:${record.actorId}` : '',
    record.subjectId ? `${record.subjectType || 'subject'}:${record.subjectId}` : '',
    record.aiClientId ? `client:${record.aiClientId}` : '',
    record.toolName ? `tool:${record.toolName}` : '',
    record.policyId ? `policy:${record.policyId}` : '',
    record.grantId ? `grant:${record.grantId}` : '',
    record.approvalRequestId ? `approval:${record.approvalRequestId}` : '',
  ].filter(Boolean)
  return values.length ? compactList(values, 3) : <Text type="secondary">-</Text>
}

function governanceTokenTiming(record: GovernanceTokenFindingRow) {
  const items = [
    record.expiresAt ? `expires ${formatDateTime(record.expiresAt)}` : '',
    record.daysUntilDue !== undefined ? `${record.daysUntilDue}d due` : '',
    record.lastUsedAt ? `last ${formatDateTime(record.lastUsedAt)}` : '',
    record.staleDays ? `${record.staleDays}d stale` : '',
  ].filter(Boolean)
  return compactList(items, 3)
}

function tokenStatus(record: { expiresAt?: string; revokedAt?: string }) {
  if (record.revokedAt) return 'revoked'
  if (record.expiresAt) {
    const expiresAt = new Date(record.expiresAt).getTime()
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return 'expired'
  }
  return 'active'
}

function formatNumber(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatDurationMs(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `${Math.round(value)} ms`
}

function formatPercent(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  const normalized = value <= 1 ? value * 100 : value
  return `${normalized.toFixed(1)}%`
}

function tokenPurposeLabel(value: string) {
  return gatewayTokenPurposeOptions.find((item) => item.value === value)?.label ?? value
}

function tokenPurposeSummary(record: { metadata?: Record<string, unknown>; scopes?: string[] }) {
  const purpose = gatewayTokenPurposeFromRecord(record)
  return <Tag>{tokenPurposeLabel(purpose)}</Tag>
}

function tokenRelayLimitsSummary(metadata?: Record<string, unknown>) {
  const values = asRecord(metadata) as LLMTokenMetadata
  const items = [
    ...(values.allowedModels ?? []).map((item) => `model:${item}`),
    ...(values.allowedProviderKinds ?? []).map((item) => `provider:${item}`),
    ...(values.allowedUpstreamIds ?? []).map((item) => `upstream:${item}`),
    ...(values.allowedIPCIDRs ?? []).map((item) => `ip:${item}`),
    ...(values.allowedTeams ?? []).map((item) => `team:${item}`),
    ...(values.deniedTeams ?? []).map((item) => `deny-team:${item}`),
    values.rateLimitProfileId ? `rate:${values.rateLimitProfileId}` : '',
  ].filter(Boolean)
  return compactList(items, 3)
}

function upstreamHealthSummary(record: LLMUpstream) {
  const health = asRecord(record.health)
  const status = firstString(health, 'status', 'state') || record.status
  const lastChecked = firstString(health, 'lastCheckedAt', 'checkedAt', 'updatedAt')
  return (
    <Space orientation="vertical" size={0}>
      <StatusTag value={status} />
      <Text type="secondary">{lastChecked ? formatDateTime(lastChecked) : '-'}</Text>
    </Space>
  )
}

function routePolicySummary(record: LLMModelRoute) {
  const items = [
    Object.keys(record.fallbackPolicy ?? {}).length ? 'fallback' : '',
    Object.keys(record.cachePolicy ?? {}).length ? 'cache' : '',
    record.rateLimitProfileId ? `rate:${record.rateLimitProfileId}` : '',
  ].filter(Boolean)
  return items.length ? compactList(items, 3) : <Text type="secondary">-</Text>
}

function relayMetric(metrics: LLMRelayMetrics | undefined, ...keys: string[]) {
  return firstNumber(metrics, ...keys)
}

function modelCallActor(record: LLMCallLog) {
  return (
    <Space orientation="vertical" size={0}>
      <Text strong>{record.actorName || record.actorId || '-'}</Text>
      <Text type="secondary">
        {[record.actorType, record.actorId].filter(Boolean).join(':') || '-'}
      </Text>
      {record.sourceIp ? <Text type="secondary">{record.sourceIp}</Text> : null}
    </Space>
  )
}

function modelCallRoute(record: LLMCallLog) {
  return (
    <Space orientation="vertical" size={0}>
      <Text strong>{record.publicModel || '-'}</Text>
      <Text type="secondary">
        {[record.upstreamName || record.upstreamId, record.upstreamModel]
          .filter(Boolean)
          .join(' / ') || '-'}
      </Text>
      <Space size={4} wrap>
        {record.providerKind ? <Tag>{record.providerKind}</Tag> : null}
        {record.endpoint ? <Tag>{record.endpoint}</Tag> : null}
        {record.stream ? <Tag>stream</Tag> : null}
      </Space>
    </Space>
  )
}

function modelCallUsage(record: LLMCallLog) {
  return (
    <Space orientation="vertical" size={0}>
      <Text>{formatNumber(record.totalTokens)} tokens</Text>
      <Text type="secondary">
        {formatNumber(record.promptTokens)} in / {formatNumber(record.completionTokens)} out
      </Text>
      {record.cachedReadTokens || record.cachedWriteTokens ? (
        <Text type="secondary">
          cache {formatNumber(record.cachedReadTokens)} / {formatNumber(record.cachedWriteTokens)}
        </Text>
      ) : null}
    </Space>
  )
}

function modelCallLatency(record: LLMCallLog) {
  return (
    <Space orientation="vertical" size={0}>
      <Text>{formatDurationMs(record.durationMs)}</Text>
      <Text type="secondary">TTFB {formatDurationMs(record.ttfbMs)}</Text>
      <Text type="secondary">TTFT {formatDurationMs(record.ttftMs)}</Text>
    </Space>
  )
}

function relayModelRanking(metrics?: LLMRelayMetrics) {
  return metrics?.modelRanking ?? metrics?.topModels ?? []
}

function cardTitle(icon: ReactNode, title: string) {
  return (
    <Space size={8}>
      {icon}
      <span>{title}</span>
    </Space>
  )
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="soha-system-json-block">{stringifyPayload(value)}</pre>
}

function ApprovalTracePanel({ record }: { record: ApprovalRequest }) {
  const navigate = useNavigate()
  const trace = approvalTrace(record)
  const workflowPath = workflowTracePath(trace)
  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Descriptions
        size="small"
        bordered
        column={3}
        items={[
          { key: 'approval', label: 'Gateway Approval', children: trace.approvalRequestId || '-' },
          {
            key: 'workflow',
            label: 'Workflow Run',
            children: trace.workflowRunId ? (
              <Button size="small" type="link" onClick={() => navigate(workflowPath)}>
                {trace.workflowRunId}
              </Button>
            ) : (
              '-'
            ),
          },
          { key: 'tool', label: 'Tool', children: record.toolName },
          { key: 'application', label: 'Application', children: trace.applicationId || '-' },
          { key: 'environment', label: 'App Env', children: trace.applicationEnvironmentId || '-' },
          { key: 'executionTask', label: 'Execution Task', children: trace.executionTaskId || '-' },
          { key: 'releaseBundle', label: 'Release Bundle', children: trace.releaseBundleId || '-' },
          { key: 'decision', label: 'Decision', children: record.decisionComment || '-' },
          {
            key: 'jump',
            label: 'Drilldown',
            children: trace.workflowRunId ? (
              <Button
                size="small"
                type="link"
                icon={<LinkOutlined />}
                onClick={() => navigate(workflowPath)}
              >
                查看工作流
              </Button>
            ) : (
              <Text type="secondary">-</Text>
            ),
          },
        ]}
      />
      <JsonBlock
        value={{
          id: record.id,
          resourceScope: record.resourceScope,
          toolInput: record.toolInput,
          relatedIds: record.relatedIds,
          output: record.output,
          decisionComment: record.decisionComment,
        }}
      />
    </Space>
  )
}

function isPendingApproval(record: ApprovalRequest) {
  return record.status === 'pending'
}

export function GatewayPageCoordinator({ section }: { section: GatewaySectionKey }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<GatewayDrawerFormValues>()
  const [decisionForm] = Form.useForm<{ comment?: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [drawer, setDrawer] = useState<DrawerState | null>(null)
  const [oneTimeToken, setOneTimeToken] = useState<{
    title: string
    value: string
    prefix?: string
  } | null>(null)
  const [decisionTarget, setDecisionTarget] = useState<{
    action: 'approve' | 'reject' | 'cancel'
    record: ApprovalRequest
  } | null>(null)
  const [searchParams] = useSearchParams()
  const requestedTab = normalizeGatewayTabKey(searchParams.get('tab'))
  const focusedApprovalRequestId = searchParams.get('approvalRequestId')?.trim() ?? ''
  const [activeTab, setActiveTab] = useState<GatewayTabKey>(() =>
    requestedTab && gatewayTabBelongsToSection(requestedTab, section)
      ? requestedTab
      : defaultGatewayTabForSection(section, focusedApprovalRequestId),
  )
  const [manifestFilters, setManifestFilters] = useState({
    aiClientId: '',
    skillId: '',
    source: 'console',
  })
  const [auditFilters, setAuditFilters] = useState<AuditFilterState>({
    actor: '',
    aiClientId: '',
    toolName: '',
    action: '',
    riskLevel: '',
    result: '',
    from: '',
    to: '',
  })
  const [approvalFilters, setApprovalFilters] = useState<ApprovalFilterState>({
    id: focusedApprovalRequestId,
    status: focusedApprovalRequestId ? '' : 'pending',
    actor: '',
    aiClientId: '',
    toolName: '',
    riskLevel: '',
    strategy: '',
    from: '',
    to: '',
  })
  const [clientFilter, setClientFilter] = useState('')
  const [tokenFilter, setTokenFilter] = useState('')
  const [serviceTokenFilter, setServiceTokenFilter] = useState('')
  const [policyFilter, setPolicyFilter] = useState('')
  const [grantFilter, setGrantFilter] = useState('')
  const [upstreamFilter, setUpstreamFilter] = useState('')
  const [upstreamProviderFilter, setUpstreamProviderFilter] = useState('')
  const [upstreamStatusFilter, setUpstreamStatusFilter] = useState('')
  const [modelRouteFilter, setModelRouteFilter] = useState('')
  const [modelRouteProviderFilter, setModelRouteProviderFilter] = useState('')
  const [modelRouteUpstreamFilter, setModelRouteUpstreamFilter] = useState('')
  const [modelCallFilters, setModelCallFilters] = useState<ModelCallFilterState>({
    actor: '',
    tokenId: '',
    publicModel: '',
    upstreamId: '',
    providerKind: '',
    status: '',
    endpoint: '',
    cacheStatus: '',
    from: '',
    to: '',
  })
  const [governanceWindowHours, setGovernanceWindowHours] = useState('24')
  const currentUser = useAuthStore((state) => state.user)
  const permissionSnapshot = usePermissionSnapshot()
  const snapshot = permissionSnapshot.data?.data
  const canView = hasPermission(snapshot, 'ai.gateway.view')
  const canManage = hasPermission(snapshot, 'ai.gateway.manage')
  const canInvoke = hasPermission(snapshot, 'ai.gateway.invoke')
  const canRelayView = hasPermission(snapshot, 'ai.gateway.relay.view')
  const canRelayManage = hasPermission(snapshot, 'ai.gateway.relay.manage')
  const canRelayInvoke = hasPermission(snapshot, 'ai.gateway.relay.invoke')
  const canUseRelay = canRelayView || canRelayManage || canRelayInvoke
  const canUseGateway = canView || canInvoke || canManage || canUseRelay
  const personalTokenScope = canManage ? 'all' : 'mine'
  const sectionActiveTab = gatewayTabBelongsToSection(activeTab, section)
    ? activeTab
    : defaultGatewayTabForSection(section, focusedApprovalRequestId)
  const isRelay = section === 'relay'
  const isManifest = section === 'manifest'
  const isClients = section === 'clients'
  const isTokens = section === 'tokens'
  const isGovernance = section === 'governance'
  const isCallLogs = section === 'call-logs'

  const clientsQuery = useQuery(
    gatewayQueries.clients(
      canManage &&
        (isManifest ||
          isClients ||
          isGovernance ||
          (isCallLogs && sectionActiveTab === 'audit')),
    ),
  )
  const personalTokensQuery = useQuery(
    gatewayQueries.personalTokens(
      personalTokenScope,
      (canManage || canView || canInvoke) && isTokens,
    ),
  )
  const relayMetricsQuery = useQuery(
    gatewayQueries.relay.metrics((canRelayManage || canRelayView) && isRelay),
  )
  const upstreamsQuery = useQuery(
    gatewayQueries.relay.upstreams(
      { providerKind: upstreamProviderFilter, status: upstreamStatusFilter },
      (canRelayManage || canRelayView) &&
        (isRelay || isTokens || (isCallLogs && sectionActiveTab === 'model-calls')),
    ),
  )
  const modelRoutesQuery = useQuery(
    gatewayQueries.relay.modelRoutes(
      { providerKind: modelRouteProviderFilter, upstreamId: modelRouteUpstreamFilter },
      (canRelayManage || canRelayView) && isRelay,
    ),
  )
  const modelCallsQuery = useQuery(
    gatewayQueries.relay.modelCalls(
      modelCallFilters,
      canRelayManage &&
        ((isRelay && ['relay', 'model-calls'].includes(sectionActiveTab)) ||
          (isCallLogs && sectionActiveTab === 'model-calls')),
    ),
  )
  const serviceAccountsQuery = useQuery(
    gatewayQueries.serviceAccounts(canManage && isTokens),
  )
  const serviceAccountTokensQuery = useQuery(gatewayQueries.serviceTokens(canManage && isTokens))
  const grantsQuery = useQuery(gatewayQueries.grants(canManage && isGovernance))
  const policiesQuery = useQuery(gatewayQueries.policies(canManage && isGovernance))
  const bindingsQuery = useQuery(gatewayQueries.bindings(canManage && isGovernance))
  const manifestQuery = useQuery(
    gatewayQueries.manifest(
      manifestFilters,
      canView &&
        (isManifest || isGovernance || (isCallLogs && sectionActiveTab === 'audit')),
    ),
  )
  const auditQuery = useQuery(
    gatewayQueries.auditLogs(auditFilters, canManage && isCallLogs && sectionActiveTab === 'audit'),
  )
  const approvalsQuery = useQuery(
    gatewayQueries.approvals(
      approvalFilters,
      canManage && isGovernance && sectionActiveTab === 'approvals',
    ),
  )
  const governanceQuery = useQuery(
    gatewayQueries.governance(
      governanceWindowHours,
      canManage && isGovernance && sectionActiveTab === 'governance',
    ),
  )

  const clients = clientsQuery.data?.data ?? []
  const personalTokens = personalTokensQuery.data?.data ?? []
  const relayMetrics = relayMetricsQuery.data?.data
  const upstreams = upstreamsQuery.data?.data ?? []
  const modelRoutes = modelRoutesQuery.data?.data ?? []
  const modelCalls = modelCallsQuery.data?.data ?? []
  const serviceAccounts = serviceAccountsQuery.data?.data ?? []
  const serviceAccountTokens = serviceAccountTokensQuery.data?.data ?? []
  const grants = grantsQuery.data?.data ?? []
  const policies = policiesQuery.data?.data ?? []
  const bindings = bindingsQuery.data?.data ?? []
  const manifest = manifestQuery.data?.data
  const auditLogs = auditQuery.data?.data ?? []
  const approvalRequests = approvalsQuery.data?.data ?? []
  const governanceStatus = governanceQuery.data?.data
  const filteredClients = useManagementTextFilter(clients, clientFilter, (item) => [
    item.id,
    item.name,
    item.kind,
    item.status,
  ])
  const filteredPersonalTokens = useManagementTextFilter(personalTokens, tokenFilter, (item) => [
    item.id,
    item.name,
    item.userId,
    item.tokenPrefix,
    gatewayTokenPurposeFromRecord(item),
    ...(item.permissionKeys ?? []),
    ...(item.scopes ?? []),
    ...Object.values(item.metadata ?? {}).map((value) => String(value)),
  ])
  const filteredServiceAccountTokens = useManagementTextFilter(
    serviceAccountTokens,
    serviceTokenFilter,
    (item) => [
      item.id,
      item.name,
      item.serviceAccountId,
      item.tokenPrefix,
      gatewayTokenPurposeFromRecord(item),
      ...(item.permissionKeys ?? []),
      ...(item.scopes ?? []),
      ...Object.values(item.metadata ?? {}).map((value) => String(value)),
    ],
  )
  const filteredPolicies = useManagementTextFilter(policies, policyFilter, (item) => [
    item.id,
    item.name,
    item.subjectType,
    item.subjectId,
    item.aiClientId,
    ...(item.toolPatterns ?? []),
    ...(item.skillIds ?? []),
  ])
  const filteredGrants = useManagementTextFilter(grants, grantFilter, (item) => [
    item.id,
    item.subjectType,
    item.subjectId,
    item.aiClientId,
    item.toolName,
  ])
  const filteredUpstreams = useManagementTextFilter(upstreams, upstreamFilter, (item) => [
    item.id,
    item.name,
    item.providerKind,
    item.baseUrl,
    item.status,
    ...(item.supportedModels ?? []),
  ])
  const filteredModelRoutes = useManagementTextFilter(modelRoutes, modelRouteFilter, (item) => [
    item.id,
    item.publicModel,
    item.providerKind,
    item.upstreamId,
    item.upstreamModel,
    item.routeGroup,
  ])
  const drawerInitialValues = useMemo(
    () => (drawer ? drawerFormInitialValues(drawer) : {}),
    [drawer],
  )

  useEffect(() => {
    if (!focusedApprovalRequestId) return
    setActiveTab('approvals')
    setApprovalFilters((prev) => ({
      ...prev,
      id: focusedApprovalRequestId,
      status: '',
    }))
  }, [focusedApprovalRequestId])

  useEffect(() => {
    const nextTab =
      requestedTab && gatewayTabBelongsToSection(requestedTab, section)
        ? requestedTab
        : defaultGatewayTabForSection(section, focusedApprovalRequestId)
    setActiveTab((current) => {
      if (requestedTab) {
        return current === requestedTab ? current : nextTab
      }
      if (focusedApprovalRequestId && current !== 'approvals') {
        return 'approvals'
      }
      return gatewayTabBelongsToSection(current, section) ? current : nextTab
    })
  }, [focusedApprovalRequestId, requestedTab, section])

  const applyGovernanceDrilldown = (target: GovernanceDrilldownTarget) => {
    const targetSection = gatewayTabSectionMap[target.tab]
    if (targetSection !== section) {
      navigate(gatewaySectionPaths[targetSection])
    }
    setActiveTab(target.tab)
    if (target.approvalFilters) {
      setApprovalFilters((prev) => ({ ...prev, ...target.approvalFilters }))
    }
    if (target.auditFilters) {
      setAuditFilters((prev) => ({ ...prev, ...target.auditFilters }))
    }
    if (target.clientFilter !== undefined) {
      setClientFilter(target.clientFilter)
    }
    if (target.tokenFilter !== undefined) {
      setTokenFilter(target.tokenFilter)
    }
    if (target.serviceTokenFilter !== undefined) {
      setServiceTokenFilter(target.serviceTokenFilter)
    }
    if (target.policyFilter !== undefined) {
      setPolicyFilter(target.policyFilter)
    }
    if (target.grantFilter !== undefined) {
      setGrantFilter(target.grantFilter)
    }
    if (target.serviceTokenRevokeId) {
      setDrawer({
        kind: 'service-token-revoke',
        initialValues: { tokenId: target.serviceTokenRevokeId },
      })
    }
    if (target.policyDraft) {
      setDrawer({ kind: 'access-policy', initialValues: target.policyDraft })
    }
  }

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: gatewayKeys.all })

  const upsertMutation = useMutation({
    mutationFn: async (values: GatewayDrawerFormValues) => {
      return drawer ? upsertGatewayResource(drawer, values) : null
    },
    onSuccess: (res: any) => {
      const value = res?.data?.value
      const token = res?.data?.token
      if (value) {
        setOneTimeToken({
          title: drawer?.kind === 'service-token' ? '服务账号 token' : 'Personal access token',
          value,
          prefix: token?.tokenPrefix,
        })
      }
      setDrawer(null)
      void refreshAll()
      message.success('已保存')
    },
    onError: (error: Error) => message.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: ({
      kind,
      id,
    }: {
      kind: 'grant' | 'policy' | 'binding' | 'personal-token' | 'model-route'
      id: string
    }) => {
      return deleteGatewayResource(kind, id)
    },
    onSuccess: () => {
      void refreshAll()
      message.success('已更新')
    },
    onError: (error: Error) => message.error(error.message),
  })

  const rotateTokenMutation = useMutation({
    mutationFn: ({ kind, id }: { kind: 'personal-token' | 'service-token'; id: string }) =>
      rotateGatewayToken(kind, id),
    onSuccess: (res: any, variables) => {
      const value = res?.data?.value
      const token = res?.data?.token
      if (value) {
        setOneTimeToken({
          title:
            variables.kind === 'service-token'
              ? '服务账号 token 已轮换'
              : 'Personal access token 已轮换',
          value,
          prefix: token?.tokenPrefix,
        })
      }
      void refreshAll()
      message.success('已轮换')
    },
    onError: (error: Error) => message.error(error.message),
  })

  const disableClientMutation = useMutation({
    mutationFn: disableGatewayClient,
    onSuccess: () => {
      void refreshAll()
      message.success('已禁用')
    },
    onError: (error: Error) => message.error(error.message),
  })

  const disableUpstreamMutation = useMutation({
    mutationFn: disableGatewayUpstream,
    onSuccess: () => {
      void refreshAll()
      message.success('已禁用')
    },
    onError: (error: Error) => message.error(error.message),
  })

  const testUpstreamMutation = useMutation({
    mutationFn: testGatewayUpstream,
    onSuccess: () => {
      void refreshAll()
      message.success('已提交测试')
    },
    onError: (error: Error) => message.error(error.message),
  })

  const decisionMutation = useMutation({
    mutationFn: decideGatewayApproval,
    onSuccess: (res) => {
      void refreshAll()
      setDecisionTarget(null)
      decisionForm.resetFields()
      const status = res.data.request.status
      message.success(status === 'executed' ? '已批准并执行' : '已更新审批请求')
    },
    onError: (error: Error) => message.error(error.message),
  })

  const gatewayPanelMeta = gatewaySectionMeta[section]

  const aiClientColumns: TableColumnsType<AIClient> = [
    {
      title: 'Client',
      dataIndex: 'name',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    { title: '类型', dataIndex: 'kind', width: 140, render: (value) => <Tag>{value}</Tag> },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value) => <StatusTag value={value} />,
    },
    { title: 'Redirect URIs', dataIndex: 'redirectUris', render: (value) => compactList(value, 2) },
    { title: '更新时间', dataIndex: 'updatedAt', width: 140, render: formatDateTime },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space className="soha-row-action-icons">
          <ManagementIconButton
            size="small"
            tooltip="编辑"
            aria-label="编辑 client"
            icon={<EditOutlined />}
            disabled={!canManage}
            onClick={() => setDrawer({ kind: 'ai-client', record })}
          />
          <Popconfirm
            title="确认禁用 client？"
            description="该操作会立即更新 AI Gateway 控制面。"
            okButtonProps={{ danger: true, loading: disableClientMutation.isPending }}
            onConfirm={() => disableClientMutation.mutate(record)}
          >
            <ManagementIconButton
              size="small"
              tooltip="禁用"
              aria-label="禁用 client"
              danger
              icon={<StopOutlined />}
              loading={disableClientMutation.isPending}
              disabled={!canManage || record.status === 'disabled'}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const upstreamColumns: TableColumnsType<LLMUpstream> = [
    {
      title: '上游',
      dataIndex: 'name',
      width: 240,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    {
      title: 'Provider',
      dataIndex: 'providerKind',
      width: 150,
      render: (value) => <Tag>{value}</Tag>,
    },
    {
      title: 'Base URL',
      dataIndex: 'baseUrl',
      width: 260,
      render: (value) => (
        <Paragraph ellipsis={{ rows: 1, tooltip: value }} style={{ marginBottom: 0 }}>
          {value}
        </Paragraph>
      ),
    },
    {
      title: 'API key',
      dataIndex: 'apiKeyPrefix',
      width: 140,
      render: (value) => (value ? <Tag>{value}</Tag> : <Text type="secondary">未配置</Text>),
    },
    {
      title: '模型',
      dataIndex: 'supportedModels',
      width: 220,
      render: (value) => compactList(value, 3),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 150,
      render: (_, record) => upstreamHealthSummary(record),
    },
    {
      title: '路由权重',
      key: 'routing',
      width: 140,
      render: (_, record) => (
        <Text>
          {record.priority} / {record.weight}
        </Text>
      ),
    },
    { title: '并发', dataIndex: 'maxConcurrency', width: 100, render: (value) => value || '-' },
    { title: '更新时间', dataIndex: 'updatedAt', width: 140, render: formatDateTime },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space className="soha-row-action-icons">
          <ManagementIconButton
            size="small"
            tooltip="测试"
            aria-label="测试上游"
            icon={<CheckOutlined />}
            disabled={!canRelayManage || record.status === 'disabled'}
            loading={testUpstreamMutation.isPending}
            onClick={() => testUpstreamMutation.mutate(record)}
          />
          <ManagementIconButton
            size="small"
            tooltip="编辑"
            aria-label="编辑上游"
            icon={<EditOutlined />}
            disabled={!canRelayManage}
            onClick={() => setDrawer({ kind: 'relay-upstream', record })}
          />
          <Popconfirm
            title="禁用上游？"
            description="该操作会停止新的模型中转请求选择该上游。"
            okButtonProps={{ danger: true, loading: disableUpstreamMutation.isPending }}
            onConfirm={() => disableUpstreamMutation.mutate(record)}
          >
            <ManagementIconButton
              size="small"
              tooltip="禁用"
              aria-label="禁用上游"
              danger
              icon={<StopOutlined />}
              loading={disableUpstreamMutation.isPending}
              disabled={!canRelayManage || record.status === 'disabled'}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const modelRouteColumns: TableColumnsType<LLMModelRoute> = [
    {
      title: 'Public model',
      dataIndex: 'publicModel',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.publicModel}</Text>
          <Text type="secondary">{record.routeGroup || 'default'}</Text>
        </Space>
      ),
    },
    {
      title: 'Provider',
      dataIndex: 'providerKind',
      width: 150,
      render: (value) => (value ? <Tag>{value}</Tag> : <Text type="secondary">any</Text>),
    },
    {
      title: '上游',
      dataIndex: 'upstreamId',
      width: 220,
      render: (value) => {
        const upstream = upstreams.find((item) => item.id === value)
        return (
          <Space orientation="vertical" size={0}>
            <Text>{upstream?.name || value || 'auto'}</Text>
            <Text type="secondary">{value || '-'}</Text>
          </Space>
        )
      },
    },
    {
      title: 'Upstream model',
      dataIndex: 'upstreamModel',
      width: 220,
      render: (value) => <Tag>{value}</Tag>,
    },
    {
      title: '优先级 / 权重',
      key: 'routing',
      width: 140,
      render: (_, record) => (
        <Text>
          {record.priority} / {record.weight}
        </Text>
      ),
    },
    { title: '策略', key: 'policy', width: 180, render: (_, record) => routePolicySummary(record) },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (value) => <StatusTag value={value ? 'enabled' : 'disabled'} />,
    },
    { title: '更新时间', dataIndex: 'updatedAt', width: 140, render: formatDateTime },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 130,
      render: (_, record) => (
        <Space className="soha-row-action-icons">
          <ManagementIconButton
            size="small"
            tooltip="复制"
            aria-label="复制模型路由"
            icon={<CopyOutlined />}
            disabled={!canRelayManage}
            onClick={() =>
              setDrawer({
                kind: 'relay-route',
                initialValues: {
                  ...record,
                  id: undefined,
                  publicModel: `${record.publicModel}-copy`,
                  enabled: 'true',
                  transformPolicyJson: jsonTextFromRecord(record.transformPolicy),
                  fallbackPolicyJson: jsonTextFromRecord(record.fallbackPolicy),
                  cachePolicyJson: jsonTextFromRecord(record.cachePolicy),
                  metadataJson: jsonTextFromRecord(record.metadata),
                },
              })
            }
          />
          <ManagementIconButton
            size="small"
            tooltip="编辑"
            aria-label="编辑模型路由"
            icon={<EditOutlined />}
            disabled={!canRelayManage}
            onClick={() => setDrawer({ kind: 'relay-route', record })}
          />
          <Popconfirm
            title="删除模型路由？"
            description="删除后该 public model 不再使用这条路由。"
            okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
            onConfirm={() => deleteMutation.mutate({ kind: 'model-route', id: record.id })}
          >
            <ManagementIconButton
              size="small"
              tooltip="删除"
              aria-label="删除模型路由"
              danger
              icon={<DeleteOutlined />}
              disabled={!canRelayManage}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const modelCallColumns: TableColumnsType<LLMCallLog> = [
    { title: '时间', dataIndex: 'createdAt', width: 140, render: formatDateTime },
    {
      title: '调用者',
      dataIndex: 'actorId',
      width: 220,
      render: (_, record) => modelCallActor(record),
    },
    {
      title: 'Token',
      dataIndex: 'tokenPrefix',
      width: 180,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.tokenPrefix || record.tokenId || '-'}</Text>
          <Text type="secondary">{record.tokenKind || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '模型 / 上游',
      dataIndex: 'publicModel',
      width: 320,
      render: (_, record) => modelCallRoute(record),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 150,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <StatusTag value={record.status} />
          <Text type="secondary">
            {record.httpStatus || '-'} / {record.upstreamStatus || '-'}
          </Text>
        </Space>
      ),
    },
    { title: '用量', key: 'usage', width: 190, render: (_, record) => modelCallUsage(record) },
    { title: '延迟', key: 'latency', width: 150, render: (_, record) => modelCallLatency(record) },
    {
      title: 'Cache',
      dataIndex: 'cacheStatus',
      width: 120,
      render: (value) => (value ? <Tag>{value}</Tag> : <Text type="secondary">-</Text>),
    },
    {
      title: '错误',
      key: 'error',
      render: (_, record) =>
        record.errorCode || record.errorMessage ? (
          <Paragraph
            style={{ marginBottom: 0 }}
            ellipsis={{
              rows: 2,
              tooltip: [record.errorCode, record.errorMessage].filter(Boolean).join(': '),
            }}
          >
            {[record.errorCode, record.errorMessage].filter(Boolean).join(': ')}
          </Paragraph>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ]

  const relayRankingColumns: TableColumnsType<{ key: string; count: number }> = [
    { title: '模型', dataIndex: 'key', render: (value) => <Tag>{value}</Tag> },
    { title: '调用数', dataIndex: 'count', width: 120, render: formatNumber },
  ]

  const tokenColumns: TableColumnsType<PersonalAccessToken> = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary">{record.tokenPrefix}</Text>
        </Space>
      ),
    },
    { title: 'Owner', dataIndex: 'userId', width: 180, render: (value) => <Tag>{value}</Tag> },
    {
      title: '用途',
      key: 'purpose',
      width: 120,
      render: (_, record) => tokenPurposeSummary(record),
    },
    {
      title: 'Relay 限制',
      key: 'relayLimits',
      width: 260,
      render: (_, record) => tokenRelayLimitsSummary(record.metadata),
    },
    { title: '权限', dataIndex: 'permissionKeys', render: (value) => compactList(value, 3) },
    { title: '过期', dataIndex: 'expiresAt', width: 140, render: formatDateTime },
    { title: '最近使用', dataIndex: 'lastUsedAt', width: 140, render: formatDateTime },
    {
      title: '状态',
      key: 'status',
      width: 110,
      render: (_, record) => <StatusTag value={tokenStatus(record)} />,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => {
        const isOwner = record.userId === currentUser?.userId
        const canRotate = canInvoke && isOwner
        const canRevoke = canManage || (canInvoke && isOwner)
        return (
          <Space className="soha-row-action-icons">
            <Popconfirm
              title="轮换 personal login key？"
              description="旧 key 会被吊销，新明文只展示一次。只有 owner 本人可以轮换。"
              okButtonProps={{ loading: rotateTokenMutation.isPending }}
              onConfirm={() =>
                rotateTokenMutation.mutate({ kind: 'personal-token', id: record.id })
              }
            >
              <ManagementIconButton
                size="small"
                tooltip="轮换"
                aria-label="轮换 personal login key"
                icon={<ReloadOutlined />}
                loading={rotateTokenMutation.isPending}
                disabled={!canRotate || !!record.revokedAt}
              />
            </Popconfirm>
            <Popconfirm
              title="吊销 personal login key？"
              description="吊销后该 key 将不能再登录或调用 AI Gateway，审计记录会保留。"
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              onConfirm={() => deleteMutation.mutate({ kind: 'personal-token', id: record.id })}
            >
              <ManagementIconButton
                size="small"
                tooltip="吊销"
                aria-label="吊销 personal login key"
                danger
                icon={<StopOutlined />}
                disabled={!canRevoke || !!record.revokedAt}
              />
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  const serviceAccountColumns: TableColumnsType<ServiceAccount> = [
    {
      title: '服务账号',
      dataIndex: 'name',
      width: 240,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value) => <StatusTag value={value} />,
    },
    { title: '角色', dataIndex: 'roleIds', render: (value) => compactList(value, 3) },
    { title: '组织', dataIndex: 'teamIds', render: (value) => compactList(value, 2) },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<KeyOutlined />}
            disabled={!canManage || record.status !== 'active'}
            onClick={() => setDrawer({ kind: 'service-token', record })}
          />
        </Space>
      ),
    },
  ]

  const serviceAccountTokenColumns: TableColumnsType<ServiceAccountToken> = [
    {
      title: 'Token',
      dataIndex: 'name',
      width: 240,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.name || record.id}</Text>
          <Text type="secondary">{record.tokenPrefix || record.id}</Text>
        </Space>
      ),
    },
    {
      title: '服务账号',
      dataIndex: 'serviceAccountId',
      width: 180,
      render: (value) => <Tag>{value}</Tag>,
    },
    {
      title: '用途',
      key: 'purpose',
      width: 120,
      render: (_, record) => tokenPurposeSummary(record),
    },
    {
      title: 'Relay 限制',
      key: 'relayLimits',
      width: 260,
      render: (_, record) => tokenRelayLimitsSummary(record.metadata),
    },
    { title: '权限', dataIndex: 'permissionKeys', render: (value) => compactList(value, 3) },
    { title: 'Scopes', dataIndex: 'scopes', render: (value) => compactList(value, 2) },
    { title: '过期', dataIndex: 'expiresAt', width: 140, render: formatDateTime },
    { title: '最近使用', dataIndex: 'lastUsedAt', width: 140, render: formatDateTime },
    {
      title: '状态',
      key: 'status',
      width: 110,
      render: (_, record) => <StatusTag value={tokenStatus(record)} />,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space className="soha-row-action-icons">
          <Popconfirm
            title="轮换服务账号 token？"
            description="系统会生成新明文并吊销旧 token，新明文只展示一次。"
            okButtonProps={{ loading: rotateTokenMutation.isPending }}
            onConfirm={() => rotateTokenMutation.mutate({ kind: 'service-token', id: record.id })}
          >
            <ManagementIconButton
              size="small"
              tooltip="轮换"
              aria-label="轮换服务 token"
              icon={<ReloadOutlined />}
              loading={rotateTokenMutation.isPending}
              disabled={!canManage || !!record.revokedAt}
            />
          </Popconfirm>
          <ManagementIconButton
            size="small"
            tooltip="吊销"
            aria-label="吊销服务 token"
            danger
            icon={<StopOutlined />}
            disabled={!canManage || !!record.revokedAt}
            onClick={() =>
              setDrawer({ kind: 'service-token-revoke', initialValues: { tokenId: record.id } })
            }
          />
        </Space>
      ),
    },
  ]

  const grantColumns: TableColumnsType<ToolGrant> = [
    {
      title: 'Subject',
      dataIndex: 'subjectId',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.subjectId}</Text>
          <Text type="secondary">
            {record.subjectType}
            {record.aiClientId ? ` / ${record.aiClientId}` : ''}
          </Text>
        </Space>
      ),
    },
    { title: 'Tool', dataIndex: 'toolName', width: 240, render: (value) => <Tag>{value}</Tag> },
    {
      title: 'Effect',
      dataIndex: 'effect',
      width: 100,
      render: (value) => <StatusTag value={value} />,
    },
    {
      title: 'Risk',
      dataIndex: 'riskLevel',
      width: 100,
      render: (value) => <StatusTag value={value} />,
    },
    { title: 'Scope', dataIndex: 'resourceScopes', render: scopeSummary },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="删除 MCP tool grant？"
          description="该操作会立即更新 AI Gateway 控制面。"
          okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
          onConfirm={() => deleteMutation.mutate({ kind: 'grant', id: record.id })}
        >
          <ManagementIconButton
            size="small"
            tooltip="删除"
            aria-label="删除 MCP tool grant"
            danger
            icon={<DeleteOutlined />}
            disabled={!canManage}
          />
        </Popconfirm>
      ),
    },
  ]

  const policyColumns: TableColumnsType<AccessPolicy> = [
    {
      title: 'Policy',
      dataIndex: 'name',
      width: 240,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    {
      title: 'Subject',
      dataIndex: 'subjectId',
      width: 180,
      render: (_, record) => (
        <Text>
          {record.subjectType}:{record.subjectId}
        </Text>
      ),
    },
    {
      title: 'Effect',
      dataIndex: 'effect',
      width: 100,
      render: (value) => <StatusTag value={value} />,
    },
    {
      title: 'Risk',
      dataIndex: 'riskLevels',
      width: 160,
      render: (value) => compactList(value, 3),
    },
    { title: 'Conditions', dataIndex: 'conditions', width: 220, render: policyConditionSummary },
    { title: 'Scope', dataIndex: 'resourceScopes', render: scopeSummary },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (value) => <StatusTag value={value ? 'enabled' : 'disabled'} />,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 96,
      render: (_, record) => (
        <Space className="soha-row-action-icons">
          <ManagementIconButton
            size="small"
            tooltip="编辑"
            aria-label="编辑 access policy"
            icon={<EditOutlined />}
            disabled={!canManage}
            onClick={() => setDrawer({ kind: 'access-policy', record })}
          />
          <Popconfirm
            title="删除 access policy？"
            description="该操作会立即更新 AI Gateway 控制面。"
            okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
            onConfirm={() => deleteMutation.mutate({ kind: 'policy', id: record.id })}
          >
            <ManagementIconButton
              size="small"
              tooltip="删除"
              aria-label="删除 access policy"
              danger
              icon={<DeleteOutlined />}
              disabled={!canManage}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const bindingColumns: TableColumnsType<SkillBinding> = [
    {
      title: 'Subject',
      dataIndex: 'subjectId',
      width: 220,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.subjectId}</Text>
          <Text type="secondary">
            {record.subjectType}
            {record.aiClientId ? ` / ${record.aiClientId}` : ''}
          </Text>
        </Space>
      ),
    },
    { title: 'Skill', dataIndex: 'skillId', width: 180, render: (value) => <Tag>{value}</Tag> },
    {
      title: 'Capabilities',
      dataIndex: 'capabilityRefs',
      render: (value) => compactList(value, 4),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (value) => <StatusTag value={value ? 'enabled' : 'disabled'} />,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 96,
      render: (_, record) => (
        <Space className="soha-row-action-icons">
          <ManagementIconButton
            size="small"
            tooltip="编辑"
            aria-label="编辑 skill binding"
            icon={<EditOutlined />}
            disabled={!canManage}
            onClick={() => setDrawer({ kind: 'skill-binding', record })}
          />
          <Popconfirm
            title="删除 skill binding？"
            description="该操作会立即更新 AI Gateway 控制面。"
            okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
            onConfirm={() => deleteMutation.mutate({ kind: 'binding', id: record.id })}
          >
            <ManagementIconButton
              size="small"
              tooltip="删除"
              aria-label="删除 skill binding"
              danger
              icon={<DeleteOutlined />}
              disabled={!canManage}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const toolColumns: TableColumnsType<GatewayTool> = [
    {
      title: 'Tool',
      dataIndex: 'name',
      width: 280,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary">{record.title}</Text>
        </Space>
      ),
    },
    { title: 'Domain', dataIndex: 'domain', width: 120, render: (value) => <Tag>{value}</Tag> },
    { title: 'Action', dataIndex: 'action', width: 110 },
    {
      title: 'Risk',
      dataIndex: 'riskLevel',
      width: 100,
      render: (value) => <StatusTag value={value} />,
    },
    {
      title: 'Approval',
      dataIndex: 'requiresApproval',
      width: 110,
      render: (value) => <StatusTag value={value ? 'required' : 'none'} />,
    },
    { title: 'Scopes', dataIndex: 'requiredScopes', render: (value) => compactList(value, 4) },
  ]

  const auditColumns: TableColumnsType<GatewayAuditLog> = [
    { title: '时间', dataIndex: 'createdAt', width: 140, render: formatDateTime },
    {
      title: '调用者',
      dataIndex: 'actorId',
      width: 210,
      render: (_, record) => auditCaller(record),
    },
    {
      title: '调用入口',
      dataIndex: 'aiClientId',
      width: 200,
      render: (_, record) => auditEntryPoint(record),
    },
    {
      title: '调用内容',
      dataIndex: 'toolName',
      width: 340,
      render: (_, record) => auditInvocation(record),
    },
    { title: '结果', dataIndex: 'result', width: 120, render: (_, record) => auditResult(record) },
    {
      title: '摘要',
      dataIndex: 'summary',
      render: (value) => (
        <Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, tooltip: value }}>
          {value}
        </Paragraph>
      ),
    },
  ]

  const approvalColumns: TableColumnsType<ApprovalRequest> = [
    { title: '创建时间', dataIndex: 'createdAt', width: 140, render: formatDateTime },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value) => <StatusTag value={value} />,
    },
    {
      title: 'Actor',
      dataIndex: 'actorId',
      width: 190,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.actorName || record.actorId}</Text>
          <Text type="secondary">
            {record.actorType}:{record.actorId}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Client / Skill',
      dataIndex: 'aiClientId',
      width: 180,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.aiClientName || record.aiClientId || '-'}</Text>
          <Text type="secondary">{record.skillId || '-'}</Text>
        </Space>
      ),
    },
    { title: 'Tool', dataIndex: 'toolName', width: 240, render: (value) => <Tag>{value}</Tag> },
    {
      title: 'Risk',
      dataIndex: 'riskLevel',
      width: 100,
      render: (value) => <StatusTag value={value} />,
    },
    { title: '策略', dataIndex: 'strategy', width: 170, render: (value) => <Tag>{value}</Tag> },
    {
      title: 'Trace',
      key: 'trace',
      width: 190,
      render: (_, record) => {
        const trace = approvalTrace(record)
        return trace.workflowRunId ? (
          <Space orientation="vertical" size={0}>
            <Button
              size="small"
              type="link"
              icon={<LinkOutlined />}
              onClick={() => navigate(workflowTracePath(trace))}
            >
              {trace.workflowRunId}
            </Button>
            <Text type="secondary">{trace.approvalRequestId}</Text>
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        )
      },
    },
    { title: '过期', dataIndex: 'expiresAt', width: 140, render: formatDateTime },
    {
      title: '摘要',
      dataIndex: 'summary',
      render: (value) => (
        <Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, tooltip: value }}>
          {value}
        </Paragraph>
      ),
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<CheckOutlined />}
            disabled={!canManage || !isPendingApproval(record)}
            loading={decisionMutation.isPending}
            onClick={() => setDecisionTarget({ action: 'approve', record })}
          />
          <Button
            size="small"
            danger
            icon={<CloseOutlined />}
            disabled={!canManage || !isPendingApproval(record)}
            loading={decisionMutation.isPending}
            onClick={() => setDecisionTarget({ action: 'reject', record })}
          />
          <Button
            size="small"
            icon={<StopOutlined />}
            disabled={!canManage || !isPendingApproval(record)}
            loading={decisionMutation.isPending}
            onClick={() => setDecisionTarget({ action: 'cancel', record })}
          />
        </Space>
      ),
    },
  ]

  const governanceHealthColumns: TableColumnsType<GovernanceHealthCheck> = [
    { title: 'Check', dataIndex: 'name', width: 220, render: (value) => <Tag>{value}</Tag> },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (value) => <StatusTag value={value} />,
    },
    { title: 'Count', dataIndex: 'count', width: 90, render: (value) => value ?? 0 },
    {
      title: 'Message',
      dataIndex: 'message',
      render: (value) => (
        <Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, tooltip: value }}>
          {value}
        </Paragraph>
      ),
    },
  ]

  const governanceCoverageColumns: TableColumnsType<
    ReturnType<typeof governanceCoverageRows>[number]
  > = [
    { title: 'Control', dataIndex: 'label', width: 180 },
    {
      title: 'State',
      dataIndex: 'state',
      width: 150,
      render: (value) => <StatusTag value={value} />,
    },
    { title: 'Configured', dataIndex: 'configured', width: 120 },
    { title: 'Total', dataIndex: 'total', width: 100 },
    {
      title: '',
      key: 'actions',
      width: 130,
      render: (_, record) => (
        <Button
          size="small"
          type="link"
          onClick={() => applyGovernanceDrilldown(governanceCoverageDrilldown(record))}
        >
          {['access_policies', 'budget', 'rate_limit', 'redaction', 'resource_scopes'].includes(
            record.key,
          )
            ? '创建 policy'
            : '定位'}
        </Button>
      ),
    },
  ]

  const governanceFindingColumns: TableColumnsType<GovernanceFinding> = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 120,
      render: (value) => <StatusTag value={value} />,
    },
    { title: 'Type', dataIndex: 'type', width: 250, render: (value) => <Tag>{value}</Tag> },
    { title: 'Count', dataIndex: 'count', width: 90, render: (value) => value ?? 1 },
    {
      title: 'Risk',
      dataIndex: 'riskLevel',
      width: 100,
      render: (value) => (value ? <StatusTag value={value} /> : '-'),
    },
    {
      title: 'Target',
      key: 'target',
      width: 320,
      render: (_, record) => governanceFindingTarget(record),
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      render: (value) => (
        <Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, tooltip: value }}>
          {value}
        </Paragraph>
      ),
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 230,
      render: (_, record) => (
        <Space wrap size={4}>
          {governanceFindingDrilldownActions(record)
            .slice(0, 4)
            .map((action) => (
              <Button
                key={`${record.type}:${action.label}`}
                size="small"
                type="link"
                onClick={() => applyGovernanceDrilldown(action.target)}
              >
                {action.label}
              </Button>
            ))}
        </Space>
      ),
    },
  ]

  const governanceMetricColumns: TableColumnsType<GovernanceMetricCount> = [
    { title: 'Key', dataIndex: 'key', render: (value) => <Tag>{value}</Tag> },
    { title: 'Count', dataIndex: 'count', width: 90 },
  ]

  const governanceRedactionColumns: TableColumnsType<GovernanceRedactionRow> = [
    { title: 'Dimension', dataIndex: 'label', width: 160 },
    { title: 'Count', dataIndex: 'count', width: 100 },
    {
      title: 'Top values',
      dataIndex: 'items',
      render: (items: GovernanceMetricCount[]) =>
        compactList(
          items.map((item) => `${item.key}:${item.count}`),
          6,
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, record) =>
        record.target ? (
          <Button size="small" type="link" onClick={() => applyGovernanceDrilldown(record.target!)}>
            定位
          </Button>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ]

  const governanceQueueColumns: TableColumnsType<
    ReturnType<typeof governanceApprovalQueueRows>[number]
  > = [
    { title: 'Queue', dataIndex: 'label', width: 220 },
    { title: 'Count', dataIndex: 'count', width: 90 },
    {
      title: 'IDs',
      dataIndex: 'refs',
      render: (value: string[], record) =>
        value?.length ? (
          <Space size={[4, 4]} wrap>
            {value.slice(0, 5).map((item) => (
              <Button
                key={item}
                size="small"
                type="link"
                onClick={() => applyGovernanceDrilldown(governanceQueueDrilldown(record, item))}
              >
                {item}
              </Button>
            ))}
            {value.length > 5 ? <Tag>+{value.length - 5}</Tag> : null}
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          size="small"
          type="link"
          disabled={!record.refs.length}
          onClick={() =>
            applyGovernanceDrilldown(governanceQueueDrilldown(record, record.refs[0] ?? ''))
          }
        >
          定位
        </Button>
      ),
    },
  ]

  const governanceTokenFindingColumns: TableColumnsType<GovernanceTokenFindingRow> = [
    {
      title: 'Category',
      dataIndex: 'categoryLabel',
      width: 150,
      render: (value) => <Tag>{value}</Tag>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 120,
      render: (value) => <StatusTag value={value} />,
    },
    {
      title: 'Token',
      dataIndex: 'name',
      width: 260,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.name || record.id}</Text>
          <Text type="secondary">
            {record.kind} / {record.tokenPrefix || record.id}
          </Text>
        </Space>
      ),
    },
    { title: 'Owner', dataIndex: 'ownerId', width: 180, render: (value) => value || '-' },
    {
      title: 'Timing',
      key: 'timing',
      width: 220,
      render: (_, record) => governanceTokenTiming(record),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      render: (value) => (
        <Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, tooltip: value }}>
          {value}
        </Paragraph>
      ),
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Button
          size="small"
          type="link"
          onClick={() => applyGovernanceDrilldown(governanceTokenFindingDrilldown(record))}
        >
          {record.kind === 'service_account_token' ? '吊销 token' : '查看 PAT'}
        </Button>
      ),
    },
  ]

  const governanceRecommendationColumns: TableColumnsType<GovernanceRecommendationAction> = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 110,
      render: (value) => <StatusTag value={value} />,
    },
    { title: 'Type', dataIndex: 'type', width: 210, render: (value) => <Tag>{value}</Tag> },
    { title: 'Action', dataIndex: 'action', width: 230, render: (value) => <Tag>{value}</Tag> },
    {
      title: 'Target',
      key: 'target',
      width: 210,
      render: (_, record) =>
        compactList(
          [record.targetKind, record.targetId, ...(record.refs ?? []).slice(0, 2)].flatMap(
            (item) => (item ? [item] : []),
          ),
          3,
        ),
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      render: (value) => (
        <Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, tooltip: value }}>
          {value}
        </Paragraph>
      ),
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 130,
      render: (_, record) => {
        const action = governanceRecommendationDrilldownAction(record)
        return action ? (
          <Button size="small" type="link" onClick={() => applyGovernanceDrilldown(action.target)}>
            {action.label}
          </Button>
        ) : (
          <Text type="secondary">-</Text>
        )
      },
    },
  ]

  if (!canUseGateway && !permissionSnapshot.isLoading) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有 AI Gateway 权限。" />
      </div>
    )
  }

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title="企业 AI 运维控制面"
        description="统一管理 AI client、用户 login key、service account、tool grant、access policy、skill binding、审批与调用日志。"
        actions={
          <ManagementTableToolbar>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
              刷新
            </Button>
          </ManagementTableToolbar>
        }
      />

      <Card
        size="small"
        variant="outlined"
        className="soha-management-panel-card"
        title={cardTitle(<SafetyCertificateOutlined />, gatewayPanelMeta.title)}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">{gatewayPanelMeta.description}</Text>
          {section === 'tokens' || section === 'governance' || section === 'call-logs' ? (
            <Text type="secondary">
              {sectionActiveTab === 'tokens'
                ? '用户 login key 在这里聚合展示；管理员可吊销，明文只在生成或轮换后展示一次。'
                : gatewayMenuMeta[sectionActiveTab].description}
            </Text>
          ) : null}
          {
            <Suspense
              fallback={
                <ManagementState
                  bordered={false}
                  compact
                  title="正在加载 AI Gateway"
                  description="正在准备当前控制面分区。"
                />
              }
            >
              {section === 'relay' ? (
                <GatewayRelaySection
                  activeTab={sectionActiveTab}
                  onTabChange={setActiveTab}
                  metrics={{
                    requests: formatNumber(
                      relayMetric(relayMetrics, 'requestsToday', 'totalCalls'),
                    ),
                    successRate: formatPercent(relayMetric(relayMetrics, 'successRate')),
                    failure: formatNumber(relayMetric(relayMetrics, 'failureCount')),
                    ttfb: formatDurationMs(relayMetric(relayMetrics, 'averageTTFBMs', 'avgTTFBMs')),
                    ttft: formatDurationMs(relayMetric(relayMetrics, 'averageTTFTMs', 'avgTTFTMs')),
                    duration: formatDurationMs(
                      relayMetric(relayMetrics, 'averageDurationMs', 'avgDurationMs'),
                    ),
                    tokensPerSecond: formatNumber(relayMetric(relayMetrics, 'tokensPerSecond')),
                    cache: `${formatNumber(relayMetric(relayMetrics, 'cacheHitCount'))} hit / ${formatNumber(relayMetric(relayMetrics, 'cacheReadTokens'))} read / ${formatNumber(relayMetric(relayMetrics, 'cacheWriteTokens'))} write`,
                  }}
                  rankingColumns={relayRankingColumns}
                  ranking={relayModelRanking(relayMetrics)}
                  metricsLoading={relayMetricsQuery.isLoading}
                  metricsFetching={relayMetricsQuery.isFetching}
                  recentErrors={(
                    relayMetrics?.recentErrors ??
                    modelCalls.filter((item) => item.status && item.status !== 'success')
                  ).slice(0, 5)}
                  modelCallColumns={modelCallColumns}
                  modelCalls={modelCalls}
                  modelCallsLoading={modelCallsQuery.isLoading}
                  modelCallsFetching={modelCallsQuery.isFetching}
                  modelCallFilters={modelCallFilters}
                  onModelCallFiltersChange={setModelCallFilters}
                  canRelayManage={canRelayManage}
                  upstreamColumns={upstreamColumns}
                  upstreams={filteredUpstreams}
                  upstreamsLoading={upstreamsQuery.isLoading}
                  upstreamsFetching={upstreamsQuery.isFetching}
                  upstreamFilter={upstreamFilter}
                  upstreamProviderFilter={upstreamProviderFilter}
                  upstreamStatusFilter={upstreamStatusFilter}
                  onUpstreamFilterChange={setUpstreamFilter}
                  onUpstreamProviderFilterChange={setUpstreamProviderFilter}
                  onUpstreamStatusFilterChange={setUpstreamStatusFilter}
                  onRefreshUpstreams={() => void upstreamsQuery.refetch()}
                  onCreateUpstream={() => setDrawer({ kind: 'relay-upstream' })}
                  modelRouteColumns={modelRouteColumns}
                  modelRoutes={filteredModelRoutes}
                  modelRoutesLoading={modelRoutesQuery.isLoading}
                  modelRoutesFetching={modelRoutesQuery.isFetching}
                  modelRouteFilter={modelRouteFilter}
                  modelRouteProviderFilter={modelRouteProviderFilter}
                  modelRouteUpstreamFilter={modelRouteUpstreamFilter}
                  onModelRouteFilterChange={setModelRouteFilter}
                  onModelRouteProviderFilterChange={setModelRouteProviderFilter}
                  onModelRouteUpstreamFilterChange={setModelRouteUpstreamFilter}
                  onRefreshModelRoutes={() => void modelRoutesQuery.refetch()}
                  onCreateModelRoute={() => setDrawer({ kind: 'relay-route' })}
                  onRefreshAll={() => void refreshAll()}
                  onRefreshModelCalls={() => void modelCallsQuery.refetch()}
                  expandedErrorRowRender={(record) => (
                    <JsonBlock
                      value={{
                        requestId: record.requestId,
                        routeTrace: record.routeTrace,
                        metadata: record.metadata,
                        errorCode: record.errorCode,
                        errorMessage: record.errorMessage,
                      }}
                    />
                  )}
                  expandedModelCallRowRender={(record) => (
                    <JsonBlock
                      value={{
                        requestId: record.requestId,
                        sourceIp: record.sourceIp,
                        userAgent: record.userAgent,
                        routeTrace: record.routeTrace,
                        metadata: record.metadata,
                      }}
                    />
                  )}
                />
              ) : section === 'manifest' ? (
                <GatewayManifestSection
                  manifest={manifest}
                  loading={manifestQuery.isLoading}
                  clients={clients}
                  filters={manifestFilters}
                  toolColumns={toolColumns}
                  onFiltersChange={setManifestFilters}
                  onRefresh={() => void manifestQuery.refetch()}
                />
              ) : section === 'clients' ? (
                <GatewayClientsSection
                  columns={aiClientColumns}
                  clients={filteredClients}
                  loading={clientsQuery.isLoading}
                  canManage={canManage}
                  filter={clientFilter}
                  onFilterChange={setClientFilter}
                  onCreate={() => setDrawer({ kind: 'ai-client' })}
                />
              ) : section === 'tokens' ? (
                <GatewayTokensSection
                  activeTab={sectionActiveTab}
                  onTabChange={setActiveTab}
                  tokenColumns={tokenColumns}
                  personalTokens={filteredPersonalTokens}
                  personalTokensLoading={personalTokensQuery.isLoading}
                  serviceAccountColumns={serviceAccountColumns}
                  serviceAccounts={serviceAccounts}
                  serviceAccountsLoading={serviceAccountsQuery.isLoading}
                  serviceTokenColumns={serviceAccountTokenColumns}
                  serviceTokens={filteredServiceAccountTokens}
                  serviceTokensLoading={serviceAccountTokensQuery.isLoading}
                  canManage={canManage}
                  canInvoke={canInvoke}
                  tokenFilter={tokenFilter}
                  serviceTokenFilter={serviceTokenFilter}
                  onTokenFilterChange={setTokenFilter}
                  onServiceTokenFilterChange={setServiceTokenFilter}
                  onCreatePersonalToken={() => setDrawer({ kind: 'personal-token' })}
                  onCreateServiceAccount={() => setDrawer({ kind: 'service-account' })}
                  onRevokeServiceToken={() => setDrawer({ kind: 'service-token-revoke' })}
                />
              ) : section === 'governance' ? (
                <GatewayGovernanceSection
                  activeTab={sectionActiveTab}
                  onTabChange={setActiveTab}
                  canManage={canManage}
                  grantColumns={grantColumns}
                  grants={filteredGrants}
                  grantsLoading={grantsQuery.isLoading}
                  grantFilter={grantFilter}
                  onGrantFilterChange={setGrantFilter}
                  onCreateGrant={() => setDrawer({ kind: 'tool-grant' })}
                  policyColumns={policyColumns}
                  policies={filteredPolicies}
                  policiesLoading={policiesQuery.isLoading}
                  policyFilter={policyFilter}
                  onPolicyFilterChange={setPolicyFilter}
                  onCreatePolicy={() => setDrawer({ kind: 'access-policy' })}
                  bindingColumns={bindingColumns}
                  bindings={bindings}
                  bindingsLoading={bindingsQuery.isLoading}
                  onCreateBinding={() => setDrawer({ kind: 'skill-binding' })}
                  governanceStatus={governanceStatus}
                  governanceLoading={governanceQuery.isLoading}
                  governanceFetching={governanceQuery.isFetching}
                  governanceWindowHours={governanceWindowHours}
                  onGovernanceWindowChange={setGovernanceWindowHours}
                  onRefreshGovernance={() => void governanceQuery.refetch()}
                  governanceHealthColumns={governanceHealthColumns}
                  governanceCoverageColumns={governanceCoverageColumns}
                  governanceFindingColumns={governanceFindingColumns}
                  governanceMetricColumns={governanceMetricColumns}
                  governanceRedactionColumns={governanceRedactionColumns}
                  governanceQueueColumns={governanceQueueColumns}
                  governanceTokenFindingColumns={governanceTokenFindingColumns}
                  governanceRecommendationColumns={governanceRecommendationColumns}
                  approvalColumns={approvalColumns}
                  approvals={approvalRequests}
                  approvalsLoading={approvalsQuery.isLoading}
                  approvalFilters={approvalFilters}
                  clients={clients}
                  manifest={manifest}
                  onApprovalFiltersChange={setApprovalFilters}
                  onRefreshApprovals={() => void approvalsQuery.refetch()}
                  expandedApprovalRowRender={(record) => <ApprovalTracePanel record={record} />}
                />
              ) : (
                <GatewayCallLogsSection
                  activeTab={sectionActiveTab}
                  onTabChange={setActiveTab}
                  columns={auditColumns}
                  logs={auditLogs}
                  loading={auditQuery.isLoading}
                  filters={auditFilters}
                  clients={clients}
                  manifest={manifest}
                  modelCallColumns={modelCallColumns}
                  modelCalls={modelCalls}
                  modelCallsLoading={modelCallsQuery.isLoading}
                  modelCallsFetching={modelCallsQuery.isFetching}
                  modelCallFilters={modelCallFilters}
                  upstreams={upstreams}
                  canRelayManage={canRelayManage}
                  onModelCallFiltersChange={setModelCallFilters}
                  onRefreshModelCalls={() => void modelCallsQuery.refetch()}
                  expandedModelCallRowRender={(record) => (
                    <JsonBlock
                      value={{
                        requestId: record.requestId,
                        sourceIp: record.sourceIp,
                        userAgent: record.userAgent,
                        routeTrace: record.routeTrace,
                        metadata: record.metadata,
                      }}
                    />
                  )}
                  onFiltersChange={setAuditFilters}
                  onRefresh={() => void auditQuery.refetch()}
                  expandedRowRender={(record) => (
                    <JsonBlock
                      value={{
                        requestId: record.requestId,
                        sourceIp: record.sourceIp,
                        resourceScope: record.resourceScope,
                        metadata: record.metadata,
                      }}
                    />
                  )}
                />
              )}
            </Suspense>
          }
        </Space>
      </Card>

      {drawer ? (
        <Suspense fallback={null}>
          <GatewayEditorDrawer
            drawer={drawer}
            form={form}
            initialValues={drawerInitialValues}
            clients={clients}
            manifest={manifest}
            upstreams={upstreams}
            saving={upsertMutation.isPending}
            onClose={() => setDrawer(null)}
            onSubmit={(values) => upsertMutation.mutate(values)}
          />
        </Suspense>
      ) : null}

      <Modal
        title={oneTimeToken?.title}
        open={!!oneTimeToken}
        onCancel={() => setOneTimeToken(null)}
        footer={
          <Button type="primary" onClick={() => setOneTimeToken(null)}>
            关闭
          </Button>
        }
      >
        <Alert
          type="warning"
          showIcon
          title="token 只展示一次；关闭后无法再次查看明文。"
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea value={oneTimeToken?.value} autoSize={{ minRows: 3 }} readOnly />
        {oneTimeToken?.prefix ? <Text type="secondary">prefix: {oneTimeToken.prefix}</Text> : null}
      </Modal>

      <Modal
        title={decisionModalTitle(decisionTarget)}
        open={!!decisionTarget}
        onCancel={() => setDecisionTarget(null)}
        okText="确认"
        cancelText="取消"
        confirmLoading={decisionMutation.isPending}
        okButtonProps={{ danger: decisionTarget?.action !== 'approve' }}
        onOk={() => {
          void decisionForm.validateFields().then((values) => {
            if (!decisionTarget) return
            decisionMutation.mutate({
              action: decisionTarget.action,
              id: decisionTarget.record.id,
              comment: values.comment,
            })
          })
        }}
      >
        {decisionTarget ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions
              size="small"
              column={1}
              bordered
              items={[
                { key: 'tool', label: 'Tool', children: decisionTarget.record.toolName },
                {
                  key: 'actor',
                  label: 'Actor',
                  children: `${decisionTarget.record.actorType}:${decisionTarget.record.actorId}`,
                },
                {
                  key: 'scope',
                  label: 'Scope',
                  children: scopeSummary(decisionTarget.record.resourceScope),
                },
              ]}
            />
            <Form form={decisionForm} layout="vertical">
              <Form.Item name="comment" label="备注">
                <Input.TextArea autoSize={{ minRows: 3 }} />
              </Form.Item>
            </Form>
          </Space>
        ) : null}
      </Modal>
    </div>
  )
}

function defaultFormValues(kind: DrawerKind) {
  switch (kind) {
    case 'ai-client':
      return { kind: 'mcp_client', status: 'active' }
    case 'relay-upstream':
      return {
        providerKind: 'openai',
        status: 'active',
        priority: 100,
        weight: 100,
        timeoutSeconds: 120,
        streamTimeoutSeconds: 300,
        maxConcurrency: 0,
      }
    case 'relay-route':
      return {
        providerKind: undefined,
        routeGroup: 'default',
        priority: 100,
        weight: 100,
        enabled: 'true',
      }
    case 'personal-token':
      return { purpose: 'mcp-tools' }
    case 'service-account':
      return { status: 'active' }
    case 'service-token':
      return { purpose: 'mcp-tools' }
    case 'tool-grant':
      return { subjectType: 'role', effect: 'allow', riskLevel: 'read', requiresApproval: 'false' }
    case 'access-policy':
      return {
        subjectType: 'role',
        effect: 'allow',
        enabled: 'true',
        approvalMode: 'none',
        approvalRoutingMode: 'all',
        rateLimitEnabled: false,
        rateLimitMode: 'counter',
        rateLimitScope: 'actor_client_tool',
        budgetEnabled: false,
        budgetScope: 'actor_client',
        redactionEnabled: false,
        redactionMode: 'none',
        redactionTarget: 'input',
        redactionReplacement: '[REDACTED]',
        redactionPreserveFormat: false,
        outputRedactionReplacement: '[REDACTED]',
        outputRedactionPreserveFormat: false,
      }
    case 'skill-binding':
      return { subjectType: 'role', enabled: 'true' }
    default:
      return {}
  }
}

function drawerFormInitialValues(drawer: DrawerState) {
  const record = drawer.record as any
  const initialValues = drawer.initialValues ?? {}
  if (!record) {
    return { ...defaultFormValues(drawer.kind), ...initialValues }
  }
  if (drawer.kind === 'relay-upstream') {
    const upstream = record as LLMUpstream
    return {
      ...defaultFormValues(drawer.kind),
      ...upstream,
      apiKey: '',
      defaultHeadersJson: jsonTextFromRecord(upstream.defaultHeaders),
      metadataJson: jsonTextFromRecord(upstream.metadata),
      ...initialValues,
    }
  }
  if (drawer.kind === 'relay-route') {
    const route = record as LLMModelRoute
    return {
      ...defaultFormValues(drawer.kind),
      ...route,
      enabled: route.enabled ? 'true' : 'false',
      transformPolicyJson: jsonTextFromRecord(route.transformPolicy),
      fallbackPolicyJson: jsonTextFromRecord(route.fallbackPolicy),
      cachePolicyJson: jsonTextFromRecord(route.cachePolicy),
      metadataJson: jsonTextFromRecord(route.metadata),
      ...initialValues,
    }
  }
  if (drawer.kind === 'access-policy') {
    return { ...accessPolicyFormValuesFromRecord(record as AccessPolicy), ...initialValues }
  }
  return {
    ...record,
    redirectUris: record.redirectUris,
    allowedOrigins: record.allowedOrigins,
    roleIds: record.roleIds,
    teamIds: record.teamIds,
    scopeGrantIds: record.scopeGrantIds,
    permissionKeys: record.permissionKeys,
    capabilityRefs: record.capabilityRefs,
    ...scopeValuesFromRecord(record.resourceScopes),
    ...initialValues,
  }
}

function decisionModalTitle(
  target: { action: 'approve' | 'reject' | 'cancel'; record: ApprovalRequest } | null,
) {
  if (!target) return ''
  if (target.action === 'approve') return '批准并执行审批请求'
  if (target.action === 'reject') return '拒绝审批请求'
  return '取消审批请求'
}
