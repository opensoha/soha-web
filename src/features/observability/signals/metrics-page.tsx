import type {
  ObservabilityMetricKey,
  ObservabilityMetricSeries,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { LineChart } from '@visactor/react-vchart'
import { useMutation } from '@tanstack/react-query'
import { Card, Form, Select, Typography } from 'antd'
import { ManagementState } from '@/components/management-list'
import {
  buildCompactChartSpec,
  compactMetricColors,
  formatMetricValue,
  type CompactChartLine,
} from '@/components/resource-metrics-panel'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { queryMetrics } from './api'
import { observabilityScope } from './model'
import { queryTimes, SignalQueryForm, SignalState, type SignalFilters } from './shared'

const { Text } = Typography

const metricOptions: Array<{ label: string; value: ObservabilityMetricKey }> = [
  { label: 'CPU 使用率', value: 'cpu_usage' },
  { label: '内存使用率', value: 'memory_usage' },
  { label: '重启率', value: 'restart_rate' },
  { label: '错误率', value: 'error_rate' },
  { label: 'P95 延迟', value: 'latency_p95' },
]

export function ObservabilityMetricsPage() {
  const { clusterId, namespace } = usePlatformScopeStore()
  const [form] = Form.useForm<SignalFilters>()
  const metrics = useMutation({ mutationFn: queryMetrics })

  function submit(values: SignalFilters) {
    const times = queryTimes(values.rangeMinutes)
    metrics.mutate({
      ...times,
      metricKey: values.metricKey,
      scope: observabilityScope(clusterId, namespace, values.service, values.workload),
      stepSeconds: values.rangeMinutes <= 60 ? 60 : 300,
    })
  }

  return (
    <div className="soha-page soha-signal-page">
      <SignalQueryForm
        form={form}
        loading={metrics.isPending}
        submitLabel="查询指标"
        onFinish={submit}
      >
        <Form.Item initialValue="cpu_usage" label="指标" name="metricKey">
          <Select options={metricOptions} />
        </Form.Item>
      </SignalQueryForm>
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
