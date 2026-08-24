import { lazy, Suspense, useEffect, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Space, Spin, Tabs } from 'antd'
import {
  ArrowLeftOutlined,
  DiffOutlined,
  HistoryOutlined,
  RollbackOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import { OperationalPlanModal } from '@/components/operational-plan-modal'
import { YamlDraftDiffEditor } from '@/components/yaml-draft-diff-editor'
import { K8S_TABLE_PAGE_SIZE } from '@/features/platform/shared/table-config'
import {
  ManagementDetailHeader,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasAllowedAction, hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useClusterCapability } from '@/features/platform/cluster-capabilities'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType, TabsProps } from 'antd'
import { helmMutations } from '../mutations'
import { planHelmReleaseRollback } from '../api'
import { helmQueries } from '../queries'
import type { HelmReleaseHistory, HelmReleaseRollbackVariables, HelmReleaseTarget } from '../types'
import '@/features/platform/extensions/styles.css'

const HelmReleaseValuesPanel = lazy(async () => {
  const module = await import('./values-panel')
  return { default: module.HelmReleaseValuesPanel }
})

export function HelmReleaseDetailPage() {
  const { message } = App.useApp()
  const { t, localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const { releaseName = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canViewValues = hasPermission(
    permissionSnapshotQuery.data?.data,
    'platform.helm.values.view',
  )
  const capability = useClusterCapability('helm.releases', localeCode)
  const detailNamespace = searchParams.get('namespace') || namespace || ''
  const requestedTab =
    searchParams.get('tab') === 'history' || !canViewValues ? 'history' : 'values'
  const [activeTab, setActiveTab] = useState(requestedTab)
  const [valuesDraft, setValuesDraft] = useState('')
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null)
  const [pendingRollback, setPendingRollback] = useState<HelmReleaseRollbackVariables | null>(null)
  const target: HelmReleaseTarget | null = clusterId
    ? { clusterId, name: releaseName, namespace: detailNamespace }
    : null
  const detailQuery = useQuery(helmQueries.releaseDetail(target))
  const valuesQuery = useQuery(
    helmQueries.releaseValues(target, canViewValues && activeTab === 'values'),
  )
  const historyQuery = useQuery(helmQueries.releaseHistory(target, activeTab === 'history'))
  const currentManifestQuery = useQuery(
    helmQueries.releaseManifest(
      target,
      detailQuery.data?.revision,
      activeTab === 'history' && canViewValues && Boolean(selectedRevision),
    ),
  )
  const selectedManifestQuery = useQuery(
    helmQueries.releaseManifest(
      target,
      selectedRevision ?? undefined,
      activeTab === 'history' && canViewValues && Boolean(selectedRevision),
    ),
  )
  const updateMutation = useMutation(helmMutations.updateValues(queryClient))
  const rollbackPlanMutation = useMutation({ mutationFn: planHelmReleaseRollback })
  const rollbackMutation = useMutation(helmMutations.rollbackRelease(queryClient))

  useEffect(() => setActiveTab(requestedTab), [requestedTab])
  useEffect(() => setValuesDraft(valuesQuery.data?.content ?? ''), [valuesQuery.data?.content])

  const detail = detailQuery.data
  const values = valuesQuery.data
  const valuesOriginal = values?.original || values?.content || ''
  const canEdit = Boolean(
    (values?.editable || detail?.valuesEditable) &&
    hasAllowedAction(values?.allowedActions ?? detail?.allowedActions, 'update'),
  )
  const mutationsDisabled = capability.status !== 'available'
  const capabilityReason = mutationsDisabled ? capability.reason : ''
  const clearRollbackPlan = () => {
    rollbackPlanMutation.reset()
    setPendingRollback(null)
  }
  const requestRollback = (record: HelmReleaseHistory) => {
    if (!target) return
    const revision = Number(record.revision)
    if (!Number.isInteger(revision) || revision < 1) return
    const variables = { ...target, revision, wait: true, timeoutSeconds: 300 }
    setPendingRollback(variables)
    rollbackPlanMutation.mutate(variables, {
      onError: (error) => void message.error(error.message),
    })
  }

  const historyColumns: TableColumnsType<HelmReleaseHistory> = [
    { title: 'Revision', dataIndex: 'revision', width: 96 },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (value?: string) => (value ? <StatusTag value={value} /> : '-'),
    },
    { title: 'Chart', dataIndex: 'chart' },
    { title: 'App Version', dataIndex: 'appVersion' },
    {
      title: 'Values Digest',
      dataIndex: 'valuesDigest',
      render: (value?: string) => (value ? value.slice(0, 12) : '-'),
    },
    {
      ...tableColumnPresets.datetime,
      title: localeCode === 'zh_CN' ? '更新时间' : 'Updated',
      dataIndex: 'updatedAt',
      render: (value?: string) => (value ? formatDateTime(value) : '-'),
    },
    {
      title: '',
      key: 'actions',
      width: 112,
      align: 'center',
      render: (_value, record) => {
        const isCurrent = record.revision === detail?.revision
        const canRollback = hasAllowedAction(record.allowedActions, 'rollback') && !isCurrent
        return (
          <Space size={2}>
            {canViewValues ? (
              <Button
                aria-label={
                  localeCode === 'zh_CN'
                    ? `比较 revision ${record.revision}`
                    : `Compare revision ${record.revision}`
                }
                icon={<DiffOutlined />}
                size="small"
                type={selectedRevision === record.revision ? 'primary' : 'text'}
                onClick={() => setSelectedRevision(record.revision)}
              />
            ) : null}
            {canRollback ? (
              <Button
                aria-label={
                  localeCode === 'zh_CN'
                    ? `回滚到 revision ${record.revision}`
                    : `Rollback to revision ${record.revision}`
                }
                disabled={mutationsDisabled}
                icon={<RollbackOutlined />}
                size="small"
                type="text"
                onClick={() => requestRollback(record)}
              />
            ) : null}
          </Space>
        )
      },
    },
  ]

  const tabs: TabsProps['items'] = [
    {
      key: 'values',
      label: 'values.yaml',
      children:
        activeTab === 'values' ? (
          <Suspense fallback={<Spin />}>
            <HelmReleaseValuesPanel
              original={valuesOriginal}
              draft={valuesDraft}
              onChange={setValuesDraft}
              onReset={() => setValuesDraft(valuesOriginal)}
              onApply={() => {
                if (!target) return
                updateMutation.mutate(
                  { ...target, content: valuesDraft },
                  {
                    onSuccess: (nextValues) => {
                      setValuesDraft(nextValues.content)
                      void message.success('values.yaml 已应用')
                    },
                    onError: (error) => void message.error(error.message),
                  },
                )
              }}
              error={valuesQuery.error}
              canEdit={canEdit}
              applying={updateMutation.isPending}
              applyDisabled={
                mutationsDisabled ||
                !canEdit ||
                !valuesDraft.trim() ||
                valuesDraft === valuesOriginal ||
                updateMutation.isPending
              }
            />
          </Suspense>
        ) : null,
    },
    {
      key: 'history',
      label: (
        <Space size={6}>
          <HistoryOutlined />
          <span>{t('page.extensions.helm.historyTitle', 'Revision History')}</span>
        </Space>
      ),
      children:
        activeTab === 'history' ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <AdminTable
              className="soha-platform-table"
              columns={historyColumns}
              dataSource={historyQuery.data ?? []}
              rowKey={(record) => record.revision}
              pageSize={K8S_TABLE_PAGE_SIZE}
              tableSize="small"
              localSorting
              viewportScroll
            />
            {selectedRevision &&
            !currentManifestQuery.isLoading &&
            !selectedManifestQuery.isLoading &&
            currentManifestQuery.data &&
            selectedManifestQuery.data ? (
              <YamlDraftDiffEditor
                editable={false}
                modified={selectedManifestQuery.data.content}
                original={currentManifestQuery.data.content}
                title={localeCode === 'zh_CN' ? '渲染清单差异' : 'Rendered manifest diff'}
                leftLabel={`Revision ${selectedRevision}`}
                rightLabel={`Current · Revision ${currentManifestQuery.data.revision}`}
              />
            ) : selectedRevision && (currentManifestQuery.error || selectedManifestQuery.error) ? (
              <Alert
                showIcon
                type="error"
                title={localeCode === 'zh_CN' ? '清单加载失败' : 'Failed to load manifests'}
                description={(currentManifestQuery.error || selectedManifestQuery.error)?.message}
              />
            ) : selectedRevision ? (
              <Spin />
            ) : null}
          </Space>
        ) : null,
    },
  ]
  const visibleTabs = canViewValues ? tabs : tabs.filter((tab) => tab.key !== 'values')

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title={detail?.name || releaseName}
        description={detailNamespace}
        actions={
          <ManagementTableToolbar>
            <Button
              autoInsertSpace={false}
              size="small"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/helm/releases')}
            >
              {t('common.back', 'Back')}
            </Button>
          </ManagementTableToolbar>
        }
      />
      {!clusterId || !detailNamespace ? (
        <Card className="soha-detail-card" style={{ marginTop: 0 }}>
          <ManagementState compact kind="select-scope" />
        </Card>
      ) : detailQuery.isLoading ? (
        <Card className="soha-detail-card" style={{ marginTop: 0 }} loading />
      ) : !detail ? (
        <Card className="soha-detail-card" style={{ marginTop: 0 }}>
          <ManagementState compact kind="not-found" />
        </Card>
      ) : (
        <>
          <Card className="soha-detail-card" style={{ marginTop: 0 }}>
            <Descriptions
              column={{ xs: 1, sm: 2, lg: 4 }}
              items={[
                { key: 'name', label: 'Release', children: detail.name },
                { key: 'namespace', label: 'Namespace', children: detail.namespace },
                { key: 'revision', label: 'Revision', children: detail.revision || '-' },
                {
                  key: 'status',
                  label: 'Status',
                  children: detail.status ? <StatusTag value={detail.status} /> : '-',
                },
                { key: 'chart', label: 'Chart', children: detail.chart || '-' },
                { key: 'appVersion', label: 'App Version', children: detail.appVersion || '-' },
                { key: 'storageDriver', label: 'Storage', children: detail.storageDriver || '-' },
                {
                  key: 'updatedAt',
                  label: localeCode === 'zh_CN' ? '更新时间' : 'Updated',
                  children: detail.updatedAt ? formatDateTime(detail.updatedAt) : '-',
                },
              ]}
            />
            {detail.description ? (
              <Alert
                style={{ marginTop: 16 }}
                type="info"
                showIcon
                description={detail.description}
              />
            ) : null}
            {capabilityReason ? (
              <Alert
                style={{ marginTop: 16 }}
                type="warning"
                showIcon
                title="Helm writes limited"
                description={capabilityReason}
              />
            ) : null}
          </Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={visibleTabs} />
        </>
      )}
      <OperationalPlanModal
        confirmText={localeCode === 'zh_CN' ? '确认回滚' : 'Confirm rollback'}
        loading={rollbackMutation.isPending}
        onCancel={clearRollbackPlan}
        onConfirm={() => {
          if (!pendingRollback) return
          rollbackMutation.mutate(pendingRollback, {
            onSuccess: () => {
              void message.success(
                localeCode === 'zh_CN'
                  ? `已回滚到 revision ${pendingRollback.revision}`
                  : `Rolled back to revision ${pendingRollback.revision}`,
              )
              clearRollbackPlan()
            },
            onError: (error) => void message.error(error.message),
          })
        }}
        plan={rollbackPlanMutation.data ?? null}
        title={localeCode === 'zh_CN' ? '确认 Helm 回滚' : 'Confirm Helm rollback'}
      />
    </div>
  )
}
