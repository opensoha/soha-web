import type { ObservabilityTraceSpan } from '@opensoha/contracts/gen/ts/sohaapi'
import { FileSearchOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import { Form, Input, InputNumber, Typography } from 'antd'
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ManagementQueryField } from '@/components/management-list'
import { AdminTable } from '@/components/admin-table'
import { ManagementIconButton, ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { useAIPageContext } from '@/features/copilot'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatDateTime } from '@/utils/time'
import { queryTraces } from './api'
import { signalSearchParams, traceWaterfallRows } from './model'
import { SignalQueryForm, SignalState, traceInput, type SignalFilters } from './shared'

const { Text } = Typography

function TraceWaterfall({ spans, traceId }: { spans: ObservabilityTraceSpan[]; traceId: string }) {
  const rows = traceWaterfallRows(spans, traceId)
  return (
    <div aria-label={`Trace ${traceId} Span 瀑布`} className="soha-trace-waterfall" role="list">
      {rows.map(({ leftPercent, span, widthPercent }) => (
        <div
          aria-label={`${span.service} ${span.operation} ${span.durationMs.toFixed(1)} ms${span.error ? ' 错误' : ' 正常'}`}
          className="soha-trace-waterfall-row"
          key={span.spanId}
          role="listitem"
          tabIndex={0}
        >
          <div className="soha-trace-waterfall-label" title={`${span.service} / ${span.operation}`}>
            <Text strong>{span.service}</Text>
            <Text type="secondary">{span.operation}</Text>
          </div>
          <div className="soha-trace-waterfall-track">
            <div
              className={`soha-trace-waterfall-bar${span.error ? ' is-error' : ''}`}
              style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
              title={`${span.durationMs.toFixed(1)} ms`}
            />
          </div>
          <Text className="soha-trace-waterfall-duration" type="secondary">
            {span.durationMs.toFixed(1)} ms
          </Text>
        </div>
      ))}
    </div>
  )
}

