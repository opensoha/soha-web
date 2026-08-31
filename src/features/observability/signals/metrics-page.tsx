import type {
  ObservabilityMetricKey,
  ObservabilityMetricSeries,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { LineChart } from '@visactor/react-vchart'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Card, Form, Select, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import {
  buildCompactChartSpec,
  compactMetricColors,
  formatMetricValue,
  type CompactChartLine,
} from '@/components/resource-metrics-panel'
import { useAIPageContext } from '@/features/copilot'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatDateTime } from '@/utils/time'
import { queryMetrics } from './api'
import { signalSearchParams } from './model'
import { observabilitySignalQueries } from './queries'
import { metricInput, SignalQueryForm, SignalState, type SignalFilters } from './shared'

const { Text } = Typography

const metricLabels: Record<ObservabilityMetricKey, string> = {
  cpu_usage: 'CPU 使用率',
  memory_usage: '内存使用率',
  restart_rate: '重启率',
  error_rate: '错误率',
  latency_p95: 'P95 延迟',
}

export function ObservabilityMetricsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { clusterId, namespace } = usePlatformScopeStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm<SignalFilters>()
  const catalog = useQuery(observabilitySignalQueries.metricCatalog())
  const metrics = useMutation({ mutationFn: queryMetrics })
  const runMetrics = metrics.mutate
  const autoQueryStarted = useRef(false)
  const requestedClusterId = searchParams.get('cluster') || clusterId
  const requestedNamespace = searchParams.get('namespace') || namespace
  const requestedMetricKey = searchParams.get('metricKey')
  const initialMetricKey =
    requestedMetricKey && Object.prototype.hasOwnProperty.call(metricLabels, requestedMetricKey)
      ? (requestedMetricKey as ObservabilityMetricKey)
      : 'cpu_usage'
  const metricOptions = (catalog.data ?? []).map((item) => ({
    disabled: !item.available,
    label: metricLabels[item.key as ObservabilityMetricKey] ?? item.label,
    value: item.key as ObservabilityMetricKey,
  }))
  useAIPageContext(
    {
      sourceWorkbench: 'monitoring',
      sourceTitle: '指标调查',
      entityKind: 'monitoring.signal.metrics',
      entityName: metricLabels[initialMetricKey],
      clusterId: requestedClusterId || undefined,
      namespace: requestedNamespace || undefined,
      service: searchParams.get('service') || undefined,
      workload: searchParams.get('workload') || undefined,
      visibleFilters: {
        dataSourceId: searchParams.get('dataSourceId') || undefined,
        metricKey: initialMetricKey,
        timeFrom: searchParams.get('from') || undefined,
        timeTo: searchParams.get('to') || undefined,
      },
      pinnedData: metrics.data ? { seriesCount: metrics.data.series.length } : undefined,
      promptHint: '分析当前指标的趋势、异常时间段、影响范围，并给出可打开的关联证据。',
    },
    !embedded,
  )

  function submit(values: SignalFilters) {
    const input = metricInput(values, requestedClusterId, requestedNamespace)
    setSearchParams(
      signalSearchParams(searchParams, {
        dataSourceId: input.dataSourceId,
        cluster: requestedClusterId,
        namespace: requestedNamespace,
        service: values.service,
        workload: values.workload,
        metricKey: values.metricKey,
        from: input.timeFrom,
        to: input.timeTo,
      }),
      { replace: true },
    )
    runMetrics(input)
  }

  useEffect(() => {
    const from = Date.parse(searchParams.get('from') ?? '')
    const to = Date.parse(searchParams.get('to') ?? '')
    if (
      autoQueryStarted.current ||
      !requestedMetricKey ||
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      from >= to
    )
      return
    autoQueryStarted.current = true
    runMetrics(metricInput(form.getFieldsValue(true), requestedClusterId, requestedNamespace))
  }, [form, requestedClusterId, requestedMetricKey, requestedNamespace, runMetrics, searchParams])

  return (
    <div className={`${embedded ? '' : 'soha-page '}soha-signal-page`}>
      <SignalQueryForm
        form={form}
        initialValues={{
          dataSourceId: searchParams.get('dataSourceId') ?? undefined,
          metricKey: initialMetricKey,
          service: searchParams.get('service') ?? undefined,
          workload: searchParams.get('workload') ?? undefined,
          timeFrom: searchParams.get('from') ?? undefined,
          timeTo: searchParams.get('to') ?? undefined,
        }}
        loading={metrics.isPending}
        submitLabel="查询指标"
        onFinish={submit}
      >
        <Form.Item label="指标" name="metricKey">
          <Select loading={catalog.isLoading} options={metricOptions} />
        </Form.Item>
      </SignalQueryForm>
      {catalog.error ? (
        <ManagementState
          bordered={false}
          compact
          kind="error"
          title="指标目录加载失败"
          description={catalog.error.message}
        />
      ) : null}
      <SignalState error={metrics.error} idle={metrics.isIdle} loading={metrics.isPending} />
      {metrics.data ? (
        <div className="soha-signal-metric-grid">
          {metrics.data.series.map((series: ObservabilityMetricSeries) => {
            const lines: CompactChartLine[] = [
              {
                color: compactMetricColors.default,
                fill: true,
                key: series.key,
                label: series.label,
                points: series.points,
                unit: series.unit ?? '',
              },
            ]
            return (
              <Card
                key={series.key}
                size="small"
                title={series.label}
                extra={
                  <Text type="secondary">
                    最新 {formatMetricValue(series.latest, series.unit ?? '')}
                  </Text>
                }
              >
                <Text className="soha-signal-metric-summary" type="secondary">
                  区间共 {series.points.length} 个数据点
                </Text>
                <div aria-hidden="true" className="soha-signal-metric-chart">
                  <LineChart spec={buildCompactChartSpec(lines, series.unit ?? '', 'zh_CN')} />
                </div>
                <MetricSeriesDataDetails series={series} />
              </Card>
            )
          })}
          {metrics.data.series.length === 0 ? (
            <ManagementState bordered={false} compact description="当前范围暂无指标数据" />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function MetricSeriesDataDetails({ series }: { series: ObservabilityMetricSeries }) {
  const [visible, setVisible] = useState(false)
  return (
    <details
      className="soha-signal-data-details"
      onToggle={(event) => event.currentTarget.open && setVisible(true)}
    >
      <summary>查看数据表</summary>
      {visible ? (
        <div className="soha-signal-data-table-wrap">
          <table aria-label={`${series.label}数据表`}>
            <thead>
              <tr>
                <th scope="col">时间</th>
                <th scope="col">数值</th>
              </tr>
            </thead>
            <tbody>
              {series.points.map((point, index) => (
                <tr key={`${point.timestamp}:${index}`}>
                  <td>{formatDateTime(point.timestamp)}</td>
                  <td>{formatMetricValue(point.value, series.unit ?? '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </details>
  )
}
