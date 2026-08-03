import type { ObservabilityTraceSpan } from '@opensoha/contracts/gen/ts/sohaapi'
import { FileSearchOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import { Button, Form, Input, InputNumber, Space, Tag, Typography } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementState } from '@/components/management-list'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatDateTime } from '@/utils/time'
import { buildLogExplorerPath } from '../logs/model'
import { queryTraces } from './api'
import { SignalQueryForm, SignalState, traceInput, type SignalFilters } from './shared'

const { Text } = Typography

export function ObservabilityTracesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { clusterId, namespace } = usePlatformScopeStore()
  const [form] = Form.useForm<SignalFilters>()
  const traces = useMutation({ mutationFn: queryTraces })
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
        <Tag color={value ? 'error' : 'success'}>{value ? '错误' : '正常'}</Tag>
      ),
    },
    {
      key: 'actions',
      render: (_, span) => (
        <Button
          aria-label="查看关联日志"
          icon={<FileSearchOutlined />}
          type="text"
          onClick={() =>
            navigate(
              buildLogExplorerPath({
                clusterId,
                namespace,
                source: 'kubernetes',
                traceId: span.traceId,
                spanId: span.spanId,
                sinceSeconds: form.getFieldValue('rangeMinutes') * 60,
              }),
            )
          }
        />
      ),
    },
  ]

  return (
    <div className="soha-page soha-signal-page">
      <SignalQueryForm
        form={form}
        initialValues={{
          service: searchParams.get('service') ?? undefined,
          traceId: searchParams.get('traceId') ?? undefined,
        }}
        loading={traces.isPending}
        submitLabel="查询链路"
        onFinish={(values) => traces.mutate(traceInput(values, clusterId, namespace))}
      >
        <Form.Item label="Trace ID" name="traceId">
          <Input allowClear placeholder="精确 Trace ID" />
        </Form.Item>
        <Form.Item label="最小耗时 (ms)" name="minDurationMs">
          <InputNumber min={0} max={3_600_000} step={100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="最大 Span" name="limit">
          <InputNumber min={1} max={500} style={{ width: '100%' }} />
        </Form.Item>
      </SignalQueryForm>
      <SignalState error={traces.error} idle={traces.isIdle} loading={traces.isPending} />
      {traces.data ? (
        <AdminTable
          columnSettingIconOnly
          columnSettingPlacement="header"
          columns={columns}
          dataSource={traces.data.spans}
          empty={<ManagementState bordered={false} compact description="当前范围暂无链路" />}
          expandedRowRender={(span: ObservabilityTraceSpan) => (
            <Space orientation="vertical" size={4}>
              <Text code>Trace {span.traceId}</Text>
              <Text code>Span {span.spanId}</Text>
              <Text type="secondary">{JSON.stringify(span.tags)}</Text>
            </Space>
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
