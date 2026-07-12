import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react'
import { Button, Popconfirm, Spin, Tooltip, Typography, message } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type MutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type { TableColumnsType } from 'antd'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementDensityButton,
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { hasAllowedAction } from '@/features/auth'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type { ResourceYAMLView, ScopeKey } from '@/types'
import { toClusterStorageScope, toStorageScope } from './scope'
import type { CreateStorageVariables, StorageTarget } from './types'
import '../styles.css'

const { Text } = Typography
const StorageCreateModal = lazy(() => import('./create-modal'))

function includesSearch(values: Array<string | undefined | null>, keyword: string) {
  if (!keyword) return true
  return values.some((value) => (value ?? '').toLowerCase().includes(keyword))
}

export function StorageListPage<T extends { allowedActions?: string[]; name: string }>({
  clusterScoped,
  columns,
  createDefaultTemplate,
  createOptions,
  emptyLabel,
  getRecordNamespace,
  kind,
  listQuery,
  removeOptions,
  resourceLabel,
  rowKey,
  searchPlaceholder,
  searchValues,
}: {
  clusterScoped: boolean
  columns: TableColumnsType<T>
  createDefaultTemplate: string
  createOptions: (
    queryClient: ReturnType<typeof useQueryClient>,
  ) => MutationOptions<ResourceYAMLView, Error, CreateStorageVariables>
  emptyLabel: { zh_CN: string; en_US: string }
  getRecordNamespace?: (record: T) => string
  kind: string
  listQuery: (scope: ScopeKey) => UseQueryOptions<T[], Error, T[], readonly unknown[]>
  removeOptions: (
    queryClient: ReturnType<typeof useQueryClient>,
  ) => MutationOptions<void, Error, StorageTarget>
  resourceLabel: string
  rowKey: string | ((record: T) => string)
  searchPlaceholder: { zh_CN: string; en_US: string }
  searchValues: (record: T) => Array<string | undefined | null>
}) {
  const { localeCode } = useI18n()
  const queryClient = useQueryClient()
  const { clusterId, namespace } = usePlatformScopeStore()
  const listScope = clusterScoped
    ? toClusterStorageScope(clusterId)
    : toStorageScope(clusterId, namespace)
  const createScope = clusterScoped ? listScope : toStorageScope(clusterId, namespace || 'default')
  const query = useQuery(listQuery(listScope))
  const removeMutation = useMutation(removeOptions(queryClient))
  const [createVisible, setCreateVisible] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const normalizedKeyword = useDeferredValue(searchKeyword).trim().toLowerCase()
  const rawItems = query.data ?? []
  const filteredItems = useMemo(
    () => rawItems.filter((item) => includesSearch(searchValues(item), normalizedKeyword)),
    [normalizedKeyword, rawItems, searchValues],
  )
  const deleteLabel = localeCode === 'zh_CN' ? '删除' : 'Delete'
  const actionColumn: TableColumnsType<T>[number] = {
    fixed: 'right',
    title: '',
    dataIndex: 'name',
    key: 'actions',
    width: 64,
    align: 'center',
    render: (name: string, record: T) => {
      if (!hasAllowedAction(record.allowedActions, 'delete')) return '-'
      const targetScope = clusterScoped
        ? toClusterStorageScope(clusterId)
        : toStorageScope(clusterId, getRecordNamespace?.(record))
      const pending =
        removeMutation.isPending &&
        removeMutation.variables?.name === name &&
        removeMutation.variables.scope.clusterId === targetScope.clusterId &&
        removeMutation.variables.scope.namespace === targetScope.namespace
      return (
        <Popconfirm
          title={localeCode === 'zh_CN' ? `确认删除 ${name}？` : `Delete ${name}?`}
          okText={deleteLabel}
          cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
          okButtonProps={{ danger: true, loading: pending }}
          placement="topRight"
          onConfirm={() =>
            removeMutation.mutate(
              { scope: targetScope, name },
              {
                onSuccess: () =>
                  void message.success(localeCode === 'zh_CN' ? '已删除' : 'Deleted'),
                onError: (error) => void message.error(error.message),
              },
            )
          }
        >
          <ManagementIconButton
            danger
            icon={<DeleteOutlined />}
            aria-label={deleteLabel}
            loading={pending}
            tooltip={deleteLabel}
          />
        </Popconfirm>
      )
    },
  }
  const effectiveColumns = [...columns, actionColumn]
  const effectiveEmpty = !clusterId
    ? localeCode === 'zh_CN'
      ? '请选择集群'
      : 'Select a cluster'
    : normalizedKeyword && rawItems.length > 0
      ? localeCode === 'zh_CN'
        ? `没有匹配的 ${resourceLabel}`
        : `No matching ${resourceLabel}`
      : emptyLabel[localeCode]
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'

  return (
    <ManagementDataPage
      beforeQuery={
        createVisible ? (
          <Suspense fallback={<Spin size="large" />}>
            <StorageCreateModal
              createOptions={createOptions}
              defaultTemplate={createDefaultTemplate}
              kind={kind}
              onClose={() => setCreateVisible(false)}
              scope={createScope}
            />
          </Suspense>
        ) : null
      }
      query={{
        onFinish: () => undefined,
        actions: (
          <ManagementQueryActions
            disabledReset={!searchKeyword.trim()}
            onReset={() => setSearchKeyword('')}
            resetLabel={localeCode === 'zh_CN' ? '重置' : 'Reset'}
            submitLabel={localeCode === 'zh_CN' ? '查询' : 'Search'}
          />
        ),
        children: (
          <ManagementKeywordField
            label={localeCode === 'zh_CN' ? '关键词' : 'Keyword'}
            value={searchKeyword}
            onChange={setSearchKeyword}
            placeholder={searchPlaceholder[localeCode]}
            inputProps={{
              className: 'soha-platform-compact-field soha-workload-search-input',
              size: 'small',
            }}
          />
        ),
      }}
      table={{
        className: 'soha-platform-table soha-storage-table',
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        columns: effectiveColumns,
        dataSource: clusterId ? filteredItems : [],
        rowKey,
        loading: query.isLoading,
        paginationSummary: (
          <Text className="soha-workload-table-summary" type="secondary">
            {localeCode === 'zh_CN'
              ? `当前 ${filteredItems.length} / ${rawItems.length} 条`
              : `${filteredItems.length} / ${rawItems.length} items`}
          </Text>
        ),
        tableSize,
        scroll: { x: 'max-content' },
        headerExtra: (
          <ManagementTableToolbar>
            <Tooltip
              title={
                !clusterId
                  ? localeCode === 'zh_CN'
                    ? '请先选择集群。'
                    : 'Select a cluster first.'
                  : ''
              }
            >
              <span>
                <Button
                  autoInsertSpace={false}
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!clusterId}
                  onClick={() => setCreateVisible(true)}
                >
                  {localeCode === 'zh_CN' ? '新增' : 'Create'}
                </Button>
              </span>
            </Tooltip>
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
              onClick={() => clusterId && void query.refetch()}
            />
          </ManagementTableToolbar>
        ),
        empty: (
          <ManagementState
            bordered={false}
            compact
            description={effectiveEmpty}
            kind={clusterId ? 'empty' : 'select-scope'}
          />
        ),
      }}
    />
  )
}
