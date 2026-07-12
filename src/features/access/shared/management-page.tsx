import type { ReactNode } from 'react'
import type { TableColumnsType } from 'antd'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementTableToolbar,
} from '@/components/management-list'

interface AccessManagementTablePageProps<T extends object> {
  children?: ReactNode
  columns: TableColumnsType<T>
  createAction?: ReactNode
  dataSource: T[]
  loading?: boolean
  placeholder: string
  rowKey: string | ((record: T) => string)
  searchKeyword: string
  setSearchKeyword: (value: string) => void
}

export function AccessManagementTablePage<T extends object>({
  children,
  columns,
  createAction,
  dataSource,
  loading,
  placeholder,
  rowKey,
  searchKeyword,
  setSearchKeyword,
}: AccessManagementTablePageProps<T>) {
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
        headerExtra: createAction ? (
          <ManagementTableToolbar>{createAction}</ManagementTableToolbar>
        ) : null,
        columns,
        dataSource,
        rowKey,
        loading,
        scroll: { x: 'max-content' },
      }}
    >
      {children}
    </ManagementDataPage>
  )
}
