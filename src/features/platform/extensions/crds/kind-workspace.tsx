import { lazy, Suspense, useDeferredValue, useEffect, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Popconfirm, Space, Spin } from 'antd'
import type { TableColumnsType, TableProps } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import { K8S_TABLE_PAGE_SIZE } from '@/features/platform/shared/table-config'
import {
  ManagementIconButton,
  ManagementSearchableListPane,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasAllowedAction, hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useClusterCapability } from '@/features/platform/cluster-capabilities'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatAgeSeconds, formatRelativeTime } from '@/utils/time'
import { includesSearch, normalizeSearchKeyword } from '../shared/search'
import { ResourceQueryPanel } from '../shared/resource-query-panel'
import { crdMutations } from './mutations'
import { crdQueries } from './queries'
import type { CRD, CRDResourceInstance } from './types'
import { getServedVersions } from './utils'
import './instance-workspace.css'

const CRDResourceEditorModal = lazy(async () => ({
  default: (await import('./resource-editor-modal')).CRDResourceEditorModal,
}))
const CRDResourceEditor = lazy(async () => ({
  default: (await import('./resource-editor-modal')).CRDResourceEditor,
}))
const resourceKey = (record: CRDResourceInstance) => `${record.namespace || ''}/${record.name}`
function resourceAge(record: CRDResourceInstance, now: number) {
  const created = record.createdAt ? Date.parse(record.createdAt) : NaN
  return Number.isFinite(created)
    ? Math.max(0, (now - created) / 1000)
    : (record.ageSeconds ?? Number.POSITIVE_INFINITY)
}

export function CRDKindWorkspace({
  crd,
  kinds,
  onKindSelect,
}: {
  crd: CRD
  kinds: CRD[]
  onKindSelect: (name: string) => void
}) {
  const { localeCode } = useI18n()
  const zh = localeCode === 'zh_CN'
  const { modal } = App.useApp()
  const [kindSearch, setKindSearch] = useState('')
  const [editorState, setEditorState] = useState({ dirty: false, busy: false })
  const keyword = normalizeSearchKeyword(useDeferredValue(kindSearch))
  const leaveResource = (action: () => void) => {
    if (editorState.busy) return
    const switchNow = () => {
      setEditorState({ dirty: false, busy: false })
      action()
    }
    if (!editorState.dirty) switchNow()
    else
      modal.confirm({
        title: zh ? '离开当前资源？' : 'Leave this resource?',
        content: zh
          ? '尚未应用的更改会被放弃。已保存的本地草稿仍会保留。'
          : 'Unapplied changes will be discarded. Saved local drafts are retained.',
        okText: zh ? '放弃更改并切换' : 'Discard and switch',
        cancelText: zh ? '取消' : 'Cancel',
        onOk: switchNow,
      })
  }
  return (
    <div className="soha-crd-instance-workspace">
      <ManagementSearchableListPane
        className="soha-crd-kind-directory"
        activeKey={crd.name}
        getItemKey={(kind: CRD) => kind.name}
        items={kinds.filter((kind) =>
          includesSearch([kind.kind, kind.name, kind.plural, ...getServedVersions(kind)], keyword),
        )}
        searchValue={kindSearch}
        onSearchChange={setKindSearch}
        searchPlaceholder={zh ? '搜索 CRD 类型' : 'Search CRD types'}
        emptyTitle={zh ? '没有匹配的 CRD 类型' : 'No matching CRD types'}
        onItemSelect={(kind) => {
          if (kind.name !== crd.name) leaveResource(() => onKindSelect(kind.name))
        }}
        renderItem={(kind) => (
          <>
            <span className="soha-crd-kind-heading">
              <strong title={kind.name}>{kind.kind}</strong>
              <span className="soha-crd-resource-secondary">
                {getServedVersions(kind).join(', ')}
              </span>
            </span>
            <span className="soha-crd-resource-secondary" title={kind.name}>
              {kind.plural} ·{' '}
              {kind.scope === 'Namespaced'
                ? zh
                  ? '命名空间'
                  : 'Namespaced'
                : zh
                  ? '集群'
                  : 'Cluster'}
            </span>
          </>
        )}
      />
      <div className="soha-crd-instance-content">
        <CRDInstancesWorkspace
          key={crd.name}
          crd={crd}
          onLeave={leaveResource}
          onStateChange={setEditorState}
        />
      </div>
    </div>
  )
}