export function ObservabilityTracesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { clusterId, namespace } = usePlatformScopeStore()
  const requestedClusterId = searchParams.get('cluster') || clusterId
  const requestedNamespace = searchParams.get('namespace') || namespace
  const [form] = Form.useForm<SignalFilters>()
  const traces = useMutation({ mutationFn: queryTraces })
  const runTraces = traces.mutate
  const autoQueryStarted = useRef(false)
  const columns: TableColumnsType<ObservabilityTraceSpan> = [
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
    { title: '服务', dataIndex: 'service', key: 'service', width: 180 },
    { title: '操作', dataIndex: 'operation', key: 'operation' },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 110,
      render: (value: number) => `${value.toFixed(1)} ms`,
    },
    {
      title: '状态',
      dataIndex: 'error',
      key: 'error',
      width: 90,
      render: (value: boolean) => (
        <StatusTag label={value ? '错误' : '正常'} value={value ? 'error' : 'normal'} />
      ),
    },
    {
      key: 'actions',
      render: (_, span) => (
        <ManagementIconButton
          icon={<FileSearchOutlined />}
          tooltip="查看关联日志"
          onClick={() => {
            const next = signalSearchParams(searchParams, {
              signal: undefined,
              compare: undefined,
              dataSourceId: undefined,
              metricKey: undefined,
              minDurationMs: undefined,
              limit: undefined,
              traceId: span.traceId,
              spanId: span.spanId,
            })
            navigate(`/monitoring-workbench/logs?${next.toString()}`)
          }}
        />
      ),
    },
  ]
  useAIPageContext(
    {
      sourceWorkbench: 'monitoring',
      sourceTitle: '链路调查',
      entityKind: 'monitoring.signal.traces',
      entityName: searchParams.get('traceId') || searchParams.get('service') || '链路',
      clusterId: requestedClusterId || undefined,
      namespace: requestedNamespace || undefined,
      service: searchParams.get('service') || undefined,
      workload: searchParams.get('workload') || undefined,
      visibleFilters: {
        dataSourceId: searchParams.get('dataSourceId') || undefined,
        traceId: searchParams.get('traceId') || undefined,
        minDurationMs: searchParams.get('minDurationMs') || undefined,
        limit: searchParams.get('limit') || undefined,
        timeFrom: searchParams.get('from') || undefined,
        timeTo: searchParams.get('to') || undefined,
      },
      pinnedData: traces.data
        ? { serviceCount: traces.data.services.length, spanCount: traces.data.spans.length }
        : undefined,
      promptHint: '分析当前 Trace 的慢 Span、错误路径和关联日志，并给出可打开的证据。',
    },
    !embedded,
  )

  useEffect(() => {
    const from = Date.parse(searchParams.get('from') ?? '')
    const to = Date.parse(searchParams.get('to') ?? '')
    if (
      autoQueryStarted.current ||
      !searchParams.get('traceId') ||
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      from >= to
    )
      return
    autoQueryStarted.current = true
    runTraces(traceInput(form.getFieldsValue(true), requestedClusterId, requestedNamespace))
  }, [form, requestedClusterId, requestedNamespace, runTraces, searchParams])

  return (
    <div className={`${embedded ? '' : 'soha-page '}soha-signal-page`}>
      <SignalQueryForm
        form={form}
        initialValues={{
          dataSourceId: searchParams.get('dataSourceId') ?? undefined,
          service: searchParams.get('service') ?? undefined,
          traceId: searchParams.get('traceId') ?? undefined,
          workload: searchParams.get('workload') ?? undefined,
          timeFrom: searchParams.get('from') ?? undefined,
          timeTo: searchParams.get('to') ?? undefined,
        }}
        loading={traces.isPending}
        submitLabel="查询链路"
        onFinish={(values) => {
          const input = traceInput(values, requestedClusterId, requestedNamespace)
          setSearchParams(
            signalSearchParams(searchParams, {
              dataSourceId: input.dataSourceId,
              cluster: requestedClusterId,
              namespace: requestedNamespace,
              service: values.service,
              workload: values.workload,
              traceId: values.traceId,
              from: input.timeFrom,
              to: input.timeTo,
            }),
            { replace: true },
          )
          runTraces(input)
        }}
      >
        <ManagementQueryField width={240} label="Trace ID" name="traceId">
          <Input allowClear placeholder="精确 Trace ID" />
        </ManagementQueryField>
        <ManagementQueryField width={240} label="最小耗时 (ms)" name="minDurationMs">
          <InputNumber min={0} max={3_600_000} step={100} style={{ width: '100%' }} />
        </ManagementQueryField>
        <ManagementQueryField width={240} label="最大 Span" name="limit">
          <InputNumber min={1} max={500} style={{ width: '100%' }} />
        </ManagementQueryField>
      </SignalQueryForm>
      <SignalState error={traces.error} idle={traces.isIdle} loading={traces.isPending} />
      {traces.data ? (
        <AdminTable
          enableDensity
          refreshing={traces.isPending}
          onRefresh={() => {
            if (traces.variables) runTraces(traces.variables)
          }}
          columnSettingIconOnly
          columnSettingPlacement="header"
          columns={columns}
          dataSource={traces.data.spans}
          empty={<ManagementState bordered={false} compact description="当前范围暂无链路" />}
          expandedRowRender={(span: ObservabilityTraceSpan) => (
            <div className="soha-trace-expanded">
              <Text code>Trace {span.traceId}</Text>
              <TraceWaterfall spans={traces.data.spans} traceId={span.traceId} />
            </div>
          )}
          pagination={false}
          rowKey={(span) => `${span.traceId}:${span.spanId}`}
          shellClassName="soha-management-table-shell"
          scroll={{ x: 'max-content' }}
        />
      ) : null}
    </div>
  )
}
