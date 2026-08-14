import type { ObservabilityService } from '@opensoha/contracts/gen/ts/sohaapi'
import { EyeOutlined, LineChartOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import { Alert, Descriptions, Drawer, Form, List, Space, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { ManagementIconButton, ManagementState } from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type { ObservabilityServiceQuery } from './api'
import { signalSearchParams } from './model'
import { observabilitySignalQueries } from './queries'
import { queryTimes, SignalQueryForm, type SignalFilters } from './shared'

const { Text, Title } = Typography

function statusLabel(status: ObservabilityService['status']) {
  return { degraded: '降级', healthy: '健康', unknown: '未知', unsupported: '不支持' }[status]
}

function serviceRequest(
  values: Partial<SignalFilters>,
  clusterId: string | null,
  namespace: string | null,
  dataSourceId?: string | null,
): ObservabilityServiceQuery {
  return {
    ...queryTimes(values.rangeMinutes ?? 60, values.timeFrom, values.timeTo),
    clusterId: clusterId?.trim() || undefined,
    namespace: namespace?.trim() || undefined,
    dataSourceId: dataSourceId?.trim() || undefined,
    service: values.service?.trim() || undefined,
  }
}

export function ObservabilityServicesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { clusterId, namespace } = usePlatformScopeStore()
  const requestedClusterId = searchParams.get('cluster') || clusterId
  const requestedNamespace = searchParams.get('namespace') || namespace
  const [form] = Form.useForm<SignalFilters>()
  const [request, setRequest] = useState<ObservabilityServiceQuery>(() =>
    serviceRequest(
      {
        rangeMinutes: 60,
        service: searchParams.get('service') ?? undefined,
        timeFrom: searchParams.get('from') ?? undefined,
        timeTo: searchParams.get('to') ?? undefined,
      },
      requestedClusterId,
      requestedNamespace,
      searchParams.get('dataSourceId'),
    ),
  )
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const services = useQuery(observabilitySignalQueries.services(request))
  const service = useQuery(
    observabilitySignalQueries.service(selectedServiceId, selectedServiceId ? request : undefined),
  )
  const topology = useQuery(
    observabilitySignalQueries.topology(selectedServiceId, selectedServiceId ? request : undefined),
  )

  function explorePath(signal: 'metrics' | 'traces', serviceName: string) {
    const params = signalSearchParams(new URLSearchParams(), {
      signal,
      cluster: request.clusterId,
      namespace: request.namespace,
      service: serviceName,
      from: request.timeFrom,
      to: request.timeTo,
    })
    return `/monitoring-workbench/explore?${params.toString()}`
  }

  const columns: TableColumnsType<ObservabilityService> = [
    {
      title: '服务',
      dataIndex: 'displayName',
      key: 'name',
      render: (_, item) => item.displayName || item.name,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: ObservabilityService['status']) => (
        <StatusTag label={statusLabel(value)} value={value} />
      ),
    },
    { title: '实例', dataIndex: ['instances', 'length'], key: 'instances', width: 90 },
    { title: '端点', dataIndex: ['endpoints', 'length'], key: 'endpoints', width: 90 },
    {
      title: '请求率',
      dataIndex: 'requestRate',
      key: 'requestRate',
      width: 110,
      render: (value?: number) => (value === undefined ? '-' : `${value.toFixed(2)}/s`),
    },
    {
      title: '错误率',
      dataIndex: 'errorRate',
      key: 'errorRate',
      width: 100,
      render: (value?: number) => (value === undefined ? '-' : `${(value * 100).toFixed(2)}%`),
    },
    {
      title: 'P95',
      dataIndex: 'latencyP95Ms',
      key: 'latencyP95Ms',
      width: 100,
      render: (value?: number) => (value === undefined ? '-' : `${value.toFixed(1)} ms`),
    },
    {
      key: 'actions',
      width: 132,
      render: (_, item) => (
        <Space size={0}>
          <ManagementIconButton
            icon={<EyeOutlined />}
            tooltip="查看服务详情"
            onClick={() => setSelectedServiceId(item.id)}
          />
          <ManagementIconButton
            icon={<LineChartOutlined />}
            tooltip="查看服务指标"
            onClick={() => navigate(explorePath('metrics', item.name))}
          />
          <ManagementIconButton
            icon={<ShareAltOutlined />}
            tooltip="查看服务链路"
            onClick={() => navigate(explorePath('traces', item.name))}
          />
        </Space>
      ),
    },
  ]

  return (
    <div className="soha-page soha-signal-page">
      <SignalQueryForm
        form={form}
        initialValues={{
          rangeMinutes: 60,
          service: searchParams.get('service') ?? undefined,
          timeFrom: searchParams.get('from') ?? undefined,
          timeTo: searchParams.get('to') ?? undefined,
        }}
        loading={services.isFetching}
        showWorkload={false}
        submitLabel="查询服务"
        onFinish={(values) => {
          const next = serviceRequest(
            values,
            requestedClusterId,
            requestedNamespace,
            searchParams.get('dataSourceId'),
          )
          setRequest(next)
          setSearchParams(
            signalSearchParams(searchParams, {
              cluster: next.clusterId,
              namespace: next.namespace,
              service: next.service,
              from: next.timeFrom,
              to: next.timeTo,
            }),
            { replace: true },
          )
        }}
      />
      {services.data?.meta.warnings?.map((warning) => (
        <Alert key={warning} message={warning} showIcon type="warning" />
      ))}
      {services.isLoading ? (
        <ManagementState bordered={false} compact kind="loading" title="正在查询服务" />
      ) : services.error ? (
        <ManagementState
          bordered={false}
          compact
          kind="error"
          title="服务查询失败"
          description={services.error.message}
        />
      ) : (
        <AdminTable
          columnSettingPlacement="hidden"
          columns={columns}
          dataSource={services.data?.items ?? []}
          empty={<ManagementState bordered={false} compact description="当前范围没有发现服务" />}
          pagination={false}
          rowKey="id"
          shellClassName="soha-management-table-shell"
          scroll={{ x: 'max-content' }}
        />
      )}

      <Drawer
        destroyOnHidden
        open={Boolean(selectedServiceId)}
        size="large"
        title={service.data?.data.displayName || service.data?.data.name || '服务详情'}
        onClose={() => setSelectedServiceId('')}
      >
        {service.isLoading ? (
          <ManagementState bordered={false} compact kind="loading" title="正在加载服务" />
        ) : service.error ? (
          <ManagementState
            bordered={false}
            compact
            kind="error"
            title="服务详情加载失败"
            description={service.error.message}
          />
        ) : service.data ? (
          <>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="状态">
                <StatusTag
                  label={statusLabel(service.data.data.status)}
                  value={service.data.data.status}
                />
              </Descriptions.Item>
              <Descriptions.Item label="命名空间">
                {service.data.data.namespace || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="实例">
                {service.data.data.instances.length}
              </Descriptions.Item>
              <Descriptions.Item label="端点">
                {service.data.data.endpoints.length}
              </Descriptions.Item>
            </Descriptions>
            <div className="soha-service-drawer-section">
              <Title level={5}>端点</Title>
              <List
                dataSource={service.data.data.endpoints}
                locale={{ emptyText: '暂无端点' }}
                renderItem={(endpoint) => (
                  <List.Item
                    extra={
                      <StatusTag label={statusLabel(endpoint.status)} value={endpoint.status} />
                    }
                  >
                    <Text>{endpoint.name}</Text>
                  </List.Item>
                )}
              />
            </div>
            <div className="soha-service-drawer-section">
              <Space>
                <Title level={5}>依赖拓扑</Title>
                <MetadataTag label="Beta" tone="gold" />
              </Space>
              {topology.isLoading ? (
                <ManagementState bordered={false} compact kind="loading" title="正在加载拓扑" />
              ) : topology.error ? (
                <ManagementState
                  bordered={false}
                  compact
                  kind="error"
                  title="拓扑加载失败"
                  description={topology.error.message}
                />
              ) : (
                <List
                  className="soha-topology-edge-list"
                  dataSource={topology.data?.data.edges ?? []}
                  locale={{ emptyText: '当前范围暂无服务依赖' }}
                  renderItem={(edge) => (
                    <List.Item>
                      <Text code>{edge.sourceServiceId}</Text>
                      <Text type="secondary">→</Text>
                      <Text code>{edge.targetServiceId}</Text>
                    </List.Item>
                  )}
                />
              )}
            </div>
          </>
        ) : null}
      </Drawer>
    </div>
  )
}
