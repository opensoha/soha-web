import { useDeferredValue, useMemo, useState } from 'react'
import { App, Popconfirm, Space } from 'antd'
import { DeleteOutlined, FormOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementDataPage } from '@/components/management-data-page'
import { TableCellLink } from '@/components/table-cell-content'
import {
  ManagementDensityButton,
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { TABLE_ACTIONS_COLUMN_CLASS_NAME } from '@/components/resource-actions'
import { hasAllowedAction } from '@/features/auth'
import { CreateEntry } from '@/features/platform/resource-creation/components/create-entry'
import { K8S_TABLE_PAGE_SIZE } from '@/features/platform/shared/table-config'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'
import type { TableColumnsType } from 'antd'
import { configurationMutations } from './mutations'
import { configurationQueries } from './queries'
import { configurationTargetFromRecord } from './scope'
import type {
  ConfigurationKind,
  ConfigurationResourceRecord,
  ConfigurationScopeMode,
} from './types'
import '../styles.css'

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase()
}

function matchesKeyword(record: ConfigurationResourceRecord, keyword: string) {
  if (!keyword) return true
  return [record.name, record.namespace ?? ''].some((value) =>
    value.toLowerCase().includes(keyword),
  )
}

export function ConfigurationNameLink({
  kind,
  name,
  namespace,
}: {
  kind: ConfigurationKind
  name: string
  namespace?: string
}) {
  const navigate = useNavigate()
  const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''
  return (
    <TableCellLink
      label={name}
      onClick={() => navigate(`/configuration/${kind}/${encodeURIComponent(name)}${query}`)}
    />
  )
}

