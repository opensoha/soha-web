import { useState, type ReactNode } from 'react'
import { Tooltip, Typography } from 'antd'
import {
  ManagementDensityButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryPanel,
  ManagementRefreshButton,
  ManagementState,
} from '@/components/management-list'

const { Link, Text } = Typography

export type WorkloadLocaleCode = 'zh_CN' | 'en_US'

export function WorkloadRefreshButton({
  disabled,
  label,
  loading,
  onRefresh,
}: {
  disabled?: boolean
  label: string
  loading?: boolean
  onRefresh: () => void
}) {
  return (
    <ManagementRefreshButton
      aria-label={label}
      disabled={disabled}
      loading={loading}
      tooltip={label}
      onClick={onRefresh}
    />
  )
}

export function WorkloadSearchInput({
  label,
  onChange,
  placeholder,
  value,
  width,
}: {
  label: ReactNode
  onChange: (value: string) => void
  placeholder: string
  value: string
  width?: number | string
}) {
  return (
    <ManagementKeywordField
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      width={width}
      inputProps={{
        className: 'soha-platform-compact-field soha-workload-search-input',
        size: 'small',
      }}
    />
  )
}

export function WorkloadQueryPanel({
  children,
  hasActiveFilters,
  localeCode,
  onReset,
}: {
  children: ReactNode
  hasActiveFilters: boolean
  localeCode: WorkloadLocaleCode
  onReset: () => void
}) {
  return (
    <ManagementQueryPanel
      collapsible
      lessLabel={localeCode === 'zh_CN' ? '收起' : 'Collapse'}
      moreLabel={localeCode === 'zh_CN' ? '展开' : 'Expand'}
      onFinish={() => undefined}
      actions={
        <ManagementQueryActions
          disabledReset={!hasActiveFilters}
          onReset={onReset}
          resetLabel={localeCode === 'zh_CN' ? '重置' : 'Reset'}
          submitLabel={localeCode === 'zh_CN' ? '查询' : 'Search'}
        />
      }
    >
      {children}
    </ManagementQueryPanel>
  )
}

export function WorkloadTableSummary({
  filteredCount,
  localeCode,
  totalCount,
}: {
  filteredCount: number
  localeCode: WorkloadLocaleCode
  totalCount: number
}) {
  return (
    <Text className="soha-workload-table-summary" type="secondary">
      {localeCode === 'zh_CN'
        ? `当前 ${filteredCount} / ${totalCount} 条`
        : `${filteredCount} / ${totalCount} items`}
    </Text>
  )
}

export function WorkloadTableEmpty({
  clusterId,
  filteredCount,
  localeCode,
  resourceLabel,
  totalCount,
}: {
  clusterId?: string | null
  filteredCount: number
  localeCode: WorkloadLocaleCode
  resourceLabel: string
  totalCount: number
}) {
  const hasFilterMiss = totalCount > 0 && filteredCount === 0
  const title = !clusterId
    ? localeCode === 'zh_CN'
      ? '请选择集群'
      : 'Select a cluster'
    : hasFilterMiss
      ? localeCode === 'zh_CN'
        ? `没有匹配的 ${resourceLabel}`
        : `No matching ${resourceLabel}`
      : localeCode === 'zh_CN'
        ? `当前范围没有 ${resourceLabel}`
        : `No ${resourceLabel} in the current scope`
  const description = !clusterId
    ? localeCode === 'zh_CN'
      ? '在顶部作用域选择集群后查看工作负载资源。'
      : 'Select a cluster in the header scope controls to inspect workload resources.'
    : hasFilterMiss
      ? localeCode === 'zh_CN'
        ? '调整搜索或筛选条件后重试。'
        : 'Adjust search or filters and try again.'
      : localeCode === 'zh_CN'
        ? '当前集群和命名空间范围内没有可展示的记录。'
        : 'No records are available for the selected cluster and namespace scope.'

  return (
    <ManagementState
      bordered={false}
      compact
      description={description}
      kind={!clusterId ? 'select-scope' : 'empty'}
      title={title}
    />
  )
}

export function useWorkloadTableDensity(localeCode: WorkloadLocaleCode) {
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'
  const densityButton = (
    <ManagementDensityButton
      aria-label={densityLabel}
      title={densityLabel}
      tooltip={densityLabel}
      onClick={() => setTableSize((current) => (current === 'middle' ? 'small' : 'middle'))}
    />
  )

  return { densityButton, tableSize }
}

export function renderWorkloadNameLink(name: string, onClick: () => void) {
  return (
    <Tooltip title={name} placement="topLeft">
      <Link className="soha-workload-name-link" onClick={onClick}>
        {name}
      </Link>
    </Tooltip>
  )
}
