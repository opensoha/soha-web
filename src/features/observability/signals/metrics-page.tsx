import type {
  ObservabilityMetricKey,
  ObservabilityMetricSeries,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { LineChart } from '@visactor/react-vchart'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Card, Form, Select, Typography } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import {
  buildCompactChartSpec,
  compactMetricColors,
  formatMetricValue,
  type CompactChartLine,
} from '@/components/resource-metrics-panel'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { queryMetrics } from './api'
import { observabilityScope, signalSearchParams } from './model'
import { observabilitySignalQueries } from './queries'
import { queryTimes, SignalQueryForm, SignalState, type SignalFilters } from './shared'

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
  const metricOptions = (catalog.data ?? []).map((item) => ({
    disabled: !item.available,
    label: metricLabels[item.key as ObservabilityMetricKey] ?? item.label,
    value: item.key as ObservabilityMetricKey,
  }))

  function submit(values: SignalFilters) {
    const times = queryTimes(values.rangeMinutes, values.timeFrom, values.timeTo)
    const requestedClusterId = searchParams.get('cluster') || clusterId
    const requestedNamespace = searchParams.get('namespace') || namespace
    setSearchParams(
      signalSearchParams(searchParams, {
        cluster: requestedClusterId,
        namespace: requestedNamespace,
        service: values.service,
        workload: values.workload,
        metricKey: values.metricKey,
        from: times.timeFrom,
        to: times.timeTo,
      }),
      { replace: true },
    )
    metrics.mutate({
      ...times,
      metricKey: values.metricKey,
      scope: observabilityScope(
        requestedClusterId,
        requestedNamespace,
        values.service,
        values.workload,
      ),
      stepSeconds: values.rangeMinutes <= 60 ? 60 : 300,
    })
  }

  return (
    <div className={`${embedded ? '' : 'soha-page '}soha-signal-page`}>
      <SignalQueryForm
        form={form}
        initialValues={{
          metricKey:
            metricOptions.find((item) => item.value === searchParams.get('metricKey'))?.value ??
            'cpu_usage',
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
                <div className="soha-signal-metric-chart">
                  <LineChart spec={buildCompactChartSpec(lines, series.unit ?? '', 'zh_CN')} />
                </div>
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
