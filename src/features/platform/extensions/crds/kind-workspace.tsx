import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDensityButton,
  ManagementIconButton,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import {
  capabilityActionTooltip,
  useClusterCapability,
} from '@/features/platform/cluster-capabilities'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatAgeSeconds, formatRelativeTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType } from 'antd'
import { ResourceQueryPanel } from '../shared/resource-query-panel'
import { includesSearch, normalizeSearchKeyword } from '../shared/search'
import { crdMutations } from './mutations'
import { crdQueries } from './queries'
import type { CRD, CRDResourceInstance } from './types'
import { getServedVersions, isNamespacedCRD } from './utils'

const { Text } = Typography

const CRDResourceEditorModal = lazy(async () => {
  const module = await import('./resource-editor-modal')
  return { default: module.CRDResourceEditorModal }
})

function formatSummary(summary?: Record<string, string | number | boolean | null>) {
  const entries = Object.entries(summary ?? {})
    .filter(([, value]) => value != null && value !== '')
    .slice(0, 3)
  return entries.length
    ? entries.map(([key, value]) => `${key}: ${String(value)}`).join(' · ')
    : '-'
}

function formatResourceAge(createdAt?: string, ageSeconds?: number) {
  if (createdAt) return formatRelativeTime(createdAt)
  if (typeof ageSeconds === 'number') return formatAgeSeconds(ageSeconds)
  return '-'
}

