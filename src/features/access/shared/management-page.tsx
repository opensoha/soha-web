import { useState, type ReactNode } from 'react'
import type { TableColumnsType } from 'antd'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementKeywordField,
  ManagementDensityButton,
  ManagementQueryActions,
  ManagementRefreshButton,
  ManagementTableToolbar,
} from '@/components/management-list'

interface AccessManagementTablePageProps<T extends object> {
  children?: ReactNode
  columns: TableColumnsType<T>
  createAction?: ReactNode
  dataSource: T[]
  loading?: boolean
  onRefresh: () => void
  placeholder: string
  refreshing?: boolean
  rowKey: string | ((record: T) => string)
  searchKeyword: string
  setSearchKeyword: (value: string) => void
  resourceName: string
}

export function AccessManagementTablePage<T extends object>({
  children,
  columns,
  createAction,
  dataSource,
  loading,
  onRefresh,
  placeholder,
  refreshing,
  rowKey,
  searchKeyword,
  setSearchKeyword,
  resourceName,
}: AccessManagementTablePageProps<T>) {
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')

  return (
    <ManagementDataPage
      query={{
        onFinish: () => undefined,
        actions: (
          <ManagementQueryActions
            disabledReset={!searchKeyword.trim()}
            onReset={() => setSearchKeyword('')}
          />
        ),
        children: (
          <ManagementKeywordField
            label="关键词"
            placeholder={placeholder}
            value={searchKeyword}
            onChange={setSearchKeyword}
            inputProps={{
              className: 'soha-platform-compact-field soha-workload-search-input',
            }}
          />
        ),
      }}
      table={{
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        className: 'soha-access-table',
        headerExtra: (
          <ManagementTableToolbar>
            {createAction}
            <ManagementDensityButton
              aria-label={`切换${resourceName}表格密度`}
              size="small"
              tooltip={tableSize === 'small' ? '切换为宽松密度' : '切换为紧凑密度'}
              onClick={() => setTableSize((current) => (current === 'small' ? 'middle' : 'small'))}
            />
            <ManagementRefreshButton
              aria-label={`刷新${resourceName}`}
              loading={refreshing}
              size="small"
              tooltip="刷新"
              onClick={onRefresh}
            />
          </ManagementTableToolbar>
        ),
        columns,
        dataSource,
        rowKey,
        loading,
        scroll: { x: 'max-content' },
        tableSize,
      }}
    >
      {children}
    </ManagementDataPage>
  )
}
