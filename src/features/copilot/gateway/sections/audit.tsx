import { ReloadOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { Button, DatePicker, Input, Select, Space, Tabs } from 'antd'
import { AdminTable } from '@/components/admin-table'
import { ManagementState } from '@/components/management-list'
import type {
  AIClient,
  AuditFilterState,
  GatewayAuditLog,
  GatewayManifest,
  GatewayTabKey,
  GatewayTimeRangeValue,
  LLMCallLog,
  LLMUpstream,
  ModelCallFilterState,
} from '../types'
import {
  auditActionOptions,
  auditResultOptions,
  gatewayTimeRangeQuery,
  relayCacheStatusOptions,
  relayCallStatusOptions,
  relayEndpointOptions,
  relayProviderKindOptions,
  riskLevelOptions,
} from '../types'

const { RangePicker } = DatePicker

export interface GatewayCallLogsSectionProps {
  activeTab: GatewayTabKey
  onTabChange: (tab: GatewayTabKey) => void
  columns: TableColumnsType<GatewayAuditLog>
  logs: GatewayAuditLog[]
  loading: boolean
  filters: AuditFilterState
  clients: AIClient[]
  manifest?: GatewayManifest
  expandedRowRender: (record: GatewayAuditLog) => React.ReactNode
  modelCallColumns: TableColumnsType<LLMCallLog>
  modelCalls: LLMCallLog[]
  modelCallsLoading: boolean
  modelCallsFetching: boolean
  modelCallFilters: ModelCallFilterState
  upstreams: LLMUpstream[]
  canRelayManage: boolean
  expandedModelCallRowRender: (record: LLMCallLog) => React.ReactNode
  onModelCallFiltersChange: (filters: ModelCallFilterState) => void
  onRefreshModelCalls: () => void
  onFiltersChange: (filters: AuditFilterState) => void
  onRefresh: () => void
}

export function GatewayCallLogsSection({
  columns,
  activeTab,
  onTabChange,
  logs,
  loading,
  filters,
  clients,
  manifest,
  expandedRowRender,
  modelCallColumns,
  modelCalls,
  modelCallsLoading,
  modelCallsFetching,
  modelCallFilters,
  upstreams,
  canRelayManage,
  expandedModelCallRowRender,
  onModelCallFiltersChange,
  onRefreshModelCalls,
  onFiltersChange,
  onRefresh,
}: GatewayCallLogsSectionProps) {
  const clientOptions = clients.map((item) => ({
    label: `${item.name} (${item.id})`,
    value: item.id,
  }))
  const toolOptions = manifest?.tools.map((item) => ({ label: item.name, value: item.name })) ?? []
  const upstreamOptions = upstreams.map((item) => ({
    label: `${item.name} (${item.id})`,
    value: item.id,
  }))

  return (
    <Tabs
      activeKey={activeTab}
      onChange={(key) => onTabChange(key as GatewayTabKey)}
      destroyOnHidden
      items={[
        {
          key: 'model-calls',
          label: 'Model Calls',
          children: (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                <Input
                  style={{ width: 180 }}
                  placeholder="调用者 ID"
                  value={modelCallFilters.actor}
                  onChange={(event) =>
                    onModelCallFiltersChange({
                      ...modelCallFilters,
                      actor: event.target.value,
                    })
                  }
                />
                <Input
                  style={{ width: 180 }}
                  placeholder="Token ID"
                  value={modelCallFilters.tokenId}
                  onChange={(event) =>
                    onModelCallFiltersChange({
                      ...modelCallFilters,
                      tokenId: event.target.value,
                    })
                  }
                />
                <Input
                  style={{ width: 200 }}
                  placeholder="Public model"
                  value={modelCallFilters.publicModel}
                  onChange={(event) =>
                    onModelCallFiltersChange({
                      ...modelCallFilters,
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
                  value={modelCallFilters.upstreamId || undefined}
                  onChange={(value) =>
                    onModelCallFiltersChange({
                      ...modelCallFilters,
                      upstreamId: value ?? '',
                    })
                  }
                />
                <Select
                  allowClear
                  style={{ width: 170 }}
                  placeholder="Provider"
                  options={relayProviderKindOptions}
                  value={modelCallFilters.providerKind || undefined}
                  onChange={(value) =>
                    onModelCallFiltersChange({
                      ...modelCallFilters,
                      providerKind: value ?? '',
                    })
                  }
                />
                <Select
                  allowClear
                  style={{ width: 190 }}
                  placeholder="Endpoint"
                  options={relayEndpointOptions}
                  value={modelCallFilters.endpoint || undefined}
                  onChange={(value) =>
                    onModelCallFiltersChange({
                      ...modelCallFilters,
                      endpoint: value ?? '',
                    })
                  }
                />
                <Select
                  allowClear
                  style={{ width: 170 }}
                  placeholder="状态"
                  options={relayCallStatusOptions}
                  value={modelCallFilters.status || undefined}
                  onChange={(value) =>
                    onModelCallFiltersChange({
                      ...modelCallFilters,
                      status: value ?? '',
                    })
                  }
                />
                <Select
                  allowClear
                  style={{ width: 170 }}
                  placeholder="Cache"
                  options={relayCacheStatusOptions}
                  value={modelCallFilters.cacheStatus || undefined}
                  onChange={(value) =>
                    onModelCallFiltersChange({
                      ...modelCallFilters,
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
                    onModelCallFiltersChange({
                      ...modelCallFilters,
                      ...gatewayTimeRangeQuery(value as GatewayTimeRangeValue),
                    })
                  }
                />
                <Button
                  icon={<ReloadOutlined />}
                  disabled={!canRelayManage}
                  loading={modelCallsFetching}
                  onClick={onRefreshModelCalls}
                >
                  刷新
                </Button>
              </Space>
              {canRelayManage ? (
                <AdminTable
                  shellClassName="soha-management-table-shell"
                  columnSettingIconOnly
                  columnSettingPlacement="header"
                  rowKey="id"
                  tableSize="small"
                  columns={modelCallColumns}
                  dataSource={modelCalls}
                  loading={modelCallsLoading}
                  scroll={{ x: 1420 }}
                  expandable={{ expandedRowRender: expandedModelCallRowRender }}
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
        {
          key: 'audit',
          label: 'Tool Calls',
          children: (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                <Input
                  style={{ width: 190 }}
                  placeholder="调用者 ID"
                  value={filters.actor}
                  onChange={(event) => onFiltersChange({ ...filters, actor: event.target.value })}
                />
                <Select
                  allowClear
                  style={{ width: 220 }}
                  placeholder="调用入口 client"
                  options={clientOptions}
                  value={filters.aiClientId || undefined}
                  onChange={(value) => onFiltersChange({ ...filters, aiClientId: value ?? '' })}
                />
                <Select
                  allowClear
                  style={{ width: 260 }}
                  placeholder="调用内容 / Tool"
                  options={toolOptions}
                  value={filters.toolName || undefined}
                  onChange={(value) => onFiltersChange({ ...filters, toolName: value ?? '' })}
                />
                <Select
                  allowClear
                  style={{ width: 180 }}
                  placeholder="动作"
                  options={auditActionOptions}
                  value={filters.action || undefined}
                  onChange={(value) => onFiltersChange({ ...filters, action: value ?? '' })}
                />
                <Select
                  allowClear
                  style={{ width: 140 }}
                  placeholder="Risk"
                  options={riskLevelOptions}
                  value={filters.riskLevel || undefined}
                  onChange={(value) => onFiltersChange({ ...filters, riskLevel: value ?? '' })}
                />
                <Select
                  allowClear
                  style={{ width: 190 }}
                  placeholder="Result"
                  options={auditResultOptions}
                  value={filters.result || undefined}
                  onChange={(value) => onFiltersChange({ ...filters, result: value ?? '' })}
                />
                <RangePicker
                  showTime
                  allowClear
                  style={{ width: 340 }}
                  placeholder={['开始时间', '结束时间']}
                  onChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      ...gatewayTimeRangeQuery(value as GatewayTimeRangeValue),
                    })
                  }
                />
                <Button icon={<ReloadOutlined />} onClick={onRefresh}>
                  刷新
                </Button>
              </Space>
              <AdminTable
                shellClassName="soha-management-table-shell"
                columnSettingIconOnly
                columnSettingPlacement="header"
                rowKey="id"
                tableSize="small"
                columns={columns}
                dataSource={logs}
                loading={loading}
                scroll={{ x: 1220 }}
                expandable={{ expandedRowRender }}
              />
            </Space>
          ),
        },
      ]}
    />
  )
}
