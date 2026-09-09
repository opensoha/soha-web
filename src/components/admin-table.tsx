import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Checkbox, Popover, Table, Typography } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { ManagementState } from '@/components/management-list'
import { useI18n } from '@/i18n'
import type { LocaleCode } from '@/i18n'
import './admin-table.css'

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 15, 20, 50, 100]
const VIEWPORT_SCROLL_MIN_BODY_HEIGHT = 240
const VIEWPORT_SCROLL_MIN_CONTAINER_HEIGHT = 640
const VIEWPORT_SCROLL_MIN_WIDTH = 768
const DEFAULT_PAGINATION_SUMMARY = (
  localeCode: LocaleCode,
  total: number,
  range: [number, number],
) => {
  if (total <= 0) return localeCode === 'zh_CN' ? '当前 0 / 0 条' : '0 / 0 items'
  return localeCode === 'zh_CN'
    ? `当前 ${range[0]}-${range[1]} / ${total} 条`
    : `${range[0]}-${range[1]} / ${total} items`
}
const ACTION_COLUMN_CLASS_NAME = 'soha-table-actions-column'
const AUTO_ACTION_COLUMN_CLASS_NAME = 'soha-table-actions-column--auto'
const { Text } = Typography

export interface AdminTableProps {
  className?: string
  columns: any[]
  currentPageSelectionLabel?: ReactNode
  dataSource: any[]
  empty?: ReactNode
  enableColumnSelection?: boolean
  expandable?: any
  expandedRowRender?: (record: any, index?: number) => ReactNode
  headerExtra?: ReactNode
  hideExpandedColumn?: boolean
  localSorting?: boolean
  loading?: boolean
  onChange?: any
  onRow?: any
  pageSize?: number
  pagination?: any
  paginationSummary?: ReactNode | ((total: number, range: [number, number]) => ReactNode)
  rowKey: string | ((record: any) => string)
  rowClassName?: any
  rowSelection?: any
  shellClassName?: string
  tableSize?: 'large' | 'middle' | 'small'
  tableLayout?: 'auto' | 'fixed'
  columnSettingPlacement?: 'toolbar' | 'header' | 'outside' | 'hidden'
  columnSettingIconOnly?: boolean
  scroll?: {
    x?: string | number
    y?: string | number
  }
  selectCurrentPageOnly?: boolean
  title?: ReactNode
  toolbar?: ReactNode
  toolbarExtra?: ReactNode
  viewportScroll?: boolean
}

function getColumnId(column: any, index: number) {
  if (typeof column?.key === 'string' && column.key) return column.key
  if (typeof column?.dataIndex === 'string' && column.dataIndex) return `${column.dataIndex}:${index}`
  if (Array.isArray(column?.dataIndex) && column.dataIndex.length > 0) return `${column.dataIndex.join('.')}:${index}`
  if (typeof column?.title === 'string' && column.title) return `${column.title}:${index}`
  return `column:${index}`
}

function isActionColumn(column: any) {
  const key = String(column?.key ?? '').trim().toLowerCase()
  const dataIndex = Array.isArray(column?.dataIndex)
    ? column.dataIndex.join('.').toLowerCase()
    : String(column?.dataIndex ?? '').trim().toLowerCase()
  const title = typeof column?.title === 'string' ? column.title.trim().toLowerCase() : ''
  return (
    key === 'actions' ||
    dataIndex === '__actions' ||
    (column?.fixed === 'right' && (title === '操作' || title === 'actions'))
  )
}

function mergeClassNames(...values: unknown[]) {
  return values
    .flatMap((value) => String(value ?? '').split(/\s+/))
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index)
    .join(' ')
}

