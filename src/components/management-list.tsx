import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Alert, Button, Card, Empty, Form, Input, Segmented, Space, Spin, Tooltip, Typography } from 'antd'
import type { AlertProps, ButtonProps, FormProps } from 'antd'
import { ColumnHeightOutlined, DownOutlined, ReloadOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons'
import './management-list.css'

const { Text } = Typography

interface ManagementQueryPanelProps extends Pick<FormProps, 'form' | 'initialValues' | 'onFinish'> {
  actions: ReactNode
  children: ReactNode
  collapsible?: boolean
  defaultExpanded?: boolean
  expanded?: boolean
  lessLabel?: ReactNode
  moreLabel?: ReactNode
  onExpandedChange?: (expanded: boolean) => void
}

interface ManagementQueryGridProps {
  actions: ReactNode
  children: ReactNode
  collapsible?: boolean
  defaultExpanded?: boolean
  expanded?: boolean
  lessLabel?: ReactNode
  moreLabel?: ReactNode
  onExpandedChange?: (expanded: boolean) => void
}

interface ManagementTableToolbarProps {
  batchBar?: ReactNode
  children?: ReactNode
}

interface ManagementBatchBarProps {
  children: ReactNode
  selectedCount: number
  selectedLabel?: ReactNode
}

interface ManagementIconButtonProps extends Omit<ButtonProps, 'children' | 'type'> {
  tooltip: ReactNode
}

interface ManagementQueryFieldProps extends React.ComponentProps<typeof Form.Item> {
  grow?: boolean
  minWidth?: number | string
  width?: number | string
}

interface ManagementQueryScopeProps extends Omit<React.ComponentProps<typeof Segmented>, 'block' | 'label' | 'size'> {
  label?: ReactNode
}

interface ManagementKeywordFieldProps extends Omit<ManagementQueryFieldProps, 'children'> {
  inputProps?: React.ComponentProps<typeof Input>
  onChange?: (value: string) => void
  placeholder?: string
  value?: string
}

interface ManagementQueryActionsProps {
  disabledReset?: boolean
  loading?: boolean
  onReset?: () => void
  resetLabel?: ReactNode
  submitLabel?: ReactNode
}

interface ManagementToolbarSearchProps extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'size' | 'style' | 'value'> {
  size?: 'sm' | 'md' | 'lg' | number
  style?: CSSProperties
  value: string
  onChange: (value: string) => void
}

interface ManagementSearchableListPaneProps<T> {
  activeKey?: string
  className?: string
  emptyDescription?: ReactNode
  emptyTitle?: ReactNode
  getItemKey: (item: T) => string
  isLoading?: boolean
  itemClassName?: string
  items: T[]
  onItemSelect: (item: T) => void
  onSearchChange: (value: string) => void
  renderItem: (item: T, state: { active: boolean }) => ReactNode
  searchPlaceholder?: string
  searchValue: string
}

interface TemplateDesignerShellProps {
  children?: ReactNode
  className?: string
  designer: ReactNode
  designerClassName?: string
  list: ReactNode
  toolbar: ReactNode
  toolbarClassName?: string
  workspaceClassName?: string
}

interface ManagementDetailHeaderProps {
  actions?: ReactNode
  className?: string
  description?: ReactNode
  meta?: ReactNode
  title: ReactNode
}

type ManagementStateKind =
  | 'empty'
  | 'error'
  | 'loading'
  | 'no-permission'
  | 'not-configured'
  | 'not-found'
  | 'select-scope'
  | 'unsupported'

interface ManagementStateProps {
  actions?: ReactNode
  bordered?: boolean
  className?: string
  compact?: boolean
  description?: ReactNode
  kind?: ManagementStateKind
  title?: ReactNode
}

const managementStatePresets: Record<ManagementStateKind, { description: ReactNode; title: ReactNode; type: AlertProps['type'] }> = {
  empty: {
    title: '暂无数据',
    description: '当前筛选条件下没有可展示的记录。',
    type: 'info',
  },
  error: {
    title: '加载失败',
    description: '请求失败，请稍后重试。',
    type: 'error',
  },
  loading: {
    title: '正在加载',
    description: '正在读取最新数据。',
    type: 'info',
  },
  'no-permission': {
    title: '无访问权限',
    description: '当前账号没有访问此页面的权限。',
    type: 'warning',
  },
  'not-configured': {
    title: '尚未配置',
    description: '完成必要配置后这里会显示运行数据。',
    type: 'info',
  },
  'not-found': {
    title: '未找到资源',
    description: '目标资源不存在或已不可用。',
    type: 'warning',
  },
  'select-scope': {
    title: '请选择作用域',
    description: '选择集群或命名空间后查看数据。',
    type: 'info',
  },
  unsupported: {
    title: '暂不支持',
    description: '当前运行模式暂不支持该能力。',
    type: 'warning',
  },
}

function classNames(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(' ')
}

function formatQueryFieldSize(value?: number | string) {
  if (typeof value === 'number') return `${value}px`
  return value
}

function normalizeFilterText(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function recordMatchesFilter(values: unknown[], filterText: string) {
  const keyword = normalizeFilterText(filterText)
  if (!keyword) return true
  return values.some((value) => normalizeFilterText(value).includes(keyword))
}

export function ManagementQueryPanel({
  actions,
  children,
  collapsible = true,
  defaultExpanded = false,
  expanded,
  lessLabel,
  moreLabel,
  onExpandedChange,
  onFinish,
  ...formProps
}: ManagementQueryPanelProps) {
  return (
    <Card className="soha-management-query-card" variant="outlined">
      <Form {...formProps} className="soha-management-query-form" layout="horizontal" onFinish={onFinish}>
        <ManagementQueryGrid
          actions={actions}
          collapsible={collapsible}
          defaultExpanded={defaultExpanded}
          expanded={expanded}
          lessLabel={lessLabel}
          moreLabel={moreLabel}
          onExpandedChange={onExpandedChange}
        >
          {children}
        </ManagementQueryGrid>
      </Form>
    </Card>
  )
}

export function ManagementQueryGrid({
  actions,
  children,
  collapsible = true,
  defaultExpanded = false,
  expanded,
  lessLabel = '收起',
  moreLabel = '更多',
  onExpandedChange,
}: ManagementQueryGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const fieldsRef = useRef<HTMLDivElement | null>(null)
  const actionsRef = useRef<HTMLDivElement | null>(null)
  const isControlled = typeof expanded === 'boolean'
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const [canExpand, setCanExpand] = useState(false)
  const [stackActions, setStackActions] = useState(false)
  const activeExpanded = isControlled ? Boolean(expanded) : internalExpanded

  useLayoutEffect(() => {
    const grid = gridRef.current
    const fields = fieldsRef.current
    const actionBar = actionsRef.current
    if (!grid || !fields || !actionBar) return undefined

    const setFieldVisibility = (fieldItems: HTMLElement[], nextCanExpand: boolean, nextExpanded: boolean) => {
      const shouldHideOverflowFields = nextCanExpand && !nextExpanded
      const visibleRowTop = fieldItems[0]?.offsetTop ?? 0
      fieldItems.forEach((field) => {
        const isOverflowHidden = shouldHideOverflowFields && field.offsetTop > visibleRowTop + 1
        field.toggleAttribute('aria-hidden', isOverflowHidden)
        field.toggleAttribute('inert', isOverflowHidden)
        field.style.visibility = isOverflowHidden ? 'hidden' : ''
        field.style.pointerEvents = isOverflowHidden ? 'none' : ''
      })
    }

    const measureNow = () => {
      const fieldItems = Array.from(fields.querySelectorAll<HTMLElement>('.soha-management-query-field'))
      const gridWidth = grid.getBoundingClientRect().width
      const gridColumnGap = Number.parseFloat(window.getComputedStyle(grid).columnGap) || 0
      const fieldColumnGap = Number.parseFloat(window.getComputedStyle(fields).columnGap) || 0
      const actionColumnGap = Number.parseFloat(window.getComputedStyle(actionBar).columnGap) || 0
      const firstTwoFields = fieldItems.slice(0, 2)
      const firstTwoFieldsWidth = firstTwoFields.reduce((sum, field) => sum + field.getBoundingClientRect().width, 0)
        + (firstTwoFields.length > 1 ? fieldColumnGap : 0)
      const allFieldsWidth = fieldItems.reduce((sum, field) => sum + field.getBoundingClientRect().width, 0)
        + (fieldItems.length > 1 ? fieldColumnGap * (fieldItems.length - 1) : 0)
      const actionItems = Array.from(actionBar.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
      const baseActionItems = actionItems.filter((item) => !item.classList.contains('soha-management-query-more-button'))
      const baseActionWidth = baseActionItems.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0)
        + (baseActionItems.length > 1 ? actionColumnGap * (baseActionItems.length - 1) : 0)
      const toggleButtonWidth = actionItems.find((item) => item.classList.contains('soha-management-query-more-button'))?.getBoundingClientRect().width ?? 64
      const baseSideBySideFieldWidth = gridWidth - baseActionWidth - gridColumnGap
      const shouldStackWithoutToggle = firstTwoFields.length > 1 && baseSideBySideFieldWidth < firstTwoFieldsWidth
      const availableWithoutToggle = shouldStackWithoutToggle ? gridWidth : baseSideBySideFieldWidth
      const needsToggle = allFieldsWidth > availableWithoutToggle
      const finalActionWidth = baseActionWidth + (needsToggle && baseActionItems.length > 0 ? actionColumnGap + toggleButtonWidth : 0)
      const finalSideBySideFieldWidth = gridWidth - finalActionWidth - gridColumnGap
      const nextStackActions = firstTwoFields.length > 1 && finalSideBySideFieldWidth < firstTwoFieldsWidth
      const finalAvailableFieldWidth = nextStackActions ? gridWidth : finalSideBySideFieldWidth
      const nextCanExpand = collapsible && allFieldsWidth > finalAvailableFieldWidth

      setCanExpand((current) => (current === nextCanExpand ? current : nextCanExpand))
      setStackActions((current) => (current === nextStackActions ? current : nextStackActions))
      setFieldVisibility(fieldItems, nextCanExpand, activeExpanded)

      if (!nextCanExpand && collapsible) {
        const wasExpanded = (isControlled && expanded) || (!isControlled && internalExpanded)
        if (!isControlled && internalExpanded) setInternalExpanded(false)
        if (wasExpanded) onExpandedChange?.(false)
      }
    }

    const measure = () => {
      measureNow()
    }

    measure()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure)
      observer.observe(grid)
      observer.observe(fields)
      observer.observe(actionBar)
      Array.from(fields.children).forEach((child) => observer.observe(child))
      Array.from(actionBar.children).forEach((child) => observer.observe(child))
      return () => {
        observer.disconnect()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure)
      return () => {
        window.removeEventListener('resize', measure)
      }
    }

    return undefined
  }, [children, collapsible, expanded, internalExpanded, isControlled, onExpandedChange, activeExpanded])

  const updateExpanded = (nextExpanded: boolean) => {
    if (!isControlled) {
      setInternalExpanded(nextExpanded)
    }
    onExpandedChange?.(nextExpanded)
  }

  useLayoutEffect(() => {
    const fields = fieldsRef.current
    if (!fields) return undefined
    const fieldItems = Array.from(fields.querySelectorAll<HTMLElement>('.soha-management-query-field'))
    const shouldHideOverflowFields = canExpand && !activeExpanded
    const visibleRowTop = fieldItems[0]?.offsetTop ?? 0
    fieldItems.forEach((field) => {
      const isOverflowHidden = shouldHideOverflowFields && field.offsetTop > visibleRowTop + 1
      field.toggleAttribute('aria-hidden', isOverflowHidden)
      field.toggleAttribute('inert', isOverflowHidden)
      field.style.visibility = isOverflowHidden ? 'hidden' : ''
      field.style.pointerEvents = isOverflowHidden ? 'none' : ''
    })
    return undefined
  }, [activeExpanded, canExpand])

  const toggleButton = collapsible && canExpand ? (
    <Button
      aria-expanded={activeExpanded}
      autoInsertSpace={false}
      className="soha-management-query-more-button"
      htmlType="button"
      icon={activeExpanded ? <UpOutlined /> : <DownOutlined />}
      iconPlacement="end"
      size="small"
      onClick={() => updateExpanded(!activeExpanded)}
    >
      {activeExpanded ? lessLabel : moreLabel}
    </Button>
  ) : null

  return (
    <div
      ref={gridRef}
      className={classNames(
        'soha-management-query-grid',
        activeExpanded ? 'is-expanded' : 'is-collapsed',
        collapsible && canExpand && 'is-collapsible',
        stackActions && 'is-actions-stacked',
      )}
    >
      <div ref={fieldsRef} className="soha-management-query-fields">{children}</div>
      <div ref={actionsRef} className="soha-management-query-actions">
        {actions}
        {toggleButton}
      </div>
    </div>
  )
}

