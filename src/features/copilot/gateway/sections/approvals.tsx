import type { ReactNode } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { Button, DatePicker, Input, Select, Space } from 'antd'
import { AdminTable } from '@/components/admin-table'
import type {
  AIClient,
  ApprovalFilterState,
  ApprovalRequest,
  GatewayManifest,
  GatewayTimeRangeValue,
} from '../types'
import {
  approvalRequestStrategyOptions,
  approvalStatusOptions,
  gatewayTimeRangeQuery,
  riskLevelOptions,
} from '../types'

const { RangePicker } = DatePicker

export interface GatewayApprovalsSectionProps {
  columns: TableColumnsType<ApprovalRequest>
  approvals: ApprovalRequest[]
  loading: boolean
  filters: ApprovalFilterState
  clients: AIClient[]
  manifest?: GatewayManifest
  expandedRowRender: (record: ApprovalRequest) => ReactNode
  onFiltersChange: (filters: ApprovalFilterState) => void
  onRefresh: () => void
}

export function GatewayApprovalsSection({
  columns,
  approvals,
  loading,
  filters,
  clients,
  manifest,
  expandedRowRender,
  onFiltersChange,
  onRefresh,
}: GatewayApprovalsSectionProps) {
  const clientOptions = clients.map((item) => ({
    label: `${item.name} (${item.id})`,
    value: item.id,
  }))
  const toolOptions = manifest?.tools.map((item) => ({ label: item.name, value: item.name })) ?? []

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap>
        <Input
          style={{ width: 220 }}
          placeholder="approvalRequestId"
          value={filters.id}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              id: event.target.value,
              status: event.target.value ? '' : filters.status,
            })
          }
        />
        <Select
          allowClear
          style={{ width: 150 }}
          placeholder="状态"
          options={approvalStatusOptions}
          value={filters.status || undefined}
          onChange={(value) => onFiltersChange({ ...filters, status: value ?? '' })}
        />
        <Input
          style={{ width: 180 }}
          placeholder="actorId"
          value={filters.actor}
          onChange={(event) => onFiltersChange({ ...filters, actor: event.target.value })}
        />
        <Select
          allowClear
          style={{ width: 220 }}
          placeholder="AI client"
          options={clientOptions}
          value={filters.aiClientId || undefined}
          onChange={(value) => onFiltersChange({ ...filters, aiClientId: value ?? '' })}
        />
        <Select
          allowClear
          style={{ width: 260 }}
          placeholder="Tool"
          options={toolOptions}
          value={filters.toolName || undefined}
          onChange={(value) => onFiltersChange({ ...filters, toolName: value ?? '' })}
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
          placeholder="Strategy"
          options={approvalRequestStrategyOptions}
          value={filters.strategy || undefined}
          onChange={(value) => onFiltersChange({ ...filters, strategy: value ?? '' })}
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
        dataSource={approvals}
        loading={loading}
        scroll={{ x: 1560 }}
        expandable={{ expandedRowRender }}
      />
    </Space>
  )
}
