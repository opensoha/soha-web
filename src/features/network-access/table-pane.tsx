import { useMemo, useState, type ReactNode } from 'react'
import type { TableColumnsType } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { useI18n } from '@/i18n'

interface TablePaneProps<T extends { id: string }> {
  columns: TableColumnsType<T>
  createAction?: ReactNode
  getSearchValues: (item: T) => unknown[]
  items?: T[]
  loading: boolean
  error: boolean
  onRefresh: () => void
  refreshing: boolean
  searchPlaceholder: string
}

export function TablePane<T extends { id: string }>({
  columns,
  createAction,
  error,
  getSearchValues,
  items = [],
  loading,
  onRefresh,
  refreshing,
  searchPlaceholder,
}: TablePaneProps<T>) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase()
    if (!keyword) return items
    return items.filter((item) =>
      getSearchValues(item).some((value) =>
        String(value ?? '')
          .toLocaleLowerCase()
          .includes(keyword),
      ),
    )
  }, [getSearchValues, items, search])

  return (
    <AdminTable
      columns={columns}
      dataSource={filtered}
      empty={error ? <ManagementState compact kind="error" /> : undefined}
      loading={loading}
      localSorting
      rowKey="id"
      shellClassName="soha-management-table-shell"
      toolbar={
        <ManagementTableToolbar>
          <ManagementToolbarSearch
            placeholder={searchPlaceholder}
            value={search}
            onChange={setSearch}
          />
        </ManagementTableToolbar>
      }
      toolbarExtra={
        <ManagementTableToolbar>
          {createAction}
          <ManagementIconButton
            aria-label={t('networkAccess.refresh', '刷新')}
            icon={<ReloadOutlined />}
            loading={refreshing}
            tooltip={t('networkAccess.refresh', '刷新')}
            onClick={onRefresh}
          />
        </ManagementTableToolbar>
      }
      columnSettingIconOnly
      viewportScroll
    />
  )
}