export function ManagementQueryField({ grow = false, minWidth, style, width, ...props }: ManagementQueryFieldProps) {
  const fieldStyle = {
    ...style,
    ...(width ? { '--soha-management-query-field-width': formatQueryFieldSize(width) } : {}),
    ...(minWidth ? { '--soha-management-query-field-min-width': formatQueryFieldSize(minWidth) } : {}),
  } as CSSProperties

  return (
    <Form.Item
      {...props}
      className={classNames('soha-management-query-field', grow && 'is-fluid', props.className)}
      style={fieldStyle}
    />
  )
}

export function ManagementQueryScope({ label = '范围', ...props }: ManagementQueryScopeProps) {
  return (
    <ManagementQueryField className="soha-management-query-scope" label={label}>
      <Segmented {...props} size="small" />
    </ManagementQueryField>
  )
}

export function ManagementKeywordField({
  grow = false,
  inputProps,
  label = '关键词',
  minWidth = 300,
  name,
  onChange,
  placeholder,
  value,
  width = 300,
  ...props
}: ManagementKeywordFieldProps) {
  const isControlledSearch = value !== undefined || Boolean(onChange)
  const resolvedName = name ?? (isControlledSearch ? undefined : 'search')
  const handleChange = onChange
    ? (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)
    : inputProps?.onChange

  return (
    <ManagementQueryField
      {...props}
      grow={grow}
      label={label}
      minWidth={minWidth}
      name={resolvedName}
      width={width}
    >
      <Input
        {...inputProps}
        allowClear={inputProps?.allowClear ?? true}
        prefix={inputProps?.prefix ?? <SearchOutlined />}
        placeholder={placeholder ?? inputProps?.placeholder}
        value={value ?? inputProps?.value}
        onChange={handleChange}
      />
    </ManagementQueryField>
  )
}

