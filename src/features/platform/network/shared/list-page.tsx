import { useDeferredValue, useMemo, useState } from 'react'
import { DeleteOutlined } from '@ant-design/icons'
import { Popconfirm, Typography, message } from 'antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
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
import { TABLE_ACTIONS_COLUMN_CLASS_NAME } from '@/components/resource-actions'
import { hasAllowedAction } from '@/features/auth'
import { useAIPageContext } from '@/features/copilot'
import type { AIPageContext } from '@/features/copilot'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type { TableColumnsType } from 'antd'
import { networkMutations } from './mutations'
import { networkTargetFromRecord } from './scope'
import type { NetworkKind, NetworkResourceRecord } from './types'
import '../styles.css'

const { Text } = Typography

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase()
}

function buildErrorDescription(localeCode: 'zh_CN' | 'en_US', error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return localeCode === 'zh_CN'
      ? `网络资源请求失败：${error.message}`
      : `Failed to load network resources: ${error.message}`
  }
  return localeCode === 'zh_CN' ? '网络资源请求失败。' : 'Failed to load network resources.'
}

export function NetworkResourceListPage<T extends NetworkResourceRecord>({
  buildAIPageContext,
  columns,
  deletable = true,
  emptyDescription,
  kind,
  noMatchDescription,
  onRow,
  query,
  rowKey,
  searchPlaceholder,
  searchValues,
}: {
  buildAIPageContext: (items: T[], searchKeyword: string) => AIPageContext
  columns: TableColumnsType<T>
  deletable?: boolean
  emptyDescription: { en_US: string; zh_CN: string }
  kind: NetworkKind
  noMatchDescription: { en_US: string; zh_CN: string }
  onRow?: (record: T) => Record<string, string>
  query: UseQueryResult<T[], Error>
  rowKey?: string | ((record: T) => string)
  searchPlaceholder: { en_US: string; zh_CN: string }
  searchValues: (record: T) => Array<string | undefined | null>
}) {
  const { localeCode } = useI18n()
  const { clusterId } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const deferredSearchKeyword = useDeferredValue(searchKeyword)
  const normalizedKeyword = normalizeKeyword(deferredSearchKeyword)
  const rawItems = query.data ?? []
  const filteredItems = useMemo(
    () =>
      rawItems.filter((record) =>
        searchValues(record).some((value) =>
          (value ?? '').toLowerCase().includes(normalizedKeyword),
        ),
      ),
    [normalizedKeyword, rawItems, searchValues],
  )
  useAIPageContext(buildAIPageContext(rawItems, searchKeyword))
  const removeMutation = useMutation(networkMutations.remove(kind, queryClient))
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'
  const effectiveEmpty = !clusterId
    ? localeCode === 'zh_CN'
      ? '请选择集群'
      : 'Select a cluster'
    : normalizedKeyword && rawItems.length > 0
      ? noMatchDescription[localeCode]
      : emptyDescription[localeCode]

  const actionColumn: TableColumnsType<T>[number] = {
    title: '',
    dataIndex: '__actions',
    fixed: 'right',
    align: 'center',
    width: 52,
    onHeaderCell: () => ({ className: TABLE_ACTIONS_COLUMN_CLASS_NAME }),
    onCell: () => ({ className: TABLE_ACTIONS_COLUMN_CLASS_NAME }),
    render: (_value, record) => {
      if (!hasAllowedAction(record.allowedActions, 'delete')) return null
      const target = networkTargetFromRecord(clusterId, record)
      const deleting =
        removeMutation.isPending &&
        removeMutation.variables?.name === target.name &&
        removeMutation.variables.scope.namespace === target.scope.namespace
      const deleteLabel = localeCode === 'zh_CN' ? '删除' : 'Delete'
      return (
        <Popconfirm
          title={localeCode === 'zh_CN' ? `确认删除 ${record.name}？` : `Delete ${record.name}?`}
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
              onSuccess: () => void message.success(localeCode === 'zh_CN' ? '已删除' : 'Deleted'),
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
      )
    },
  }

  return (
    <ManagementDataPage
      beforeQuery={
        query.isError ? (
          <ManagementState
            className="mb-3"
            description={buildErrorDescription(localeCode, query.error)}
            kind="error"
            title={localeCode === 'zh_CN' ? '网络资源暂时不可用' : 'Network resources unavailable'}
          />
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
        className: 'soha-platform-table',
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        columns: deletable ? [...columns, actionColumn] : columns,
        dataSource: clusterId ? filteredItems : [],
        rowKey: rowKey ?? ((record) => `${record.namespace}/${record.name}`),
        onRow,
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
        empty: (
          <ManagementState
            bordered={false}
            compact
            description={effectiveEmpty}
            kind={!clusterId ? 'select-scope' : 'empty'}
          />
        ),
      }}
    />
  )
}
