import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Select, Typography } from 'antd'
import { LineChart } from '@visactor/react-vchart'
import {
  buildCompactChartSpec,
  compactMetricColors,
  formatMetricValue,
  type CompactChartLine,
} from '@/components/resource-metrics-panel'
import { ManagementState } from '@/components/management-list'
import { virtualizationQueries } from '../queries'
import type { VirtualizationVMMetrics } from '../virtualization-types'

const { Text } = Typography

const VM_METRIC_COLOR_MAP: Record<string, string> = {
  cpu: compactMetricColors.cpu,
  memory: compactMetricColors.memory,
  networkRx: compactMetricColors.networkRx,
  networkTx: compactMetricColors.networkTx,
}

function vmMetricColor(key: string): string {
  return VM_METRIC_COLOR_MAP[key] ?? compactMetricColors.default
}

function VMMetricsChart({ data }: { data: VirtualizationVMMetrics }) {
  if (!data.ready || data.message) {
    return <Alert type="info" title={data.message || '当前暂无可用指标数据'} />
  }

  const series = data.series ?? []
  if (series.length === 0) {
    return (
      <ManagementState
        bordered={false}
        compact
        title="暂无指标数据"
        description="Provider 暂未返回可展示的指标序列。"
      />
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {series.map((item) => {
        const points = (item.points ?? []).map((point) => ({
          timestamp: new Date(point.timestamp * 1000).toISOString(),
          value: point.value,
        }))
        const lines: CompactChartLine[] = [
          {
            color: vmMetricColor(item.key),
            fill: true,
            key: item.key,
            label: item.label,
            points,
            unit: item.unit,
          },
        ]
        const latest = points.length > 0 ? points[points.length - 1].value : null

        return (
          <Card
            key={item.key}
            size="small"
            title={item.label}
            extra={
              <Text type="secondary">
                最新: {latest !== null ? formatMetricValue(latest, item.unit) : '-'}
              </Text>
            }
          >
            <div style={{ height: 240 }}>
              <LineChart spec={buildCompactChartSpec(lines, item.unit, 'zh_CN')} />
            </div>
          </Card>
        )
      })}
    </div>
  )
}

interface VMMetricsPanelProps {
  range: number
  vmId: string
  onRangeChange: (range: number) => void
}

export function VMMetricsPanel({ range, vmId, onRangeChange }: VMMetricsPanelProps) {
  const stepSeconds = range <= 60 ? 60 : 300
  const metricsQuery = useQuery(
    virtualizationQueries.vmMetrics(vmId, { rangeMinutes: range, stepSeconds }, Boolean(vmId)),
  )

  return (
    <Card
      size="small"
      loading={metricsQuery.isLoading}
      extra={
        <Select
          value={range}
          onChange={onRangeChange}
          style={{ width: 180 }}
          options={[
            { value: 15, label: '最近 15 分钟' },
            { value: 60, label: '最近 1 小时' },
            { value: 360, label: '最近 6 小时' },
            { value: 1440, label: '最近 24 小时' },
          ]}
        />
      }
    >
      {metricsQuery.data ? (
        <VMMetricsChart data={metricsQuery.data} />
      ) : (
        <ManagementState
          bordered={false}
          compact
          title="暂无指标数据"
          description="指标查询完成后这里会展示 VM 运行曲线。"
        />
      )}
    </Card>
  )
}