function normalizeTableColumn(column: any): any {
  if (Array.isArray(column?.children)) {
    return { ...column, children: column.children.map(normalizeTableColumn) }
  }
  if (!isActionColumn(column)) return column

  const originalHeaderCell = column.onHeaderCell
  const originalCell = column.onCell
  const declaredClasses = mergeClassNames(
    column.className,
    typeof originalHeaderCell === 'function' ? originalHeaderCell(column)?.className : '',
  )
  const usesExplicitActionContract = declaredClasses.includes(ACTION_COLUMN_CLASS_NAME)
  const actionClasses = mergeClassNames(
    declaredClasses,
    ACTION_COLUMN_CLASS_NAME,
    usesExplicitActionContract ? '' : AUTO_ACTION_COLUMN_CLASS_NAME,
  )

  return {
    ...column,
    title: '',
    fixed: 'right',
    align: 'center',
    width: usesExplicitActionContract ? column.width : undefined,
    minWidth: usesExplicitActionContract ? column.minWidth : 52,
    className: actionClasses,
    onHeaderCell: (...args: any[]) => {
      const props = typeof originalHeaderCell === 'function' ? originalHeaderCell(...args) : {}
      return { ...props, className: mergeClassNames(props?.className, actionClasses) }
    },
    onCell: (...args: any[]) => {
      const props = typeof originalCell === 'function' ? originalCell(...args) : {}
      return { ...props, className: mergeClassNames(props?.className, actionClasses) }
    },
  }
}

function getColumnValue(record: any, dataIndex: string | number | Array<string | number>) {
  const path = Array.isArray(dataIndex) ? dataIndex : [dataIndex]
  return path.reduce((value, key) => (value == null ? undefined : value[key]), record)
}

function isSortableValue(value: unknown) {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    value instanceof Date
  )
}

function compareSortableValues(left: unknown, right: unknown, collator: Intl.Collator) {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right)
  }
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime()
  return collator.compare(String(left), String(right))
}

function addLocalSorters(columns: any[], dataSource: any[], collator: Intl.Collator): any[] {
  return columns.map((column) => {
    if (Array.isArray(column?.children)) {
      return { ...column, children: addLocalSorters(column.children, dataSource, collator) }
    }
    if (
      isActionColumn(column) ||
      Object.prototype.hasOwnProperty.call(column, 'sorter') ||
      column?.dataIndex == null
    ) {
      return column
    }
    const sampleValue = dataSource
      .map((record) => getColumnValue(record, column.dataIndex))
      .find((value) => value != null)
    if (!isSortableValue(sampleValue)) return column
    return {
      ...column,
      sorter: (left: any, right: any) =>
        compareSortableValues(
          getColumnValue(left, column.dataIndex),
          getColumnValue(right, column.dataIndex),
          collator,
        ),
    }
  })
}

function getColumnLabel(column: any, index: number) {
  if (isActionColumn(column)) return '操作'
  if (typeof column?.title === 'string' && column.title) return column.title
  if (typeof column?.dataIndex === 'string' && column.dataIndex) return column.dataIndex
  if (Array.isArray(column?.dataIndex) && column.dataIndex.length > 0) return column.dataIndex.join('.')
  return `列 ${index + 1}`
}

