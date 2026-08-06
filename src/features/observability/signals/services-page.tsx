import { SearchOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import { Button, Form, InputNumber } from 'antd'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { queryTraces } from './api'
import { summarizeServices } from './model'
import { SignalQueryForm, SignalState, traceInput, type SignalFilters } from './shared'

export function ObservabilityServicesPage() {
  const navigate = useNavigate()
  const { clusterId, namespace } = usePlatformScopeStore()
  const [form] = Form.useForm<SignalFilters>()
  const traces = useMutation({ mutationFn: queryTraces })
  const rows = useMemo(() => summarizeServices(traces.data?.spans ?? []), [traces.data?.spans])
  const columns: TableColumnsType<(typeof rows)[number]> = [
    { title: '服务', dataIndex: 'service', key: 'service' },
    { title: 'Span', dataIndex: 'spans', key: 'spans', width: 110 },
    {
      title: '错误 Span',
      dataIndex: 'errorSpans',
      key: 'errorSpans',
      width: 120,
      render: (value: number) => (
        <StatusTag label={value} value={value > 0 ? 'error' : 'normal'} />
      ),
    },
    {
      title: '最大耗时',
      dataIndex: 'maxDurationMs',
      key: 'maxDurationMs',
      width: 130,
      render: (value: number) => `${value.toFixed(1)} ms`,
    },
    {
      key: 'actions',
      render: (_, item) => (
        <Button
          aria-label="查看链路"
          icon={<SearchOutlined />}
          type="text"
          onClick={() =>
            navigate(`/monitoring-workbench/traces?service=${encodeURIComponent(item.service)}`)
          }
        />
      ),
    },
  ]

  return (
    <div className="soha-page soha-signal-page">
      <SignalQueryForm
        form={form}
        loading={traces.isPending}
        submitLabel="发现服务"
        onFinish={(values) => traces.mutate(traceInput(values, clusterId, namespace))}
      >
        <Form.Item label="最小耗时 (ms)" name="minDurationMs">
          <InputNumber min={0} max={3_600_000} step={100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="最大 Span" name="limit">
          <InputNumber min={1} max={500} style={{ width: '100%' }} />
        </Form.Item>
      </SignalQueryForm>
      <SignalState error={traces.error} idle={traces.isIdle} loading={traces.isPending} />
      {!traces.isIdle && !traces.isPending && !traces.error ? (
        <AdminTable
          columnSettingPlacement="hidden"
          columns={columns}
          dataSource={rows}
          empty={<ManagementState bordered={false} compact description="当前范围没有发现服务" />}
          pagination={false}
          rowKey="key"
          shellClassName="soha-management-table-shell"
        />
      ) : null}
    </div>
  )
}