export function ConfigurationResourceListPage<T extends ConfigurationResourceRecord>({
  columns,
  defaultTemplate,
  emptyDescription,
  kind,
  label,
  onEdit,
  scopeMode = 'namespace',
  singularLabel,
}: {
  columns: TableColumnsType<T>
  defaultTemplate?: string
  emptyDescription: { en_US: string; zh_CN: string }
  kind: ConfigurationKind
  label: string
  onEdit?: (record: T) => void
  scopeMode?: ConfigurationScopeMode
  singularLabel?: string
}) {
  const { localeCode } = useI18n()
  const { message } = App.useApp()
  const { clusterId, namespace } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const deferredSearchKeyword = useDeferredValue(searchKeyword)
  const scope = toScopeKey(clusterId, scopeMode === 'namespace' ? namespace : null)
  const query = useQuery(configurationQueries.list<T>(kind, scope))
  const removeMutation = useMutation(configurationMutations.remove(kind, queryClient))
  const rawItems = query.data ?? []
  const normalizedKeyword = normalizeKeyword(deferredSearchKeyword)
  const filteredItems = useMemo(
    () => rawItems.filter((item) => matchesKeyword(item, normalizedKeyword)),
    [normalizedKeyword, rawItems],
  )
  const effectiveEmptyDescription = !clusterId
    ? localeCode === 'zh_CN'
      ? '请选择集群'
      : 'Select a cluster'
    : normalizedKeyword && rawItems.length > 0
      ? localeCode === 'zh_CN'
        ? `没有匹配的 ${label}`
        : `No matching ${label}`
      : emptyDescription[localeCode]
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'
  const canCreate = Boolean(defaultTemplate && singularLabel)
  const canShowActions = rawItems.some(
    (item) =>
      hasAllowedAction(item.allowedActions, 'delete') ||
      Boolean(onEdit && hasAllowedAction(item.allowedActions, 'update')),
  )
  const searchDimensions = scopeMode === 'namespace' ? '名称 / 命名空间' : '名称'
  const englishSearchDimensions = scopeMode === 'namespace' ? 'name / namespace' : 'name'

  const actionColumn: TableColumnsType<T>[number] = {
    title: '',
    dataIndex: '__actions',
    fixed: 'right',
    align: 'center',
    width: onEdit ? 84 : 52,
    onHeaderCell: () => ({ className: TABLE_ACTIONS_COLUMN_CLASS_NAME }),
    onCell: () => ({ className: TABLE_ACTIONS_COLUMN_CLASS_NAME }),
    render: (_value, record) => {
      const canEdit = Boolean(onEdit && hasAllowedAction(record.allowedActions, 'update'))
      const canDelete = hasAllowedAction(record.allowedActions, 'delete')
      if (!canEdit && !canDelete) return null
      const target = configurationTargetFromRecord(clusterId, record)
      const deleting =
        removeMutation.isPending &&
        removeMutation.variables?.name === target.name &&
        removeMutation.variables.scope.namespace === target.scope.namespace
      const deleteLabel = localeCode === 'zh_CN' ? '删除' : 'Delete'
      return (
        <Space size={2} className="soha-row-action-icons">
          {canEdit ? (
            <ManagementIconButton
              aria-label={`${localeCode === 'zh_CN' ? '编辑' : 'Edit'} ${record.name}`}
              icon={<FormOutlined />}
              onClick={() => onEdit?.(record)}
              tooltip={localeCode === 'zh_CN' ? '编辑' : 'Edit'}
            />
          ) : null}
          {canDelete ? (
            <Popconfirm
              title={
                localeCode === 'zh_CN' ? `确认删除 ${record.name}？` : `Delete ${record.name}?`
              }
              description={
                localeCode === 'zh_CN'
                  ? '此操作不可恢复，删除后集群资源立即消失。'
                  : 'This deletes the resource immediately and cannot be undone.'
              }
              okText={deleteLabel}
              cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
              okButtonProps={{ danger: true, loading: deleting }}
              placement="topRight"
              onConfirm={() =>
                removeMutation.mutate(target, {
                  onSuccess: () =>
                    void message.success(localeCode === 'zh_CN' ? '已删除' : 'Deleted'),
                  onError: (error) => void message.error(error.message),
                })
              }
            >
              <ManagementIconButton
                danger
                icon={<DeleteOutlined />}
                aria-label={deleteLabel}
                loading={deleting}
                tooltip={deleteLabel}
              />
            </Popconfirm>
          ) : null}
        </Space>
      )
    },
  }

  return (
    <ManagementDataPage
      query={{
        onFinish: () => undefined,
        actions: (
          <ManagementQueryActions
            disabledReset={!searchKeyword.trim()}
            resetLabel={localeCode === 'zh_CN' ? '重置' : 'Reset'}
            submitLabel={localeCode === 'zh_CN' ? '查询' : 'Search'}
            onReset={() => setSearchKeyword('')}
          />
        ),
        children: (
          <ManagementKeywordField
            label={localeCode === 'zh_CN' ? '关键词' : 'Keyword'}
            value={searchKeyword}
            onChange={setSearchKeyword}
            placeholder={
              localeCode === 'zh_CN'
                ? `搜索 ${label} ${searchDimensions}`
                : `Search ${label} ${englishSearchDimensions}`
            }
            inputProps={{
              className: 'soha-platform-compact-field soha-workload-search-input',
              size: 'small',
            }}
          />
        ),
      }}
      table={{
        className: 'soha-platform-table',
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        headerExtra: (
          <ManagementTableToolbar>
            {canCreate ? (
              <CreateEntry
                context={{
                  clusterId: clusterId || '',
                  defaultNamespace: scopeMode === 'namespace' ? namespace || undefined : undefined,
                  expectedKind: singularLabel,
                  resourceGroup: 'configuration',
                  scopeMode,
                  source: 'list',
                }}
                defaultTemplate={defaultTemplate || ''}
                label={singularLabel || label}
              />
            ) : null}
            <ManagementDensityButton
              aria-label={densityLabel}
              title={densityLabel}
              tooltip={densityLabel}
              onClick={() => setTableSize((current) => (current === 'middle' ? 'small' : 'middle'))}
            />
            <ManagementRefreshButton
              aria-label={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              disabled={!clusterId}
              loading={query.isFetching}
              tooltip={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              onClick={() => {
                if (clusterId) void query.refetch()
              }}
            />
          </ManagementTableToolbar>
        ),
        columns: canShowActions ? [...columns, actionColumn] : columns,
        dataSource: clusterId ? filteredItems : [],
        rowKey: (record) => `${record.namespace ?? ''}/${record.name}`,
        loading: query.isLoading,
        localSorting: true,
        empty: (
          <ManagementState
            bordered={false}
            compact
            description={effectiveEmptyDescription}
            kind={!clusterId ? 'select-scope' : 'empty'}
          />
        ),
        pageSize: K8S_TABLE_PAGE_SIZE,
        tableSize,
        scroll: { x: 'max-content' },
        viewportScroll: true,
      }}
    />
  )
}
