import { useDeferredValue, useMemo, useState } from 'react'
import { Alert, Button, Popconfirm, Space, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDensityButton,
  ManagementIconButton,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasAllowedAction } from '@/features/auth'
import {
  capabilityActionTooltip,
  useClusterCapability,
} from '@/features/platform/cluster-capabilities'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatAgeSeconds } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ResourceQueryPanel } from '../../shared/resource-query-panel'
import { includesSearch, normalizeSearchKeyword } from '../../shared/search'
import { helmMutations } from '../mutations'
import { buildHelmReleaseRoutePath } from '../paths'
import { helmQueries } from '../queries'
import type { HelmRelease } from '../types'
import '@/features/platform/extensions/styles.css'

const { Text } = Typography

export function HelmReleasesPage() {
  const { t, localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const capability = useClusterCapability('helm.releases', localeCode)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const [deletingReleaseKey, setDeletingReleaseKey] = useState<string | null>(null)
  const normalizedKeyword = normalizeSearchKeyword(useDeferredValue(searchKeyword))
  const releasesQuery = useQuery(helmQueries.releases(clusterId, namespace))
  const deleteMutation = useMutation(helmMutations.removeRelease(queryClient))
  const rawItems = releasesQuery.data ?? []
  const filteredItems = useMemo(
    () =>
      rawItems.filter((item) =>
        includesSearch(
          [item.name, item.namespace, item.chart, item.revision, item.status, item.appVersion],
          normalizedKeyword,
        ),
      ),
    [normalizedKeyword, rawItems],
  )
  const mutationsDisabled = capability.status !== 'unknown' && capability.status !== 'available'
  const capabilityReason = mutationsDisabled ? capability.reason : ''
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'
  const emptyTitle = !clusterId
    ? t('platformScope.clusterPlaceholder', 'Select cluster')
    : normalizedKeyword && rawItems.length
      ? localeCode === 'zh_CN'
        ? '没有匹配的 Helm Release'
        : 'No matching Helm releases'
      : t('page.extensions.helm.empty', 'No Helm releases in the current scope.')

  const columns: TableColumnsType<HelmRelease> = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (value: string, record) => (
        <Button
          type="link"
          style={{ paddingInline: 0 }}
          onClick={() => navigate(buildHelmReleaseRoutePath(value, record.namespace))}
        >
          {value}
        </Button>
      ),
    },
    { title: '命名空间', dataIndex: 'namespace' },
    { title: 'Chart', dataIndex: 'chart' },
    { title: 'Revision', dataIndex: 'revision' },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'status',
      render: (value?: string) => (value ? <StatusTag value={value} /> : '-'),
    },
    { title: 'App Version', dataIndex: 'appVersion' },
    {
      ...tableColumnPresets.datetime,
      title: 'Age',
      dataIndex: 'ageSeconds',
      render: formatAgeSeconds,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      align: 'center',
      width: 116,
      render: (_value, record) => {
        const key = `${record.namespace}/${record.name}`
        const canUpdate = hasAllowedAction(record.allowedActions, 'update')
        const canDelete = hasAllowedAction(record.allowedActions, 'delete')
        const editLabel =
          localeCode === 'zh_CN' ? '编辑并比对 values.yaml' : 'Edit and compare values.yaml'
        const deleteLabel = localeCode === 'zh_CN' ? '删除 Helm Release' : 'Delete Helm release'
        return (
          <Space
            size={2}
            className="soha-row-action-icons"
            onClick={(event) => event.stopPropagation()}
          >
            <ManagementIconButton
              icon={<EyeOutlined />}
              aria-label={localeCode === 'zh_CN' ? '查看 values.yaml' : 'View values.yaml'}
              tooltip={localeCode === 'zh_CN' ? '查看 values.yaml' : 'View values.yaml'}
              onClick={() =>
                navigate(
                  buildHelmReleaseRoutePath(record.name, record.namespace, {
                    tab: 'values',
                    mode: 'diff',
                  }),
                )
              }
            />
            {canUpdate ? (
              <ManagementIconButton
                icon={<EditOutlined />}
                aria-label={editLabel}
                disabled={mutationsDisabled}
                tooltip={capabilityActionTooltip(editLabel, capability)}
                onClick={() =>
                  navigate(
                    buildHelmReleaseRoutePath(record.name, record.namespace, {
                      tab: 'values',
                      mode: 'edit',
                    }),
                  )
                }
              />
            ) : null}
            {canDelete ? (
              <Popconfirm
                title={localeCode === 'zh_CN' ? '删除 Helm Release?' : 'Delete Helm release?'}
                description={`${record.name} (${record.namespace})`}
                okText={localeCode === 'zh_CN' ? '删除' : 'Delete'}
                cancelText={t('common.cancel', 'Cancel')}
                okButtonProps={{ danger: true, loading: deletingReleaseKey === key }}
                onConfirm={() => {
                  if (!clusterId) return
                  setDeletingReleaseKey(key)
                  deleteMutation.mutate(
                    { clusterId, name: record.name, namespace: record.namespace },
                    {
                      onSuccess: () => void message.success('Helm Release 已删除'),
                      onError: (error) => void message.error(error.message),
                      onSettled: () => setDeletingReleaseKey(null),
                    },
                  )
                }}
              >
                <ManagementIconButton
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={deleteLabel}
                  disabled={mutationsDisabled}
                  loading={deletingReleaseKey === key}
                  tooltip={capabilityActionTooltip(deleteLabel, capability)}
                />
              </Popconfirm>
            ) : null}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="soha-page">
      <ResourceQueryPanel
        placeholder={
          localeCode === 'zh_CN'
            ? '搜索 Release / Namespace / Chart / 状态 / 版本'
            : 'Search release / namespace / chart / status / version'
        }
        searchKeyword={searchKeyword}
        setSearchKeyword={setSearchKeyword}
      />
      {capabilityReason ? (
        <Alert
          showIcon
          type="warning"
          style={{ marginBottom: 12 }}
          title={localeCode === 'zh_CN' ? '当前连接模式限制 Helm 写入' : 'Helm writes limited'}
          description={capabilityReason}
        />
      ) : null}
      <AdminTable
        className="soha-platform-table"
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        columns={columns}
        dataSource={clusterId ? filteredItems : []}
        rowKey={(record) => `${record.namespace}:${record.name}`}
        loading={releasesQuery.isLoading}
        paginationSummary={
          <Text className="soha-workload-table-summary" type="secondary">
            {localeCode === 'zh_CN'
              ? `当前 ${filteredItems.length} / ${rawItems.length} 条`
              : `${filteredItems.length} / ${rawItems.length} items`}
          </Text>
        }
        tableSize={tableSize}
        scroll={{ x: 'max-content' }}
        onRow={(record: HelmRelease) => ({
          onClick: () => navigate(buildHelmReleaseRoutePath(record.name, record.namespace)),
          style: { cursor: 'pointer' },
        })}
        headerExtra={
          <ManagementTableToolbar>
            <ManagementDensityButton
              aria-label={densityLabel}
              title={densityLabel}
              tooltip={densityLabel}
              onClick={() => setTableSize((current) => (current === 'middle' ? 'small' : 'middle'))}
            />
            <ManagementRefreshButton
              aria-label={t('common.refresh', 'Refresh')}
              disabled={!clusterId}
              loading={releasesQuery.isFetching}
              tooltip={t('common.refresh', 'Refresh')}
              onClick={() => clusterId && void releasesQuery.refetch()}
            />
          </ManagementTableToolbar>
        }
        empty={
          <ManagementState
            bordered={false}
            compact
            kind={!clusterId ? 'select-scope' : 'empty'}
            title={emptyTitle}
          />
        }
      />
    </div>
  )
}