export function ManagementQueryActions({
  disabledReset = false,
  loading = false,
  onReset,
  resetLabel = '重置',
  submitLabel = '查询',
}: ManagementQueryActionsProps) {
  return (
    <>
      <Button
        autoInsertSpace={false}
        disabled={disabledReset}
        htmlType="button"
        onClick={onReset}
      >
        {resetLabel}
      </Button>
      <Button
        autoInsertSpace={false}
        htmlType="submit"
        loading={loading}
        type="primary"
      >
        {submitLabel}
      </Button>
    </>
  )
}

export function ManagementToolbarSearch({
  allowClear = true,
  onChange,
  placeholder,
  size = 'md',
  style,
  value,
  ...inputProps
}: ManagementToolbarSearchProps) {
  const width = typeof size === 'number' ? `${size}px` : 'var(--soha-management-toolbar-search-width, 320px)'
  return (
    <Input
      {...inputProps}
      allowClear={allowClear}
      className={classNames('soha-management-toolbar-search', inputProps.className)}
      placeholder={placeholder}
      prefix={inputProps.prefix ?? <SearchOutlined />}
      size="small"
      style={{ width, maxWidth: '100%', ...style }}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function useManagementTextFilter<T>(
  items: T[],
  filterText: string,
  getValues: (item: T) => unknown[],
) {
  return useMemo(
    () => items.filter((item) => recordMatchesFilter(getValues(item), filterText)),
    [filterText, getValues, items],
  )
}

export function ManagementSearchableListPane<T>({
  activeKey,
  className,
  emptyDescription,
  emptyTitle = '暂无数据',
  getItemKey,
  isLoading = false,
  itemClassName,
  items,
  onItemSelect,
  onSearchChange,
  renderItem,
  searchPlaceholder = '搜索',
  searchValue,
}: ManagementSearchableListPaneProps<T>) {
  return (
    <aside className={classNames('soha-management-searchable-list-pane', className)}>
      <Input
        allowClear
        className="soha-management-searchable-list-pane__search"
        prefix={<SearchOutlined />}
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div className="soha-management-searchable-list-pane__items">
        {isLoading ? <ManagementState bordered={false} compact kind="loading" title="正在加载" /> : null}
        {!isLoading && items.length === 0 ? (
          <ManagementState
            bordered={false}
            compact
            description={emptyDescription}
            kind="empty"
            title={emptyTitle}
          />
        ) : null}
        {!isLoading
          ? items.map((item) => {
            const itemKey = getItemKey(item)
            const active = itemKey === activeKey
            return (
              <div
                className={classNames('soha-management-searchable-list-pane__item', itemClassName, active && 'is-active')}
                key={itemKey}
                role="button"
                tabIndex={0}
                onClick={() => onItemSelect(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onItemSelect(item)
                  }
                }}
              >
                {renderItem(item, { active })}
              </div>
            )
          })
          : null}
      </div>
    </aside>
  )
}

export function TemplateDesignerShell({
  children,
  className,
  designer,
  designerClassName,
  list,
  toolbar,
  toolbarClassName,
  workspaceClassName,
}: TemplateDesignerShellProps) {
  return (
    <div className={classNames('soha-template-designer-shell', className)}>
      <div className={classNames('soha-template-designer-shell__toolbar', toolbarClassName)}>
        {toolbar}
      </div>
      {children}
      <div className={classNames('soha-template-designer-shell__workspace', workspaceClassName)}>
        {list}
        <main className={classNames('soha-template-designer-shell__designer', designerClassName)}>
          {designer}
        </main>
      </div>
    </div>
  )
}

export function ManagementTableToolbar({ batchBar, children }: ManagementTableToolbarProps) {
  return (
    <Space wrap size={8} className="soha-management-table-toolbar-actions">
      {batchBar}
      {children}
    </Space>
  )
}

export function ManagementBatchBar({ children, selectedCount, selectedLabel }: ManagementBatchBarProps) {
  return (
    <div className="soha-management-batchbar">
      <Text type="secondary">{selectedLabel ?? `已选 ${selectedCount} 项`}</Text>
      {children}
    </div>
  )
}

export const ManagementIconButton = forwardRef<HTMLButtonElement, ManagementIconButtonProps>(function ManagementIconButton(
  { tooltip, ...buttonProps },
  ref,
) {
  const nativeTitle = typeof tooltip === 'string' ? tooltip : undefined
  return (
    <Tooltip title={tooltip}>
      <Button
        {...buttonProps}
        ref={ref}
        className={classNames('soha-management-icon-action', buttonProps.className)}
        title={buttonProps.title ?? nativeTitle}
        type="text"
      />
    </Tooltip>
  )
})

export function ManagementRefreshButton({ tooltip, ...buttonProps }: ManagementIconButtonProps) {
  return <ManagementIconButton {...buttonProps} icon={buttonProps.icon ?? <ReloadOutlined />} tooltip={tooltip} />
}

export function ManagementDensityButton({ tooltip, ...buttonProps }: ManagementIconButtonProps) {
  return <ManagementIconButton {...buttonProps} icon={buttonProps.icon ?? <ColumnHeightOutlined />} tooltip={tooltip} />
}

export function ManagementState({
  actions,
  bordered = true,
  className,
  compact = false,
  description,
  kind = 'empty',
  title,
}: ManagementStateProps) {
  const preset = managementStatePresets[kind]
  const resolvedTitle = title ?? preset.title
  const resolvedDescription = description ?? preset.description
  const stateClassName = classNames(
    'soha-management-state',
    `is-${kind}`,
    compact && 'is-compact',
    !bordered && 'is-borderless',
    className,
  )

  if (kind === 'loading') {
    return (
      <div className={stateClassName}>
        <Spin size="small" />
        <Space orientation="vertical" size={2} className="soha-management-state-loading-copy">
          <Text strong>{resolvedTitle}</Text>
          <Text type="secondary">{resolvedDescription}</Text>
        </Space>
      </div>
    )
  }

  if (kind === 'empty') {
    const emptyDescription = resolvedDescription ? (
      <Space orientation="vertical" size={2} className="soha-management-state-empty-copy">
        <Text strong>{resolvedTitle}</Text>
        <Text type="secondary">{resolvedDescription}</Text>
      </Space>
    ) : resolvedTitle

    return (
      <div className={stateClassName}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription}>
          {actions}
        </Empty>
      </div>
    )
  }

  return (
    <div className={stateClassName}>
      <Alert
        action={actions}
        description={resolvedDescription}
        showIcon
        title={resolvedTitle}
        type={preset.type}
      />
    </div>
  )
}

export function ManagementDetailHeader({ actions, className, description, meta, title }: ManagementDetailHeaderProps) {
  return (
    <div className={classNames('soha-management-detail-header', className)}>
      <div className="soha-management-detail-header-main">
        <Text strong className="soha-management-detail-header-title">{title}</Text>
        {description ? <Text type="secondary" className="soha-management-detail-header-description">{description}</Text> : null}
        {meta ? <div className="soha-management-detail-header-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="soha-management-detail-header-actions">{actions}</div> : null}
    </div>
  )
}