function getColumnWidth(column: any) {
  if (typeof column?.width === 'number' && Number.isFinite(column.width)) {
    return column.width
  }
  if (typeof column?.width === 'string') {
    const parsed = Number.parseInt(column.width, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

export function AdminTable({
  className,
  columns,
  currentPageSelectionLabel,
  dataSource,
  empty,
  enableColumnSelection = true,
  headerExtra,
  localSorting = false,
  loading,
  pageSize = 15,
  pagination,
  paginationSummary,
  rowKey,
  rowSelection,
  shellClassName,
  tableSize = 'small',
  columnSettingPlacement = 'toolbar',
  columnSettingIconOnly = false,
  scroll,
  selectCurrentPageOnly = false,
  title,
  toolbar,
  toolbarExtra,
  viewportScroll = false,
  ...rest
}: AdminTableProps) {
  const { localeCode, t } = useI18n()
  const localSortCollator = useMemo(
    () =>
      new Intl.Collator(localeCode === 'zh_CN' ? 'zh-CN' : 'en-US', {
        numeric: true,
        sensitivity: 'base',
      }),
    [localeCode],
  )
  const normalizedColumns = useMemo(() => {
    const nextColumns = columns.map(normalizeTableColumn)
    return localSorting ? addLocalSorters(nextColumns, dataSource, localSortCollator) : nextColumns
  }, [columns, dataSource, localSortCollator, localSorting])
  const columnOptions = useMemo(() => normalizedColumns.map((column, index) => ({
    id: getColumnId(column, index),
    label: getColumnLabel(column, index),
    column,
  })), [normalizedColumns])
  const selectableColumnOptions = useMemo(
    () => columnOptions.filter((option) => !isActionColumn(option.column)),
    [columnOptions],
  )
  const columnSignature = columnOptions.map((option) => option.id).join('|')
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [currentPageSize, setCurrentPageSize] = useState(pageSize)
  const [viewportScrollY, setViewportScrollY] = useState<number>()
  const tableShellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const nextIds = selectableColumnOptions.map((option) => option.id)
    setVisibleColumnIds((current) => {
      const filtered = current.filter((id) => nextIds.includes(id))
      return filtered.length > 0 ? filtered : nextIds
    })
  }, [columnSignature, selectableColumnOptions])

  useEffect(() => {
    if (pagination && pagination !== false && typeof pagination.currentPage === 'number') {
      setCurrentPage(pagination.currentPage)
    }
  }, [pagination])

  useEffect(() => {
    const nextPageSize = pagination && pagination !== false && typeof pagination.pageSize === 'number'
      ? pagination.pageSize
      : pageSize
    setCurrentPageSize(nextPageSize)
  }, [pageSize, pagination])

  const activeColumnIds = visibleColumnIds.length > 0
    ? visibleColumnIds
    : selectableColumnOptions.map((option) => option.id)
  const activeColumns = columnOptions
    .filter((option) => isActionColumn(option.column) || activeColumnIds.includes(option.id))
    .map((option) => option.column)
  const estimatedScrollWidth = useMemo(() => {
    const columnWidth = activeColumns.reduce((total, column) => total + (getColumnWidth(column) ?? 168), 0)
    const selectionWidth = rowSelection ? 56 : 0
    return Math.max(960, columnWidth + selectionWidth)
  }, [activeColumns, rowSelection])

  const getRowKeyValue = (record: any) => (typeof rowKey === 'function' ? rowKey(record) : record?.[rowKey])
  const activeRowSelection = rowSelection && typeof rowSelection === 'object' ? rowSelection : undefined
  const currentPageRows = !selectCurrentPageOnly || pagination === false
    ? dataSource
    : dataSource.slice((currentPage - 1) * currentPageSize, currentPage * currentPageSize)
  const pageSelectableRows = activeRowSelection
    ? currentPageRows.filter((record) => !activeRowSelection.getCheckboxProps?.(record)?.disabled)
    : []
  const pageSelectableKeys = pageSelectableRows.map((record) => getRowKeyValue(record))
  const selectedKeySet = new Set(activeRowSelection?.selectedRowKeys ?? [])
  const pageAllSelected = pageSelectableKeys.length > 0 && pageSelectableKeys.every((key) => selectedKeySet.has(key))
  const pageIndeterminate = pageSelectableKeys.some((key) => selectedKeySet.has(key)) && !pageAllSelected

  const resolvedRowSelection = selectCurrentPageOnly && activeRowSelection
    ? {
        ...activeRowSelection,
        columnTitle: currentPageSelectionLabel ? <span className="soha-admin-table-selection-label">{currentPageSelectionLabel}</span> : activeRowSelection.columnTitle,
        title: currentPageSelectionLabel ? <span className="soha-admin-table-selection-label">{currentPageSelectionLabel}</span> : undefined,
        getTitleCheckboxProps: () => ({
          checked: pageAllSelected,
          indeterminate: pageIndeterminate,
        }),
        onSelectAll: (selected: boolean) => {
          const selectedRowKeys = Array.isArray(activeRowSelection.selectedRowKeys) ? [...activeRowSelection.selectedRowKeys] : []
          const pageKeySet = new Set(pageSelectableKeys)
          const nextSelectedRowKeys = selected
            ? Array.from(new Set(selectedRowKeys.concat(pageSelectableKeys)))
            : selectedRowKeys.filter((key) => !pageKeySet.has(key))
          const nextSelectedKeySet = new Set(nextSelectedRowKeys)
          const nextSelectedRows = dataSource.filter((record) => nextSelectedKeySet.has(getRowKeyValue(record)))
          activeRowSelection.onChange?.(nextSelectedRowKeys, nextSelectedRows)
        },
      }
    : rowSelection

  const inheritedPagination = pagination && pagination !== false ? pagination : undefined
  const resolvedPagination = pagination === false
    ? false
    : {
        pageSize: currentPageSize,
        current: currentPage,
        size: 'small' as const,
        showLessItems: true,
        showSizeChanger: true,
        pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
        ...inheritedPagination,
        showTotal: paginationSummary
          ? (total: number, range: [number, number]) => (
              typeof paginationSummary === 'function'
                ? paginationSummary(total, range)
                : paginationSummary
            )
          : (inheritedPagination?.showTotal ??
            ((total: number, range: [number, number]) =>
              DEFAULT_PAGINATION_SUMMARY(localeCode, total, range))),
        onChange: (nextPage: number, nextPageSize: number) => {
          inheritedPagination?.onChange?.(nextPage, nextPageSize)
          if (nextPageSize !== currentPageSize) {
            setCurrentPage(nextPage)
            setCurrentPageSize(nextPageSize)
            inheritedPagination?.onPageSizeChange?.(nextPageSize)
            return
          }
          if (nextPage === currentPage) return
          setCurrentPage(nextPage)
          inheritedPagination?.onPageChange?.(nextPage)
        },
      }

  useLayoutEffect(() => {
    if (!viewportScroll) {
      setViewportScrollY(undefined)
      return
    }
    const shell = tableShellRef.current
    const content = shell?.closest<HTMLElement>('.soha-content')
    if (!shell || !content) return

    const updateScrollHeight = () => {
      if (
        window.innerWidth < VIEWPORT_SCROLL_MIN_WIDTH ||
        content.clientHeight < VIEWPORT_SCROLL_MIN_CONTAINER_HEIGHT
      ) {
        setViewportScrollY(undefined)
        return
      }
      const tableHeader = shell.querySelector<HTMLElement>('.ant-table-thead')
      if (!tableHeader) return
      const paginationElement = shell.querySelector<HTMLElement>('.ant-table-pagination')
      const contentRect = content.getBoundingClientRect()
      const headerRect = tableHeader.getBoundingClientRect()
      const paddingBottom = Number.parseFloat(window.getComputedStyle(content).paddingBottom) || 0
      const paginationHeight = paginationElement?.getBoundingClientRect().height ?? 0
      const headerBottom = headerRect.bottom - contentRect.top + content.scrollTop
      const availableHeight = Math.floor(
        content.clientHeight - headerBottom - paddingBottom - paginationHeight - 8,
      )
      const nextHeight =
        availableHeight >= VIEWPORT_SCROLL_MIN_BODY_HEIGHT ? availableHeight : undefined
      setViewportScrollY((current) => (current === nextHeight ? current : nextHeight))
    }

    updateScrollHeight()
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollHeight)
    resizeObserver?.observe(content)
    resizeObserver?.observe(shell)
    if (shell.parentElement) resizeObserver?.observe(shell.parentElement)
    window.addEventListener('resize', updateScrollHeight)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateScrollHeight)
    }
  }, [dataSource.length, viewportScroll])

  const resolvedScroll = useMemo(() => ({
    x: scroll?.x ?? estimatedScrollWidth,
    y: scroll?.y ?? viewportScrollY,
  }), [estimatedScrollWidth, scroll?.x, scroll?.y, viewportScrollY])

  const columnSetting = enableColumnSelection && columnSettingPlacement !== 'hidden' && selectableColumnOptions.length > 1 ? (
    <Popover
      trigger="click"
      placement="bottomRight"
      content={
        <div className="soha-admin-table-column-popover">
          <div className="soha-admin-table-column-actions">
            <Button size="small" type="text" onClick={() => setVisibleColumnIds(selectableColumnOptions.map((option) => option.id))}>
              {t('table.columns.selectAll', '全选')}
            </Button>
          </div>
          <Checkbox.Group
            className="soha-admin-table-column-options"
            options={selectableColumnOptions.map((option) => ({ label: option.label, value: option.id }))}
            value={activeColumnIds}
            onChange={(value) => {
              const next = value as string[]
              if (next.length === 0) return
              setVisibleColumnIds(next)
            }}
          />
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            {t('table.columns.sessionHint', '列设置仅影响当前页面会话。')}
          </Text>
        </div>
      }
    >
      <Button
        aria-label={t('table.columns.title', '列设置')}
        className={columnSettingIconOnly ? 'soha-admin-table-column-setting-button is-icon-only' : 'soha-admin-table-column-setting-button'}
        icon={<SettingOutlined />}
        size="small"
        title={t('table.columns.title', '列设置')}
        type={columnSettingIconOnly ? 'text' : 'default'}
      >
        {columnSettingIconOnly ? null : t('table.columns.title', '列设置')}
      </Button>
    </Popover>
  ) : null

  const toolbarColumnSetting = columnSettingPlacement === 'toolbar' ? columnSetting : null
  const headerColumnSetting = columnSettingPlacement === 'header' ? columnSetting : null
  const outsideColumnSetting = columnSettingPlacement === 'outside' ? columnSetting : null
  const resolvedHeaderExtra = headerExtra || headerColumnSetting ? (
    <>
      {headerExtra}
      {headerColumnSetting}
    </>
  ) : null
  const resolvedToolbarExtra = toolbarExtra || toolbarColumnSetting ? (
    <>
      {toolbarExtra}
      {toolbarColumnSetting}
    </>
  ) : null

  const hasHeader = Boolean(title || resolvedHeaderExtra)
  const hasToolbar = Boolean(toolbar || resolvedToolbarExtra)
  const resolvedShellClassName = [
    'soha-admin-table-shell',
    shellClassName,
    hasHeader || hasToolbar ? 'is-panel' : '',
    viewportScroll ? 'is-viewport-scroll' : '',
  ].filter(Boolean).join(' ')
  const resolvedTableClassName = ['soha-admin-table', className].filter(Boolean).join(' ')

  const tableShell = (
    <div ref={tableShellRef} className={resolvedShellClassName}>
      {hasHeader ? (
        <div className="soha-admin-table-header">
          <div className="soha-admin-table-header-main">{title}</div>
          {resolvedHeaderExtra ? <div className="soha-admin-table-header-extra">{resolvedHeaderExtra}</div> : null}
        </div>
      ) : null}
      {hasToolbar ? (
        <div className="soha-admin-table-toolbar">
          {toolbar ? <div className="soha-admin-table-toolbar-main">{toolbar}</div> : null}
          {resolvedToolbarExtra ? <div className="soha-admin-table-toolbar-extra">{resolvedToolbarExtra}</div> : null}
        </div>
      ) : null}
      <Table
        {...rest}
        className={resolvedTableClassName}
        columns={activeColumns}
        dataSource={dataSource}
        loading={loading}
        locale={{ emptyText: empty ?? <ManagementState bordered={false} compact /> }}
        pagination={resolvedPagination}
        rowKey={rowKey}
        rowSelection={resolvedRowSelection}
        scroll={resolvedScroll}
        size={tableSize}
      />
    </div>
  )

  if (outsideColumnSetting) {
    return (
      <div className="soha-admin-table-host">
        <div className="soha-admin-table-outside-toolbar">{outsideColumnSetting}</div>
        {tableShell}
      </div>
    )
  }

  return tableShell
}