export function CRDKindWorkspace({ crd }: { crd: CRD }) {
  const { t, localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const queryClient = useQueryClient()
  const capability = useClusterCapability('custom.resources', localeCode)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<CRDResourceInstance | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [tableSize, setTableSize] = useState<'small' | 'middle'>('small')
  const normalizedKeyword = normalizeSearchKeyword(useDeferredValue(searchKeyword))
  const mutationsDisabled = capability.status !== 'unknown' && capability.status !== 'available'
  const capabilityReason = mutationsDisabled ? capability.reason : ''
  const resourcesQuery = useQuery(
    crdQueries.resources(clusterId, crd, namespace, !capability.isLoading && !mutationsDisabled),
  )
  const deleteMutation = useMutation(crdMutations.remove(queryClient))
  const rawResources = resourcesQuery.data ?? []
  const filteredResources = useMemo(
    () =>
      rawResources.filter((item) =>
        includesSearch(
          [
            item.name,
            item.namespace,
            item.kind || crd.kind,
            item.apiVersion || `${crd.group}/${crd.version}`,
            item.status,
            ...Object.entries(item.summary ?? {}).flatMap(([key, value]) => [key, value]),
          ],
          normalizedKeyword,
        ),
      ),
    [crd.group, crd.kind, crd.version, normalizedKeyword, rawResources],
  )
  const densityLabel = localeCode === 'zh_CN' ? '切换表格密度' : 'Toggle table density'

  const columns: TableColumnsType<CRDResourceInstance> = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (value: string, record) => (
        <Button type="link" style={{ paddingInline: 0 }} onClick={() => setEditingResource(record)}>
          {value}
        </Button>
      ),
    },
    ...(isNamespacedCRD(crd) ? [{ title: '命名空间', dataIndex: 'namespace', width: 180 }] : []),
    { title: 'Kind', dataIndex: 'kind', width: 180, render: (value?: string) => value || crd.kind },
    {
      title: 'API Version',
      dataIndex: 'apiVersion',
      width: 220,
      render: (value?: string) => value || `${crd.group}/${crd.version}`,
    },
    {
      ...tableColumnPresets.status,
      title: '状态',
      dataIndex: 'status',
      render: (value?: string) => (value ? <StatusTag value={value} /> : '-'),
    },
    { title: '摘要', dataIndex: 'summary', render: formatSummary },
    {
      ...tableColumnPresets.datetime,
      title: 'Age',
      key: 'age',
      render: (_value, record) => formatResourceAge(record.createdAt, record.ageSeconds),
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      align: 'center',
      width: 76,
      render: (_value, record) => {
        const resourceKey = `${record.namespace || ''}/${record.name}`
        return (
          <Space size={2} className="soha-row-action-icons">
            <ManagementIconButton
              icon={<EditOutlined />}
              aria-label={t('common.edit', 'Edit')}
              disabled={mutationsDisabled}
              tooltip={capabilityActionTooltip(t('common.edit', 'Edit'), capability)}
              onClick={() => setEditingResource(record)}
            />
            <Popconfirm
              title={t('common.deleteConfirm', `Delete ${record.name}?`)}
              description={record.namespace ? `${record.name} (${record.namespace})` : record.name}
              okText={t('common.delete', 'Delete')}
              cancelText={t('common.cancel', 'Cancel')}
              okButtonProps={{ danger: true, loading: deletingKey === resourceKey }}
              onConfirm={() => {
                if (!clusterId) return
                setDeletingKey(resourceKey)
                deleteMutation.mutate(
                  {
                    clusterId,
                    crd,
                    namespace: record.namespace ?? namespace,
                    resourceName: record.name,
                  },
                  {
                    onSuccess: () =>
                      void message.success(t('common.deleteSuccess', 'Deleted successfully')),
                    onError: (error) => void message.error(error.message),
                    onSettled: () => setDeletingKey(null),
                  },
                )
              }}
            >
              <ManagementIconButton
                danger
                icon={<DeleteOutlined />}
                aria-label={t('common.delete', 'Delete')}
                disabled={mutationsDisabled}
                loading={deletingKey === resourceKey}
                tooltip={capabilityActionTooltip(t('common.delete', 'Delete'), capability)}
              />
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <>
      <Card className="soha-detail-card" style={{ marginTop: 0 }}>
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions
            column={{ xs: 1, sm: 2, lg: 4 }}
            items={[
              { key: 'name', label: 'CRD', children: crd.name },
              { key: 'kind', label: 'Kind', children: crd.kind },
              { key: 'group', label: 'Group', children: crd.group },
              { key: 'plural', label: 'Plural', children: crd.plural },
              {
                key: 'versions',
                label: 'Versions',
                span: 2,
                children: getServedVersions(crd).map((value) => (
                  <Tag key={value} color={value === crd.version ? 'blue' : 'default'}>
                    {value}
                  </Tag>
                )),
              },
              { key: 'scope', label: 'Scope', children: <Tag>{crd.scope}</Tag> },
              {
                key: 'age',
                label: 'Age',
                children: formatResourceAge(crd.createdAt, crd.ageSeconds),
              },
            ]}
          />
          <Alert
            type={mutationsDisabled ? 'warning' : 'info'}
            showIcon
            title={
              isNamespacedCRD(crd)
                ? t('page.extensions.crd.namespacedTitle', 'Namespaced custom resources')
                : t('page.extensions.crd.clusterTitle', 'Cluster-scoped custom resources')
            }
            description={
              capabilityReason ||
              (isNamespacedCRD(crd)
                ? namespace
                  ? `The lower table is filtered by namespace ${namespace}.`
                  : 'The lower table spans all namespaces for this CRD.'
                : 'The lower table ignores the namespace selector because this CRD is cluster-scoped.')
            }
          />
        </Space>
      </Card>
      <ResourceQueryPanel
        placeholder={
          localeCode === 'zh_CN'
            ? '搜索资源名称 / Namespace / Kind / 状态 / 摘要'
            : 'Search resource name / namespace / kind / status / summary'
        }
        searchKeyword={searchKeyword}
        setSearchKeyword={setSearchKeyword}
      />
      <AdminTable
        className="soha-platform-table"
        columnSettingIconOnly
        columnSettingPlacement="header"
        shellClassName="soha-management-table-shell"
        columns={columns}
        dataSource={mutationsDisabled ? [] : filteredResources}
        rowKey={(record) => `${record.namespace || '__cluster__'}:${record.name}`}
        loading={resourcesQuery.isLoading}
        paginationSummary={
          <Text className="soha-workload-table-summary" type="secondary">
            {localeCode === 'zh_CN'
              ? `当前 ${filteredResources.length} / ${rawResources.length} 条`
              : `${filteredResources.length} / ${rawResources.length} items`}
          </Text>
        }
        empty={
          capabilityReason ? (
            <Alert
              type="warning"
              showIcon
              title="自定义资源实例不可用"
              description={capabilityReason}
            />
          ) : (
            <ManagementState bordered={false} compact title="No custom resources found." />
          )
        }
        tableSize={tableSize}
        scroll={{ x: 'max-content' }}
        headerExtra={
          <ManagementTableToolbar>
            <Button
              autoInsertSpace={false}
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              disabled={mutationsDisabled}
              title={capabilityReason}
              onClick={() => setCreateOpen(true)}
            >
              {t('common.create', 'Create')}
            </Button>
            <ManagementDensityButton
              aria-label={densityLabel}
              title={densityLabel}
              tooltip={densityLabel}
              onClick={() => setTableSize((current) => (current === 'middle' ? 'small' : 'middle'))}
            />
            <ManagementRefreshButton
              aria-label={t('common.refresh', 'Refresh')}
              loading={resourcesQuery.isFetching}
              tooltip={t('common.refresh', 'Refresh')}
              onClick={() => void resourcesQuery.refetch()}
            />
          </ManagementTableToolbar>
        }
      />
      {createOpen || editingResource ? (
        <Suspense fallback={<Spin />}>
          <CRDResourceEditorModal
            crd={crd}
            mode={editingResource ? 'edit' : 'create'}
            resource={editingResource}
            onClose={() => {
              setCreateOpen(false)
              setEditingResource(null)
            }}
            customResourceCapabilityReason={capabilityReason}
            customResourceMutationsDisabled={mutationsDisabled}
          />
        </Suspense>
      ) : null}
    </>
  )
}
