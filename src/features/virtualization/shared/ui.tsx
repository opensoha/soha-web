import type { ComponentProps, ReactNode } from 'react'
import { useState } from 'react'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDensityButton,
  ManagementRefreshButton,
  ManagementTableToolbar,
} from '@/components/management-list'

type AdminTableProps = ComponentProps<typeof AdminTable>

const DEFAULT_PAGINATION_SUMMARY: NonNullable<AdminTableProps['paginationSummary']> = (
  total,
  range,
) => {
  if (total <= 0) return '当前 0 / 0 条'
  return `当前 ${range[0]}-${range[1]} / ${total} 条`
}

function classNames(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(' ')
}

type VirtualizationAdminTableProps = Omit<
  AdminTableProps,
  | 'columnSettingIconOnly'
  | 'columnSettingPlacement'
  | 'paginationSummary'
  | 'shellClassName'
  | 'tableSize'
  | 'toolbarExtra'
> & {
  actions?: ReactNode
  enableDensity?: boolean
  paginationSummary?: AdminTableProps['paginationSummary']
  refreshing?: boolean
  showColumnSettings?: boolean
  showRefresh?: boolean
  shellClassName?: string
  toolbarExtra?: ReactNode
  onRefresh?: () => void
}

export function VirtualizationAdminTable({
  actions,
  className,
  enableDensity = true,
  onRefresh,
  pagination,
  paginationSummary = DEFAULT_PAGINATION_SUMMARY,
  refreshing,
  shellClassName,
  showColumnSettings = true,
  showRefresh = true,
  title,
  toolbarExtra,
  ...tableProps
}: VirtualizationAdminTableProps) {
  const [tableSize, setTableSize] = useState<NonNullable<AdminTableProps['tableSize']>>('small')
  const tableControls =
    toolbarExtra || actions || enableDensity || (showRefresh && onRefresh) ? (
      <ManagementTableToolbar>
        {toolbarExtra}
        {actions}
        {enableDensity ? (
          <ManagementDensityButton
            aria-label="切换表格密度"
            size="small"
            tooltip={tableSize === 'small' ? '切换为宽松密度' : '切换为紧凑密度'}
            onClick={() => setTableSize((current) => (current === 'small' ? 'middle' : 'small'))}
          />
        ) : null}
        {showRefresh && onRefresh ? (
          <ManagementRefreshButton
            aria-label="刷新列表"
            loading={refreshing}
            size="small"
            tooltip="刷新"
            onClick={onRefresh}
          />
        ) : null}
      </ManagementTableToolbar>
    ) : undefined

  return (
    <AdminTable
      {...tableProps}
      className={classNames('soha-vrt-table', className)}
      columnSettingIconOnly
      columnSettingPlacement={showColumnSettings ? (title ? 'header' : 'toolbar') : 'hidden'}
      pagination={pagination}
      paginationSummary={pagination === false ? undefined : paginationSummary}
      shellClassName={classNames('soha-management-table-shell', shellClassName)}
      tableSize={tableSize}
      title={title}
      toolbarExtra={tableControls}
    />
  )
}