function CRDInstancesWorkspace({
  crd,
  onLeave,
  onStateChange,
}: {
  crd: CRD
  onLeave: (action: () => void) => void
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void
}) {
  const { t, localeCode } = useI18n()
  const zh = localeCode === 'zh_CN'
  const { message } = App.useApp()
  const { clusterId, namespace } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const capability = useClusterCapability('custom.resources', localeCode)
  const [createOpen, setCreateOpen] = useState(false)
  const [selection, setSelection] = useState<CRDResourceInstance>()
  const [editing, setEditing] = useState(false)
  const [editorState, setEditorState] = useState({ dirty: false, busy: false })
  const [searchKeyword, setSearchKeyword] = useState('')
  const [sort, setSort] = useState<{ key?: string; order?: 'ascend' | 'descend' | null }>({})
  const [pagination, setPagination] = useState({ current: 1, pageSize: K8S_TABLE_PAGE_SIZE })
  const keyword = normalizeSearchKeyword(useDeferredValue(searchKeyword))
  const disabled = capability.disabled
  const accessQuery = useQuery(
    crdQueries.access(clusterId, crd, namespace, !capability.isLoading && !disabled),
  )
  const resourcesQuery = useQuery(
    crdQueries.resources(clusterId, crd, namespace, !capability.isLoading && !disabled),
  )
  const permissions = usePermissionSnapshot()
  const canCreate =
    !disabled &&
    accessQuery.data?.allowedActions?.includes('create') === true &&
    hasPermission(permissions.data?.data, 'platform.extensions.custom-resources.create')
  const deleteMutation = useMutation(crdMutations.remove(queryClient))
  const resources = disabled ? [] : (resourcesQuery.data ?? [])
  const filtered = resources.filter((record) =>
    includesSearch(
      [
        record.name,
        record.namespace,
        record.kind || crd.kind,
        record.apiVersion || `${crd.group}/${crd.version}`,
        record.status,
        ...Object.entries(record.summary ?? {}).flatMap(([key, value]) => [key, value]),
      ],
      keyword,
    ),
  )
  const page = Math.min(
    pagination.current,
    Math.max(1, Math.ceil(filtered.length / pagination.pageSize)),
  )
  const selected =
    resources.find((record) => selection && resourceKey(record) === resourceKey(selection)) ??
    (editing || resourcesQuery.isFetching || resourcesQuery.isError ? selection : undefined)
  const canView = ['view', 'update'].some((action) =>
    hasAllowedAction(selected?.allowedActions, action),
  )
  const canUpdate =
    selected && !selected.deletingAt && hasAllowedAction(selected.allowedActions, 'update')
  const busy = editorState.busy || deleteMutation.isPending
  useEffect(() => {
    onStateChange({ dirty: editorState.dirty, busy })
  }, [onStateChange, editorState.dirty, busy])
  const switchResource = (action: () => void) => {
    if (busy) return
    onLeave(() => {
      setEditing(false)
      setEditorState({ dirty: false, busy: false })
      action()
    })
  }
  const refresh = () => {
    void resourcesQuery.refetch()
    void accessQuery.refetch()
  }
  const openResource = (record: CRDResourceInstance, edit = false) =>
    switchResource(() => {
      setSelection(record)
      setEditing(edit)
    })
  const backButton = (
    <Button
      autoInsertSpace={false}
      icon={<ArrowLeftOutlined />}
      disabled={busy}
      onClick={() => switchResource(() => setSelection(undefined))}
    >
      {zh ? '返回实例列表' : 'Back to instances'}
    </Button>
  )
  const deleteButton = (record: CRDResourceInstance) =>
    !record.deletingAt && hasAllowedAction(record.allowedActions, 'delete') ? (
      <Popconfirm
        title={t('common.deleteConfirm', `Delete ${record.name}?`)}
        description={`${record.name} (${record.namespace || crd.scope})`}
        okText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
        onConfirm={() => {
          if (!clusterId || disabled || busy || editing) return
          deleteMutation.mutate(
            {
              clusterId,
              crd,
              namespace: record.namespace ?? namespace,
              resourceName: record.name,
              expectedUid: record.uid,
            },
            {
              onSuccess: () => {
                if (selection && resourceKey(selection) === resourceKey(record))
                  setSelection(undefined)
                void message.success(
                  zh ? '删除请求已接受，等待资源清理' : 'Deletion accepted; waiting for cleanup',
                )
              },
              onError: (error) => void message.error(error.message),
            },
          )
        }}
      >
        <ManagementIconButton
          danger
          icon={<DeleteOutlined />}
          aria-label={t('common.delete', 'Delete')}
          tooltip={t('common.delete', 'Delete')}
          disabled={disabled || busy || editing}
          loading={deleteMutation.isPending}
        />
      </Popconfirm>
    ) : null
  const columns: TableColumnsType<CRDResourceInstance> = [
    {
      key: 'name',
      dataIndex: 'name',
      title: zh ? '名称' : 'Name',
      width: 240,
      sortOrder: sort.key === 'name' ? sort.order : null,
      render: (_value, record) => (
        <Button
          type="link"
          className="soha-crd-instance-name"
          disabled={busy}
          onClick={() => openResource(record)}
        >
          {record.name}
        </Button>
      ),
    },
    ...(crd.scope === 'Namespaced'
      ? [
          {
            key: 'namespace',
            dataIndex: 'namespace',
            title: zh ? '命名空间' : 'Namespace',
            width: 150,
            sortOrder: sort.key === 'namespace' ? sort.order : null,
          },
        ]
      : []),
    {
      key: 'status',
      dataIndex: 'status',
      title: zh ? '状态' : 'Status',
      width: 100,
      sortOrder: sort.key === 'status' ? sort.order : null,
      render: (_value, record) =>
        record.status || record.deletingAt ? (
          <StatusTag value={record.deletingAt ? 'deleting' : record.status!} />
        ) : (
          '—'
        ),
    },
    {
      key: 'age',
      title: zh ? '创建时间' : 'Created',
      width: 110,
      sortOrder: sort.key === 'age' ? sort.order : null,
      sorter: (left, right) => {
        const now = Date.now()
        const a = resourceAge(left, now),
          b = resourceAge(right, now)
        if (a === b) return 0
        if (!Number.isFinite(a)) return 1
        if (!Number.isFinite(b)) return -1
        return b - a
      },
      render: (_value, record) =>
        record.createdAt
          ? formatRelativeTime(record.createdAt)
          : record.ageSeconds == null
            ? '—'
            : formatAgeSeconds(record.ageSeconds),
    },
    {
      key: 'actions',
      render: (_value, record) => (
        <Space size={0} className="soha-row-action-icons">
          <ManagementIconButton
            icon={<EditOutlined />}
            aria-label={t('common.edit', 'Edit')}
            tooltip={t('common.edit', 'Edit')}
            disabled={
              disabled ||
              busy ||
              Boolean(record.deletingAt) ||
              !hasAllowedAction(record.allowedActions, 'update')
            }
            onClick={() => openResource(record, true)}
          />
          {deleteButton(record)}
        </Space>
      ),
    },
  ]
  const onTableChange: NonNullable<TableProps<CRDResourceInstance>['onChange']> = (
    next,
    _filters,
    sorter,
    extra,
  ) => {
    setPagination({
      current: extra.action === 'paginate' ? next.current || 1 : 1,
      pageSize: next.pageSize || pagination.pageSize,
    })
    const column = Array.isArray(sorter) ? sorter[0] : sorter
    setSort({
      key: column.columnKey == null ? undefined : String(column.columnKey),
      order: column.order,
    })
  }
  const header = selected ? (
    <div className="soha-crd-resource-heading">
      <div className="soha-crd-resource-identity">
        <div>
          <strong>{selected.name}</strong>{' '}
          {selected.status || selected.deletingAt ? (
            <StatusTag value={selected.deletingAt ? 'deleting' : selected.status!} />
          ) : null}
        </div>
        <span className="soha-crd-resource-secondary">
          {selected.kind || crd.kind} · {selected.namespace || (zh ? '集群范围' : 'Cluster scope')}{' '}
          ·{' '}
          {selected.createdAt
            ? formatRelativeTime(selected.createdAt)
            : selected.ageSeconds == null
              ? '—'
              : formatAgeSeconds(selected.ageSeconds)}
        </span>
      </div>
      <ManagementTableToolbar>
        {backButton}
        {editing ? (
          <Button disabled={busy} onClick={() => switchResource(() => {})}>
            {zh ? '取消编辑' : 'Cancel editing'}
          </Button>
        ) : (
          <ManagementIconButton
            icon={<EditOutlined />}
            aria-label={t('common.edit', 'Edit')}
            tooltip={t('common.edit', 'Edit')}
            disabled={!canUpdate || disabled || busy}
            onClick={() => {
              setSelection(selected)
              setEditing(true)
            }}
          />
        )}
        {deleteButton(selected)}
      </ManagementTableToolbar>
      <Descriptions
        className="soha-crd-resource-facts"
        column={{ xs: 1, sm: 2 }}
        size="small"
        items={[
          {
            key: 'api',
            label: 'API',
            children: selected.apiVersion || `${crd.group}/${crd.version}`,
          },
          { key: 'crd', label: 'CRD', children: crd.name },
          { key: 'versions', label: 'Versions', children: getServedVersions(crd).join(', ') },
          { key: 'scope', label: 'Scope', children: crd.scope },
          {
            key: 'finalizers',
            label: 'Finalizers',
            children: selected.finalizers?.join(', ') || '—',
            span: 2,
          },
          ...Object.entries(selected.summary ?? {}).map(([key, value]) => ({
            key: `summary/${key}`,
            label: key,
            children: value == null ? '—' : String(value),
          })),
        ]}
      />
    </div>
  ) : null
  return (
    <>
      <div className="soha-crd-instance-list" hidden={Boolean(selection)}>
        <ResourceQueryPanel
          searchKeyword={searchKeyword}
          setSearchKeyword={(value) => {
            setSearchKeyword(value)
            setPagination((current) => ({ ...current, current: 1 }))
          }}
          placeholder={zh ? '搜索实例 / 命名空间 / 摘要' : 'Search instance / namespace / summary'}
        />
        <AdminTable
          columns={columns}
          dataSource={filtered}
          rowKey={resourceKey}
          scroll={{ x: 'max-content' }}
          localSorting
          enableDensity
          columnSettingIconOnly
          columnSettingPlacement="header"
          onRefresh={refresh}
          refreshing={resourcesQuery.isFetching}
          loading={resourcesQuery.isLoading || capability.isLoading}
          error={resourcesQuery.error}
          shellClassName="soha-management-table-shell"
          title={
            <span>
              {crd.kind} · {zh ? '实例' : 'Instances'}
            </span>
          }
          pagination={{ current: page, pageSize: pagination.pageSize, total: filtered.length }}
          onChange={onTableChange}
          headerExtra={
            <Button
              autoInsertSpace={false}
              type="primary"
              icon={<PlusOutlined />}
              aria-label={zh ? '新建实例' : 'Create instance'}
              disabled={!canCreate || busy}
              onClick={() => switchResource(() => setCreateOpen(true))}
            >
              {zh ? '新建实例' : 'Create instance'}
            </Button>
          }
          empty={
            <ManagementState
              bordered={false}
              compact
              kind={disabled ? 'unsupported' : 'empty'}
              title={disabled ? undefined : zh ? '暂无自定义资源实例' : 'No custom resources'}
              description={
                disabled
                  ? capability.reason
                  : searchKeyword
                    ? zh
                      ? '没有匹配的实例，请调整搜索条件。'
                      : 'No matching instances. Adjust your search.'
                    : undefined
              }
            />
          }
        />
      </div>
      {selection ? (
        <>
          {resourcesQuery.isError ? (
            <Alert showIcon type="error" title={resourcesQuery.error.message} />
          ) : null}
          {selected && canView ? (
            <Suspense fallback={<Card loading />}>
              <CRDResourceEditor
                key={`${resourceKey(selected)}/${editing}`}
                crd={crd}
                mode="edit"
                resource={selected}
                editable={editing}
                header={header}
                onStateChange={setEditorState}
                customResourceMutationsDisabled={disabled}
                customResourceCapabilityReason={capability.reason}
                onClose={editing ? () => setEditing(false) : undefined}
              />
            </Suspense>
          ) : (
            <Card className="soha-detail-card">
              {header || backButton}
              <ManagementState
                bordered={false}
                kind={selected ? 'no-permission' : 'not-found'}
                description={
                  selected
                    ? zh
                      ? '当前授权不允许查看此实例内容'
                      : 'You cannot view this instance'
                    : zh
                      ? '此实例已不存在，请返回列表刷新。'
                      : 'This instance is no longer available. Return to the list and refresh.'
                }
              />
            </Card>
          )}
        </>
      ) : null}
      {createOpen ? (
        <Suspense fallback={<Spin />}>
          <CRDResourceEditorModal
            crd={crd}
            mode="create"
            onClose={() => setCreateOpen(false)}
            customResourceMutationsDisabled={disabled}
            customResourceCapabilityReason={capability.reason}
          />
        </Suspense>
      ) : null}
    </>
  )
}
