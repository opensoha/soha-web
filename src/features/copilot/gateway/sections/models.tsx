import { HistoryOutlined, LinkOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { Button, DatePicker, Descriptions, Input, Select, Space, Tabs } from 'antd'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import type {
  GatewayTabKey,
  GatewayTimeRangeValue,
  LLMCallLog,
  LLMModelRoute,
  LLMUpstream,
  ModelCallFilterState,
} from '../types'
import {
  gatewayTimeRangeQuery,
  relayCacheStatusOptions,
  relayCallStatusOptions,
  relayEndpointOptions,
  relayProviderKindOptions,
  relayUpstreamStatusOptions,
} from '../types'

const { RangePicker } = DatePicker

export interface GatewayRelaySectionProps {
  activeTab: GatewayTabKey
  onTabChange: (tab: GatewayTabKey) => void
  metrics: {
    requests: string
    successRate: string
    failure: string
    ttfb: string
    ttft: string
    duration: string
    tokensPerSecond: string
    cache: string
  }
  rankingColumns: TableColumnsType<{ key: string; count: number }>
  ranking: Array<{ key: string; count: number }>
  metricsLoading: boolean
  metricsFetching: boolean
  recentErrors: LLMCallLog[]
  modelCallColumns: TableColumnsType<LLMCallLog>
  modelCalls: LLMCallLog[]
  modelCallsLoading: boolean
  modelCallsFetching: boolean
  modelCallFilters: ModelCallFilterState
  onModelCallFiltersChange: (filters: ModelCallFilterState) => void
  canRelayManage: boolean
  upstreamColumns: TableColumnsType<LLMUpstream>
  upstreams: LLMUpstream[]
  upstreamsLoading: boolean
  upstreamsFetching: boolean
  upstreamFilter: string
  upstreamProviderFilter: string
  upstreamStatusFilter: string
  onUpstreamFilterChange: (value: string) => void
  onUpstreamProviderFilterChange: (value: string) => void
  onUpstreamStatusFilterChange: (value: string) => void
  onRefreshUpstreams: () => void
  onCreateUpstream: () => void
  modelRouteColumns: TableColumnsType<LLMModelRoute>
  modelRoutes: LLMModelRoute[]
  modelRoutesLoading: boolean
  modelRoutesFetching: boolean
  modelRouteFilter: string
  modelRouteProviderFilter: string
  modelRouteUpstreamFilter: string
  onModelRouteFilterChange: (value: string) => void
  onModelRouteProviderFilterChange: (value: string) => void
  onModelRouteUpstreamFilterChange: (value: string) => void
  onRefreshModelRoutes: () => void
  onCreateModelRoute: () => void
  onRefreshAll: () => void
  onRefreshModelCalls: () => void
  expandedErrorRowRender: (record: LLMCallLog) => React.ReactNode
  expandedModelCallRowRender: (record: LLMCallLog) => React.ReactNode
}

export function GatewayRelaySection(props: GatewayRelaySectionProps) {
  const upstreamOptions = props.upstreams.map((item) => ({
    label: `${item.name} (${item.id})`,
    value: item.id,
  }))

  return (
    <Tabs
      activeKey={props.activeTab}
      onChange={(key) => props.onTabChange(key as GatewayTabKey)}
      destroyOnHidden
      items={[
        {
          key: 'relay',
          label: '模型中转',
          children: (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Descriptions
                size="small"
                column={4}
                bordered
                items={[
                  { key: 'requests', label: '今日请求', children: props.metrics.requests },
                  { key: 'successRate', label: '成功率', children: props.metrics.successRate },
                  { key: 'failure', label: '失败数', children: props.metrics.failure },
                  { key: 'ttfb', label: '平均 TTFB', children: props.metrics.ttfb },
                  { key: 'ttft', label: '平均 TTFT', children: props.metrics.ttft },
                  { key: 'duration', label: '平均耗时', children: props.metrics.duration },
                  { key: 'tps', label: 'tokens/sec', children: props.metrics.tokensPerSecond },
                  { key: 'cache', label: 'Cache', children: props.metrics.cache },
                ]}
              />
              <Space wrap>
                <Button
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={() => props.onTabChange('upstreams')}
                >
                  上游管理
                </Button>
                <Button
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={() => props.onTabChange('model-routes')}
                >
                  模型路由
                </Button>
                <Button
                  size="small"
                  icon={<HistoryOutlined />}
                  disabled={!props.canRelayManage}
                  onClick={() => props.onTabChange('model-calls')}
                >
                  Model Calls
                </Button>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={
                    props.metricsFetching || props.upstreamsFetching || props.modelRoutesFetching
                  }
                  onClick={props.onRefreshAll}
                >
                  刷新
                </Button>
              </Space>
              <div className="grid gap-3 lg:grid-cols-2">
                <AdminTable
                  shellClassName="soha-management-table-shell"
                  columnSettingIconOnly
                  columnSettingPlacement="header"
                  rowKey="key"
                  tableSize="small"
                  title="模型排行"
                  columns={props.rankingColumns}
                  dataSource={props.ranking}
                  loading={props.metricsLoading}
                  pagination={false}
                />
                <AdminTable
                  shellClassName="soha-management-table-shell"
                  columnSettingIconOnly
                  columnSettingPlacement="header"
                  rowKey="id"
                  tableSize="small"
                  title="最近模型错误"
                  columns={props.modelCallColumns}
                  dataSource={props.recentErrors}
                  loading={props.metricsLoading || props.modelCallsLoading}
                  pagination={false}
                  scroll={{ x: 1180 }}
                  expandable={{ expandedRowRender: props.expandedErrorRowRender }}
                />
              </div>
            </Space>
          ),
        },
        {
          key: 'upstreams',
          label: '上游管理',
          children: (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                <Select
                  allowClear
                  style={{ width: 190 }}
                  placeholder="Provider"
                  options={relayProviderKindOptions}
                  value={props.upstreamProviderFilter || undefined}
                  onChange={(value) => props.onUpstreamProviderFilterChange(value ?? '')}
                />
                <Select
                  allowClear
                  style={{ width: 160 }}
                  placeholder="状态"
                  options={relayUpstreamStatusOptions}
                  value={props.upstreamStatusFilter || undefined}
                  onChange={(value) => props.onUpstreamStatusFilterChange(value ?? '')}
                />
                <Button
                  icon={<ReloadOutlined />}
                  loading={props.upstreamsFetching}
                  onClick={props.onRefreshUpstreams}
                >
                  刷新
                </Button>
              </Space>
              <AdminTable
                shellClassName="soha-management-table-shell"
                columnSettingIconOnly
                columnSettingPlacement="header"
                rowKey="id"
                tableSize="small"
                columns={props.upstreamColumns}
                dataSource={props.upstreams}
                loading={props.upstreamsLoading}
                scroll={{ x: 1540 }}
                title="上游管理"
                headerExtra={
                  <ManagementTableToolbar>
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      disabled={!props.canRelayManage}
                      onClick={props.onCreateUpstream}
                    >
                      新增上游
                    </Button>
                    <ManagementToolbarSearch
                      placeholder="过滤上游 / 模型"
                      value={props.upstreamFilter}
                      onChange={props.onUpstreamFilterChange}
                    />
                  </ManagementTableToolbar>
                }
              />
            </Space>
          ),
        },
        {
          key: 'model-routes',
          label: '模型路由',
          children: (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                <Select
                  allowClear
                  style={{ width: 190 }}
                  placeholder="Provider"
                  options={relayProviderKindOptions}
                  value={props.modelRouteProviderFilter || undefined}
                  onChange={(value) => props.onModelRouteProviderFilterChange(value ?? '')}
                />
                <Select
                  allowClear
                  showSearch
                  style={{ width: 260 }}
                  placeholder="上游"
                  options={upstreamOptions}
                  value={props.modelRouteUpstreamFilter || undefined}
                  onChange={(value) => props.onModelRouteUpstreamFilterChange(value ?? '')}
                />
                <Button
                  icon={<ReloadOutlined />}
                  loading={props.modelRoutesFetching}
                  onClick={props.onRefreshModelRoutes}
                >
                  刷新
                </Button>
              </Space>
              <AdminTable
                shellClassName="soha-management-table-shell"
                columnSettingIconOnly
                columnSettingPlacement="header"
                rowKey="id"
                tableSize="small"
                columns={props.modelRouteColumns}
                dataSource={props.modelRoutes}
                loading={props.modelRoutesLoading}
                scroll={{ x: 1380 }}
                title="模型路由"
                headerExtra={
                  <ManagementTableToolbar>
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      disabled={!props.canRelayManage}
                      onClick={props.onCreateModelRoute}
                    >
                      新增路由
                    </Button>
                    <ManagementToolbarSearch
                      placeholder="过滤 public/upstream model"
                      value={props.modelRouteFilter}
                      onChange={props.onModelRouteFilterChange}
                    />
                  </ManagementTableToolbar>
                }
              />
            </Space>
          ),
        },
        {
          key: 'model-calls',
          label: 'Model Calls',
          children: (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                <Input
                  style={{ width: 180 }}
                  placeholder="调用者 ID"
                  value={props.modelCallFilters.actor}
                  onChange={(event) =>
                    props.onModelCallFiltersChange({
                      ...props.modelCallFilters,
                      actor: event.target.value,
                    })
                  }
                />
                <Input
                  style={{ width: 180 }}
                  placeholder="Token ID"
                  value={props.modelCallFilters.tokenId}
                  onChange={(event) =>
                    props.onModelCallFiltersChange({
                      ...props.modelCallFilters,
                      tokenId: event.target.value,
                    })
                  }
                />
                <Input
                  style={{ width: 200 }}
                  placeholder="Public model"
                  value={props.modelCallFilters.publicModel}
                  onChange={(event) =>
                    props.onModelCallFiltersChange({
                      ...props.modelCallFilters,
                      publicModel: event.target.value,
                    })
                  }
                />
                <Select
                  allowClear
                  showSearch
                  style={{ width: 240 }}
                  placeholder="上游"
                  options={upstreamOptions}
                  value={props.modelCallFilters.upstreamId || undefined}
                  onChange={(value) =>
                    props.onModelCallFiltersChange({
                      ...props.modelCallFilters,
                      upstreamId: value ?? '',
                    })
                  }
                />
                <Select
                  allowClear
                  style={{ width: 170 }}
                  placeholder="Provider"
                  options={relayProviderKindOptions}
                  value={props.modelCallFilters.providerKind || undefined}
                  onChange={(value) =>
                    props.onModelCallFiltersChange({
                      ...props.modelCallFilters,
                      providerKind: value ?? '',
                    })
                  }
                />
                <Select
                  allowClear
                  style={{ width: 190 }}
                  placeholder="Endpoint"
                  options={relayEndpointOptions}
                  value={props.modelCallFilters.endpoint || undefined}
                  onChange={(value) =>
                    props.onModelCallFiltersChange({
                      ...props.modelCallFilters,
                      endpoint: value ?? '',
                    })
                  }
                />
                <Select
                  allowClear
                  style={{ width: 170 }}
                  placeholder="状态"
                  options={relayCallStatusOptions}
                  value={props.modelCallFilters.status || undefined}
                  onChange={(value) =>
                    props.onModelCallFiltersChange({
                      ...props.modelCallFilters,
                      status: value ?? '',
                    })
                  }
                />
                <Select
                  allowClear
                  style={{ width: 170 }}
                  placeholder="Cache"
                  options={relayCacheStatusOptions}
                  value={props.modelCallFilters.cacheStatus || undefined}
                  onChange={(value) =>
                    props.onModelCallFiltersChange({
                      ...props.modelCallFilters,
                      cacheStatus: value ?? '',
                    })
                  }
                />
                <RangePicker
                  showTime
                  allowClear
                  style={{ width: 340 }}
                  placeholder={['开始时间', '结束时间']}
                  onChange={(value) =>
                    props.onModelCallFiltersChange({
                      ...props.modelCallFilters,
                      ...gatewayTimeRangeQuery(value as GatewayTimeRangeValue),
                    })
                  }
                />
                <Button
                  icon={<ReloadOutlined />}
                  disabled={!props.canRelayManage}
                  loading={props.modelCallsFetching}
                  onClick={props.onRefreshModelCalls}
                >
                  刷新
                </Button>
              </Space>
              {props.canRelayManage ? (
                <AdminTable
                  shellClassName="soha-management-table-shell"
                  columnSettingIconOnly
                  columnSettingPlacement="header"
                  rowKey="id"
                  tableSize="small"
                  columns={props.modelCallColumns}
                  dataSource={props.modelCalls}
                  loading={props.modelCallsLoading}
                  scroll={{ x: 1420 }}
                  expandable={{ expandedRowRender: props.expandedModelCallRowRender }}
                />
              ) : (
                <ManagementState
                  bordered={false}
                  compact
                  kind="no-permission"
                  description="当前账号没有查看模型调用日志的权限。"
                />
              )}
            </Space>
          ),
        },
      ]}
    />
  )
}
