import { useEffect, useMemo, useRef, useState } from 'react'
import type { LogEntry, LogQuery, LogStreamEvent } from '@opensoha/contracts/gen/ts/sohaapi'
import {
  CodeOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExportOutlined,
  FilterOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Flex,
  Form,
  Input,
  Segmented,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ManagementIconButton, ManagementState } from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { ApiError } from '@/services/api-client'
import { downloadText } from '@/utils/download'
import { formatDateTime } from '@/utils/time'
import {
  buildLogStreamURL,
  issueLogStreamTicket,
  logTargetKey,
  queryLogs,
  type LogTarget,
} from './api'
import {
  buildLogExplorerPath,
  buildDurableLogQuery,
  buildDockerRuntimeLogQuery,
  buildRuntimeLogQuery,
  buildSohaQLExpression,
  formatLogExport,
  formatLogSource,
  mergeLogEntries,
  parseSohaQLExpression,
  type LogExplorerPreset,
  type RuntimeLogFilters,
} from './model'
import { observabilityLogQueries } from './queries'
import './styles.css'

const { Text } = Typography
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 15000]

interface LogExplorerProps {
  autoStart?: boolean
  clusterId?: string | null
  embedded?: boolean
  namespace?: string | null
  preset?: LogExplorerPreset
  syncURL?: boolean
  target?: LogTarget
}

interface SubmittedLogQuery {
  mode: 'live' | 'history'
  query: LogQuery
  target: LogTarget
}

type QueryEditorMode = 'query' | 'builder'

const LOG_FIELDS = [
  { value: 'timestamp', label: '时间' },
  { value: 'severity', label: '级别' },
  { value: 'source', label: '来源' },
  { value: 'stream', label: '流' },
  { value: 'traceId', label: 'Trace ID' },
  { value: 'message', label: '消息' },
]
const DEFAULT_LOG_FIELDS = ['timestamp', 'severity', 'source', 'message']

function logFieldLabel(field: string) {
  return (
    LOG_FIELDS.find((option) => option.value === field)?.label ?? field.replace('attribute:', '')
  )
}

function logFieldValue(entry: LogEntry, field: string) {
  if (field.startsWith('attribute:')) return entry.attributes?.[field.slice(10)] ?? '-'
  switch (field) {
    case 'timestamp':
      return formatDateTime(entry.timestamp)
    case 'severity':
      return entry.severity ?? '-'
    case 'source':
      return formatLogSource(entry)
    case 'stream':
      return entry.stream ?? '-'
    case 'traceId':
      return entry.traceId ?? '-'
    default:
      return entry.message
  }
}

function logFieldClassName(field: string) {
  return field.startsWith('attribute:') ? 'attribute' : field
}

function logSeverityClassName(severity?: string) {
  const value = severity?.toLowerCase() ?? ''
  if (value.includes('error') || value.includes('fatal') || value === 'err') return 'is-error'
  if (value.includes('warn')) return 'is-warning'
  if (value.includes('info')) return 'is-info'
  return 'is-muted'
}

function logEntryContext(entry: LogEntry) {
  const source = entry.source
  const values: Array<[string, string | undefined]> = [
    ['记录时间', entry.timestamp],
    ['采集时间', entry.observedAt],
    ['日志域', source.domain],
    ['集群', source.clusterId],
    ['命名空间', source.namespace],
    ['工作负载类型', source.workloadKind],
    ['工作负载', source.workloadName],
    ['Pod', source.podName],
    ['容器', source.containerName],
    ['应用', source.applicationId],
    ['环境', source.environmentKey],
    ['Docker 项目', source.dockerProjectId],
    ['Docker 服务', source.dockerService],
    ['流', entry.stream],
    ['Trace ID', entry.traceId],
    ['Span ID', entry.spanId],
    ['来源模式', entry.sourceMode],
    ...Object.entries(entry.attributes ?? {}).map(
      ([key, value]) => [`attributes.${key}`, value] as [string, string],
    ),
  ]
  return values.filter((value): value is [string, string] => Boolean(value[1]))
}

function initialFilters(preset?: LogExplorerPreset): RuntimeLogFilters {
  return {
    workloadKind: preset?.workloadKind,
    workloadName: preset?.workloadName,
    podNames: preset?.podNames,
    containers: preset?.containers,
    labelSelector: preset?.labelSelector,
    text: preset?.text,
    sinceSeconds: preset?.sinceSeconds ?? 900,
    tail: preset?.tail ?? 200,
    allContainers: preset?.allContainers ?? !preset?.containers?.length,
    previous: preset?.previous ?? false,
  }
}

