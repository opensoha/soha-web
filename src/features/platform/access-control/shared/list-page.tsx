import { useDeferredValue, useMemo, useState } from 'react'
import { Alert, Popconfirm, Typography, message } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { useClusterCapability } from '@/features/platform/cluster-capabilities'
import { CreateEntry } from '@/features/platform/resource-creation/components/create-entry'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type { TableColumnsType } from 'antd'
import { accessControlMutations } from './mutations'
import { accessControlQueries } from './queries'
import { accessControlScopeFromSelection, accessControlTargetFromRecord } from './scope'
import type { AccessControlKind, AccessControlResourceRecord } from './types'
import '../styles.css'

const { Text } = Typography

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase()
}

function matchesSearchValues(values: Array<string | null | undefined>, keyword: string) {
  if (!keyword) return true
  return values.some((value) => (value ?? '').toLowerCase().includes(keyword))
}

function requestErrorDescription(localeCode: 'zh_CN' | 'en_US', error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return localeCode === 'zh_CN'
      ? `RBAC 资源请求失败：${error.message}`
      : `Failed to load RBAC resources: ${error.message}`
  }
  return localeCode === 'zh_CN' ? 'RBAC 资源请求失败。' : 'Failed to load RBAC resources.'
}

export function AccessControlResourceListPage<T extends AccessControlResourceRecord>({
  columns,
  defaultTemplate,
  emptyDescription,
  kind,
  label,
  rowKey,
  searchValues,
}: {
  columns: TableColumnsType<T>
  defaultTemplate: string
  emptyDescription: { en_US: string; zh_CN: string }
  kind: AccessControlKind
  label: string
  rowKey: string | ((record: T) => string)
  searchValues: (record: T) => Array<string | null | undefined>
}) {
  const { localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const yamlCapability = useClusterCapability('resource.yaml.apply', localeCode)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const deferredSearchKeyword = useDeferredValue(searchKeyword)
  const scope = accessControlScopeFromSelection(kind, clusterId, namespace)
  const query = useQuery(accessControlQueries.list<T>(kind, scope))
  const removeMutation = useMutation(accessControlMutations.remove(kind, queryClient))
  const rawItems = query.data ?? []
  const normalizedKeyword = normalizeKeyword(deferredSearchKeyword)
  const filteredItems = useMemo(
    () => rawItems.filter((item) => matchesSearchValues(searchValues(item), normalizedKeyword)),
    [normalizedKeyword, rawItems, searchValues],
  )
  const actionsAvailable = !yamlCapability.isLoading && !yamlCapability.disabled
  const shouldShowActions =
    actionsAvailable && rawItems.some((item) => hasAllowedAction(item.allowedActions, 'delete'))
  const effectiveEmptyDescription = !clusterId
    ? localeCode === 'zh_CN'
      ? '请选择集群查看 RBAC 资源。'
      : 'Select a cluster to inspect RBAC resources.'
    : normalizedKeyword && rawItems.length > 0
      ? localeCode === 'zh_CN'
        ? `没有匹配的 ${label}`
        : `No matching ${label}`
      : emptyDescription[localeCode]
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'
  const deleteLabel = localeCode === 'zh_CN' ? '删除' : 'Delete'
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
      const target = accessControlTargetFromRecord(kind, clusterId, record)
      const deleting =
        removeMutation.isPending &&
        removeMutation.variables?.name === target.name &&
        removeMutation.variables.scope.namespace === target.scope.namespace
      return (
        <Popconfirm
          title={localeCode === 'zh_CN' ? `确认删除 ${record.name}？` : `Delete ${record.name}?`}
          cancelText={localeCode === 'zh_CN' ? '取消' : 'Cancel'}
          description={
            localeCode === 'zh_CN'
              ? '此操作不可恢复，删除后集群资源立即消失。'
              : 'This deletes the resource immediately and cannot be undone.'
          }
          okButtonProps={{ danger: true, loading: deleting }}
          okText={deleteLabel}
          onConfirm={() =>
            removeMutation.mutate(target, {
              onSuccess: () => void message.success(localeCode === 'zh_CN' ? '已删除' : 'Deleted'),
              onError: (error) => void message.error(error.message),
            })
          }
          placement="topRight"
        >
          <ManagementIconButton
            danger
            aria-label={deleteLabel}
            icon={<DeleteOutlined />}
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
        <>
          {query.isError ? (
            <ManagementState
              className="mb-3"
              description={requestErrorDescription(localeCode, query.error)}
              kind="error"
              title={localeCode === 'zh_CN' ? 'RBAC 资源暂时不可用' : 'RBAC resources unavailable'}
            />
          ) : null}
          {yamlCapability.reason ? (
            <Alert
              description={yamlCapability.reason}
              showIcon
              style={{ marginBottom: 12 }}
              title={localeCode === 'zh_CN' ? 'YAML 操作能力' : 'YAML operation capability'}
              type={yamlCapability.disabled ? 'warning' : 'info'}
            />
          ) : null}
        </>
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
            inputProps={{
              className: 'soha-platform-compact-field soha-workload-search-input',
              size: 'small',
            }}
            label={localeCode === 'zh_CN' ? '关键词' : 'Keyword'}
            onChange={setSearchKeyword}
            placeholder={localeCode === 'zh_CN' ? `搜索 ${label}` : `Search ${label}`}
            value={searchKeyword}
          />
        ),
      }}
      table={{
        className: 'soha-rbac-table soha-platform-table',
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        columns: shouldShowActions ? [...columns, actionColumn] : columns,
        dataSource: clusterId ? filteredItems : [],
        empty: (
          <ManagementState
            bordered={false}
            compact
            description={effectiveEmptyDescription}
            kind={!clusterId ? 'select-scope' : 'empty'}
          />
        ),
        headerExtra: (
          <ManagementTableToolbar>
            <CreateEntry
              context={{
                clusterId: clusterId || '',
                defaultNamespace:
                  kind === 'roles' || kind === 'rolebindings' || kind === 'serviceaccounts'
                    ? namespace || undefined
                    : undefined,
                expectedApiVersion:
                  kind === 'serviceaccounts' ? 'v1' : 'rbac.authorization.k8s.io/v1',
                expectedKind: {
                  serviceaccounts: 'ServiceAccount',
                  roles: 'Role',
                  rolebindings: 'RoleBinding',
                  clusterroles: 'ClusterRole',
                  clusterrolebindings: 'ClusterRoleBinding',
                }[kind],
                resourceGroup: 'access-control',
                scopeMode:
                  kind === 'clusterroles' || kind === 'clusterrolebindings'
                    ? 'cluster'
                    : 'namespace',
                source: 'list',
              }}
              defaultTemplate={defaultTemplate}
              label={label.replace(/s$/, '')}
            />
            <ManagementDensityButton
              aria-label={densityLabel}
              onClick={() => setTableSize((current) => (current === 'middle' ? 'small' : 'middle'))}
              title={densityLabel}
              tooltip={densityLabel}
            />
            <ManagementRefreshButton
              aria-label={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
              disabled={!clusterId}
              loading={query.isFetching}
              onClick={() => {
                if (clusterId) void query.refetch()
              }}
              tooltip={localeCode === 'zh_CN' ? '刷新' : 'Refresh'}
            />
          </ManagementTableToolbar>
        ),
        loading: query.isLoading,
        pageSize: 10,
        paginationSummary: (
          <Text className="soha-workload-table-summary" type="secondary">
            {localeCode === 'zh_CN'
              ? `当前 ${filteredItems.length} / ${rawItems.length} 条`
              : `${filteredItems.length} / ${rawItems.length} items`}
          </Text>
        ),
        rowKey,
        scroll: { x: 'max-content' },
        tableSize,
      }}
    />
  )
}