function queryErrorDescription(error: unknown, mode: SubmittedLogQuery['mode']) {
  if (error instanceof ApiError) {
    if (error.status === 403) return '当前账号没有所选日志范围的查看权限。'
    if (error.status === 404) return '所选日志来源不存在。'
    if (error.status === 422) return '当前连接模式不支持聚合日志，或筛选条件无法解析。'
    if (error.status === 503) {
      return mode === 'history'
        ? '当前范围没有可用的持久化日志数据源，或日志后端暂时不可用。'
        : '集群日志能力暂时不可用，请检查集群或 Agent 状态。'
    }
  }
  return '日志查询失败，请检查筛选条件和集群连接状态。'
}

export function LogExplorer({
  autoStart = false,
  clusterId,
  embedded = false,
  namespace,
  preset,
  syncURL = false,
  target,
}: LogExplorerProps) {
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const { message } = App.useApp()
  const permissionSnapshot = usePermissionSnapshot().data?.data
  const canManageDataSources = hasPermission(permissionSnapshot, 'observe.log-data-sources.manage')
  const resolvedTarget = useMemo<LogTarget>(
    () => target ?? { kind: 'cluster', clusterId: clusterId ?? '', namespace: namespace ?? '' },
    [target, clusterId, namespace],
  )
  const targetIdentity = logTargetKey(resolvedTarget)
  const isKubernetes = resolvedTarget.kind !== 'docker'
  const supportsDurable = resolvedTarget.kind !== 'docker'
  const targetScoped =
    resolvedTarget.kind === 'docker'
      ? Boolean(resolvedTarget.projectId && resolvedTarget.serviceName)
      : resolvedTarget.kind === 'delivery'
        ? Boolean(resolvedTarget.applicationId && resolvedTarget.environmentId)
        : Boolean(resolvedTarget.clusterId && resolvedTarget.namespace)
  const mode = embedded ? 'live' : 'history'
  const targetReady = targetScoped && (embedded || supportsDurable)
  const [form] = Form.useForm<RuntimeLogFilters>()
  const serializedDefaults = JSON.stringify(initialFilters(preset))
  const defaults = useMemo(
    () => JSON.parse(serializedDefaults) as RuntimeLogFilters,
    [serializedDefaults],
  )
  const [queryEditorMode, setQueryEditorMode] = useState<QueryEditorMode>(
    embedded ? 'builder' : 'query',
  )
  const [queryExpression, setQueryExpression] = useState(() => buildSohaQLExpression(defaults))
  const [submitted, setSubmitted] = useState<SubmittedLogQuery | null>(null)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [streamState, setStreamState] = useState('idle')
  const [streamMessage, setStreamMessage] = useState('')
  const [streamEnabled, setStreamEnabled] = useState(false)
  const [streamGeneration, setStreamGeneration] = useState(0)
  const [sourceErrors, setSourceErrors] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [visibleLogFields, setVisibleLogFields] = useState(DEFAULT_LOG_FIELDS)
  const allContainers = Form.useWatch('allContainers', form)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const reconnectAttemptRef = useRef(0)
  const autoStartedRef = useRef('')

  useEffect(() => {
    form.setFieldsValue(defaults)
    setQueryExpression(buildSohaQLExpression(defaults))
  }, [defaults, form])

  const snapshotQuery = useQuery(
    observabilityLogQueries.snapshot(
      submitted?.target ?? resolvedTarget,
      submitted?.query ?? { selector: {} },
      Boolean(submitted),
    ),
  )

  function syncSearch(filters: RuntimeLogFilters) {
    if (!syncURL) return
    const path = buildLogExplorerPath({
      source:
        resolvedTarget.kind === 'docker'
          ? 'docker'
          : resolvedTarget.kind === 'delivery'
            ? 'delivery'
            : 'kubernetes',
      clusterId: resolvedTarget.kind === 'cluster' ? resolvedTarget.clusterId : undefined,
      namespace: resolvedTarget.kind === 'docker' ? undefined : resolvedTarget.namespace,
      dockerProjectId: resolvedTarget.kind === 'docker' ? resolvedTarget.projectId : undefined,
      dockerService: resolvedTarget.kind === 'docker' ? resolvedTarget.serviceName : undefined,
      applicationId: resolvedTarget.kind === 'delivery' ? resolvedTarget.applicationId : undefined,
      environmentId: resolvedTarget.kind === 'delivery' ? resolvedTarget.environmentId : undefined,
      workloadKind: filters.workloadKind,
      workloadName: filters.workloadName,
      podNames: filters.podNames,
      containers: filters.containers,
      labelSelector: filters.labelSelector,
      text: filters.text,
      sinceSeconds: filters.sinceSeconds,
      tail: filters.tail,
      allContainers: filters.allContainers,
      previous: filters.previous,
    })
    setSearchParams(path.split('?')[1] ?? '', { replace: true })
  }

  function submitLiveQuery(filters: RuntimeLogFilters) {
    if (!targetReady) {
      void message.warning('请先选择完整的日志范围')
      return
    }
    try {
      const query =
        resolvedTarget.kind === 'docker'
          ? buildDockerRuntimeLogQuery(resolvedTarget.serviceName, filters)
          : buildRuntimeLogQuery(
              resolvedTarget.kind === 'delivery'
                ? (resolvedTarget.namespace ?? '')
                : resolvedTarget.namespace,
              filters,
            )
      setEntries([])
      setSourceErrors(0)
      setStreamMessage('')
      reconnectAttemptRef.current = 0
      setSubmitted({ target: resolvedTarget, mode: 'live', query })
      setStreamState('connecting')
      setStreamEnabled(true)
      syncSearch(filters)
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '筛选条件无效')
    }
  }

  function handleSubmit(filters: RuntimeLogFilters) {
    let resolvedFilters = filters
    if (!embedded && queryEditorMode === 'query') {
      try {
        resolvedFilters = {
          ...parseSohaQLExpression(queryExpression),
          sinceSeconds: filters.sinceSeconds,
          tail: filters.tail,
          previous: filters.previous,
        }
      } catch (error) {
        void message.error(error instanceof Error ? error.message : '查询语句无效')
        return
      }
    }
    if (mode === 'history') {
      if (!supportsDurable) {
        void message.warning('当前日志来源暂不支持持久化查询')
        return
      }
      if (!targetReady) {
        void message.warning('请先选择完整的日志范围')
        return
      }
      try {
        const query = buildDurableLogQuery(resolvedTarget.namespace ?? '', resolvedFilters)
        setEntries([])
        setSourceErrors(0)
        setStreamMessage('')
        setStreamEnabled(false)
        setSubmitted({ target: resolvedTarget, mode: 'history', query })
        syncSearch(resolvedFilters)
      } catch (error) {
        void message.error(error instanceof Error ? error.message : '筛选条件无效')
      }
      return
    }
    submitLiveQuery(resolvedFilters)
  }

  function handleQueryEditorModeChange(value: string | number) {
    const nextMode = value as QueryEditorMode
    try {
      if (nextMode === 'query') {
        setQueryExpression(buildSohaQLExpression(form.getFieldsValue()))
      } else {
        const filters = parseSohaQLExpression(queryExpression)
        form.setFieldsValue({
          workloadKind: filters.workloadKind,
          workloadName: filters.workloadName,
          podNames: filters.podNames,
          containers: filters.containers,
          labelSelector: undefined,
          text: filters.text,
          allContainers: filters.allContainers,
        })
      }
      setQueryEditorMode(nextMode)
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '查询语句无效')
    }
  }

  useEffect(() => {
    if (!autoStart || autoStartedRef.current === targetIdentity || !targetReady || mode !== 'live')
      return
    autoStartedRef.current = targetIdentity
    submitLiveQuery(defaults)
  }, [autoStart, targetIdentity, targetReady])

  useEffect(() => {
    const page = snapshotQuery.data
    if (!page) return
    setEntries((current) => mergeLogEntries(page.entries, current))
  }, [snapshotQuery.data, snapshotQuery.dataUpdatedAt])

  useEffect(() => {
    if (!autoScroll || !scrollerRef.current) return
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
  }, [autoScroll, entries])

  useEffect(() => {
    if (!submitted || submitted.mode !== 'live' || !streamEnabled) return
    let cancelled = false
    let endedByServer = false
    let socket: WebSocket | undefined
    let reconnectTimer: number | undefined

    const scheduleReconnect = () => {
      if (cancelled || endedByServer) return
      const attempt = reconnectAttemptRef.current
      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        setStreamState('degraded')
        setStreamMessage('自动重连已停止，请手动重连。')
        return
      }
      reconnectAttemptRef.current += 1
      setStreamState('reconnecting')
      setStreamMessage(`连接中断，${RECONNECT_DELAYS_MS[attempt] / 1000} 秒后重试。`)
      reconnectTimer = window.setTimeout(
        () => setStreamGeneration((value) => value + 1),
        RECONNECT_DELAYS_MS[attempt],
      )
    }

    setStreamState(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting')
    void issueLogStreamTicket(submitted.target, submitted.query)
      .then((ticket) => {
        if (cancelled) return
        socket = new WebSocket(buildLogStreamURL(submitted.target, ticket.ticket))
        socket.onopen = () => {
          reconnectAttemptRef.current = 0
          setStreamState('live')
          setStreamMessage('')
        }
        socket.onmessage = (event) => {
          let streamEvent: LogStreamEvent
          try {
            streamEvent = JSON.parse(String(event.data)) as LogStreamEvent
          } catch {
            setStreamState('degraded')
            setStreamMessage('收到无法解析的日志事件。')
            return
          }
          if (streamEvent.type === 'entry' && streamEvent.entry) {
            setEntries((current) => mergeLogEntries(current, [streamEvent.entry as LogEntry]))
          } else if (streamEvent.type === 'source_error') {
            setSourceErrors((value) => value + 1)
            setStreamState('degraded')
            setStreamMessage('部分日志来源暂时不可用。')
          } else if (streamEvent.type === 'status' && streamEvent.status) {
            setStreamState(streamEvent.status.state)
            setStreamMessage(streamEvent.status.message ?? '')
          } else if (streamEvent.type === 'end') {
            endedByServer = true
            setStreamState('ended')
            setStreamMessage('实时会话已结束。')
            socket?.close()
          }
        }
        socket.onerror = () => {
          setStreamState('degraded')
          setStreamMessage('实时日志连接异常。')
        }
        socket.onclose = () => scheduleReconnect()
      })
      .catch(() => scheduleReconnect())

    return () => {
      cancelled = true
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [streamEnabled, streamGeneration, submitted])

  function handleReconnect() {
    if (!submitted) {
      form.submit()
      return
    }
    reconnectAttemptRef.current = 0
    setStreamEnabled(true)
    setStreamGeneration((value) => value + 1)
  }

  function handleNextPage() {
    if (!submitted || submitted.mode !== 'history' || !snapshotQuery.data?.nextCursor) return
    setSubmitted({
      ...submitted,
      query: { ...submitted.query, cursor: snapshotQuery.data.nextCursor },
    })
  }

  async function handleExport() {
    if (!submitted) return
    setExporting(true)
    try {
      const page = await queryLogs(submitted.target, submitted.query, new AbortController().signal)
      downloadText(`soha-runtime-logs-${Date.now()}.txt`, formatLogExport(page.entries))
    } catch {
      void message.error('导出前重新鉴权失败，未生成日志文件。')
    } finally {
      setExporting(false)
    }
  }

  function handleOpenInCenter() {
    const filters = form.getFieldsValue()
    navigate(
      buildLogExplorerPath({
        ...preset,
        ...filters,
        source:
          resolvedTarget.kind === 'docker'
            ? 'docker'
            : resolvedTarget.kind === 'delivery'
              ? 'delivery'
              : 'kubernetes',
        clusterId: resolvedTarget.kind === 'cluster' ? resolvedTarget.clusterId : undefined,
        namespace: resolvedTarget.kind === 'docker' ? undefined : resolvedTarget.namespace,
        dockerProjectId: resolvedTarget.kind === 'docker' ? resolvedTarget.projectId : undefined,
        dockerService: resolvedTarget.kind === 'docker' ? resolvedTarget.serviceName : undefined,
        applicationId:
          resolvedTarget.kind === 'delivery' ? resolvedTarget.applicationId : undefined,
        environmentId:
          resolvedTarget.kind === 'delivery' ? resolvedTarget.environmentId : undefined,
        labelSelector: undefined,
        previous: false,
      }),
    )
  }

  const page = snapshotQuery.data
  const logFieldOptions = useMemo(
    () => [
      ...LOG_FIELDS,
      ...Array.from(new Set(entries.flatMap((entry) => Object.keys(entry.attributes ?? {}))))
        .sort()
        // ponytail: keep the field rail bounded; add search/virtualization if schemas exceed 20 fields.
        .slice(0, 20)
        .map((key) => ({ value: `attribute:${key}`, label: key })),
    ],
    [entries],
  )

  return (
    <div className={embedded ? 'soha-log-explorer is-embedded' : 'soha-log-explorer'}>
      <Card
        className="soha-log-query-card"
        title={embedded ? '查询范围' : '日志查询'}
        extra={
          embedded ? (
            <Button icon={<ExportOutlined />} onClick={handleOpenInCenter}>
              在日志中心打开
            </Button>
          ) : canManageDataSources ? (
            <Button
              icon={<DatabaseOutlined />}
              onClick={() => navigate('/monitoring-workbench/log-data-sources')}
            >
              数据源
            </Button>
          ) : undefined
        }
      >
        {mode === 'history' && !supportsDurable ? (
          <Alert
            className="soha-log-inline-alert"
            showIcon
            type="warning"
            title="当前 Docker 日志仅支持在运行时页面实时查看"
          />
        ) : null}
        <Form<RuntimeLogFilters>
          form={form}
          initialValues={defaults}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {!embedded ? (
            <Flex className="soha-log-query-mode-row" align="center" gap={12} wrap>
              <Segmented
                aria-label="日志查询模式"
                options={[
                  { icon: <CodeOutlined />, label: '查询语句', value: 'query' },
                  { icon: <FilterOutlined />, label: '筛选器', value: 'builder' },
                ]}
                value={queryEditorMode}
                onChange={handleQueryEditorModeChange}
              />
              <Space className="soha-log-query-scope" size={8} wrap>
                <MetadataTag label="SohaQL" tone="blue" />
                <Text type="secondary">
                  {resolvedTarget.kind === 'cluster'
                    ? resolvedTarget.namespace || '未选择命名空间'
                    : resolvedTarget.kind === 'delivery'
                      ? `${resolvedTarget.applicationId || '-'} / ${resolvedTarget.environmentId || '-'}`
                      : `${resolvedTarget.projectId || '-'} / ${resolvedTarget.serviceName || '-'}`}
                </Text>
              </Space>
              <div className="soha-log-query-top-actions">
                <Form.Item name="sinceSeconds" noStyle>
                  <Select
                    aria-label="时间范围"
                    options={[
                      { value: 300, label: '最近 5 分钟' },
                      { value: 900, label: '最近 15 分钟' },
                      { value: 3600, label: '最近 1 小时' },
                      { value: 21600, label: '最近 6 小时' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="tail" noStyle>
                  <Select
                    aria-label="每页行数"
                    options={[200, 500, 1000].map((value) => ({ value, label: `${value} 行` }))}
                  />
                </Form.Item>
                <Button
                  htmlType="submit"
                  icon={<SearchOutlined />}
                  type="primary"
                  disabled={!targetReady}
                >
                  查询日志
                </Button>
              </div>
            </Flex>
          ) : null}

          {!embedded && queryEditorMode === 'query' ? (
            <Input.TextArea
              aria-label="SohaQL 查询语句"
              className="soha-log-query-editor"
              maxLength={2048}
              rows={2}
              spellCheck={false}
              value={queryExpression}
              onChange={(event) => setQueryExpression(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) form.submit()
              }}
            />
          ) : (
            <div className="soha-log-filter-grid">
              {isKubernetes ? (
                <>
                  <Form.Item label="工作负载类型" name="workloadKind">
                    <Select
                      allowClear
                      options={['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job'].map(
                        (value) => ({ value, label: value }),
                      )}
                      placeholder="可选"
                    />
                  </Form.Item>
                  <Form.Item label="工作负载名称" name="workloadName">
                    <Input placeholder="与类型同时填写" />
                  </Form.Item>
                  <Form.Item label="Pod" name="podNames">
                    <Select
                      mode="tags"
                      tokenSeparators={[',']}
                      placeholder={mode === 'history' ? '查询限一个 Pod' : '输入一个或多个 Pod'}
                    />
                  </Form.Item>
                  <Form.Item label="容器" name="containers">
                    <Select
                      disabled={allContainers}
                      mode="tags"
                      tokenSeparators={[',']}
                      placeholder={
                        allContainers
                          ? '已选择全部容器'
                          : mode === 'history'
                            ? '查询限一个容器'
                            : '输入一个或多个容器'
                      }
                    />
                  </Form.Item>
                  {embedded ? (
                    <Form.Item label="标签选择器" name="labelSelector">
                      <Input placeholder="app=api,tier=backend" />
                    </Form.Item>
                  ) : null}
                </>
              ) : null}
              <Form.Item label="文本筛选" name="text">
                <Input allowClear placeholder="服务端文本匹配" />
              </Form.Item>
              {embedded ? (
                <>
                  <Form.Item label="时间范围" name="sinceSeconds">
                    <Select
                      options={[
                        { value: 0, label: '全部可用日志' },
                        { value: 300, label: '最近 5 分钟' },
                        { value: 900, label: '最近 15 分钟' },
                        { value: 3600, label: '最近 1 小时' },
                        { value: 21600, label: '最近 6 小时' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label="每个来源读取行数" name="tail">
                    <Select
                      options={(isKubernetes ? [200, 500, 1000, 5000] : [200, 500, 1000, 2000]).map(
                        (value) => ({ value, label: String(value) }),
                      )}
                    />
                  </Form.Item>
                </>
              ) : null}
            </div>
          )}

          {embedded || (isKubernetes && queryEditorMode === 'builder') ? (
            <Flex
              className="soha-log-query-actions"
              align="end"
              gap={12}
              justify="space-between"
              wrap
            >
              <Space size={16} wrap>
                {isKubernetes && (embedded || queryEditorMode === 'builder') ? (
                  <Form.Item name="allContainers" noStyle valuePropName="checked">
                    <Switch checkedChildren="全部容器" unCheckedChildren="指定容器" />
                  </Form.Item>
                ) : null}
                {isKubernetes && mode === 'live' ? (
                  <Form.Item name="previous" noStyle valuePropName="checked">
                    <Switch checkedChildren="上次实例" unCheckedChildren="当前实例" />
                  </Form.Item>
                ) : null}
              </Space>
              {embedded ? (
                <Button
                  htmlType="submit"
                  icon={<SearchOutlined />}
                  type="primary"
                  disabled={!targetReady}
                >
                  查询并连接
                </Button>
              ) : null}
            </Flex>
          ) : null}
        </Form>
      </Card>

      <Card className="soha-log-results-card" title={mode === 'live' ? '运行时日志' : undefined}>
        <Flex className="soha-log-results-toolbar" align="center" gap={8} wrap>
          <StatusTag
            value={
              mode === 'history'
                ? snapshotQuery.isFetching
                  ? 'querying'
                  : submitted
                    ? 'ready'
                    : 'idle'
                : streamState
            }
          />
          <MetadataTag label={`${entries.length} 行`} tone="blue" />
          {page?.coverage ? (
            <MetadataTag
              label={`来源 ${page.coverage.successfulSources}/${page.coverage.resolvedSources}`}
              tone={page.coverage.failedSources > 0 ? 'orange' : 'cyan'}
            />
          ) : null}
          {page?.truncated ? <MetadataTag label="结果已截断" tone="orange" /> : null}
          {mode === 'live' && sourceErrors > 0 ? (
            <MetadataTag label={`${sourceErrors} 个来源错误`} tone="orange" />
          ) : null}
          <span className="soha-log-toolbar-spacer" />
          <Space size={4} wrap>
            {mode === 'live' ? (
              <>
                <Text type="secondary">自动滚动</Text>
                <Switch size="small" checked={autoScroll} onChange={setAutoScroll} />
              </>
            ) : null}
            <ManagementIconButton
              aria-label="清空日志"
              icon={<DeleteOutlined />}
              tooltip="清空日志"
              onClick={() => setEntries([])}
            />
            <ManagementIconButton
              aria-label="导出当前快照"
              disabled={!submitted || exporting}
              icon={<DownloadOutlined />}
              loading={exporting}
              tooltip="重新鉴权并导出当前快照"
              onClick={() => void handleExport()}
            />
            {mode === 'history' ? (
              <Button
                disabled={!page?.nextCursor}
                loading={snapshotQuery.isFetching}
                onClick={handleNextPage}
              >
                下一页
              </Button>
            ) : streamEnabled ? (
              <ManagementIconButton
                aria-label="停止实时日志"
                icon={<StopOutlined />}
                tooltip="停止实时日志"
                onClick={() => {
                  setStreamEnabled(false)
                  setStreamState('ended')
                  setStreamMessage('实时会话已手动停止。')
                }}
              />
            ) : (
              <ManagementIconButton
                aria-label="重新连接实时日志"
                icon={<ReloadOutlined />}
                tooltip="获取新 ticket 并重新连接"
                onClick={handleReconnect}
              />
            )}
          </Space>
        </Flex>

        {mode === 'live' && streamMessage ? (
          <Alert
            className="soha-log-inline-alert"
            showIcon
            type={streamState === 'degraded' ? 'warning' : 'info'}
            title={streamMessage}
          />
        ) : null}
        {page?.partial || (page?.warnings?.length ?? 0) > 0 ? (
          <Alert
            className="soha-log-inline-alert"
            showIcon
            type="warning"
            title="部分日志来源未能读取"
            description="已保留成功来源的结果；请检查对应 Pod、容器和集群连接状态。"
          />
        ) : null}
        {snapshotQuery.isError ? (
          <ManagementState
            bordered={false}
            compact
            kind="error"
            title="日志查询失败"
            description={queryErrorDescription(snapshotQuery.error, mode)}
          />
        ) : null}

        {mode === 'history' ? (
          <div className="soha-log-results-explorer">
            <aside className="soha-log-results-fields" aria-label="日志字段">
              <Text strong>显示字段</Text>
              <Checkbox.Group
                value={visibleLogFields}
                onChange={(fields) =>
                  setVisibleLogFields([...fields.filter((field) => field !== 'message'), 'message'])
                }
              >
                {logFieldOptions.map((field) => (
                  <Checkbox
                    disabled={field.value === 'message'}
                    key={field.value}
                    value={field.value}
                  >
                    {field.label}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </aside>
            <div className="soha-log-results-table" role="region" aria-label="日志查询结果">
              {snapshotQuery.isLoading && entries.length === 0 ? (
                <ManagementState bordered={false} compact kind="loading" />
              ) : entries.length === 0 ? (
                <div className="soha-log-result-empty">
                  {submitted ? '当前时间范围暂无日志。' : '设置范围后查询日志。'}
                </div>
              ) : (
                <>
                  <div className="soha-log-result-header">
                    <span className="soha-log-result-disclosure" />
                    {visibleLogFields.map((field) => (
                      <span className={`soha-log-field is-${logFieldClassName(field)}`} key={field}>
                        {logFieldLabel(field)}
                      </span>
                    ))}
                  </div>
                  <div className="soha-log-result-rows">
                    {entries.map((entry) => (
                      <details
                        className="soha-log-result-row"
                        key={entry.timestamp + formatLogSource(entry) + entry.message}
                      >
                        <summary>
                          <span className="soha-log-result-disclosure" aria-hidden="true">
                            <RightOutlined />
                          </span>
                          {visibleLogFields.map((field) => (
                            <span
                              className={`soha-log-field is-${logFieldClassName(field)} ${
                                field === 'severity' ? logSeverityClassName(entry.severity) : ''
                              }`}
                              key={field}
                              title={logFieldValue(entry, field)}
                            >
                              {logFieldValue(entry, field)}
                            </span>
                          ))}
                        </summary>
                        <div className="soha-log-result-detail">
                          <pre>{entry.message}</pre>
                          <dl>
                            {logEntryContext(entry).map(([label, value]) => (
                              <div key={label}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </details>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div ref={scrollerRef} className="soha-aggregate-log-shell">
            {snapshotQuery.isLoading && entries.length === 0 ? (
              <ManagementState bordered={false} compact kind="loading" />
            ) : entries.length === 0 ? (
              <div className="soha-aggregate-log-empty">
                {submitted
                  ? '当前范围暂无日志，实时连接会继续等待新内容。'
                  : '设置范围后开始查询实时日志。'}
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  className="soha-aggregate-log-row"
                  key={entry.timestamp + formatLogSource(entry) + entry.message}
                >
                  <span className="soha-aggregate-log-time">{formatDateTime(entry.timestamp)}</span>
                  <span className="soha-aggregate-log-source">{formatLogSource(entry)}</span>
                  <span className="soha-aggregate-log-message">{entry.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
