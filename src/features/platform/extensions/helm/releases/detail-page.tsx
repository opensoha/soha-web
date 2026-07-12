import { lazy, Suspense, useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Space, Spin, Tabs, message } from 'antd'
import { ArrowLeftOutlined, HistoryOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDetailHeader,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasAllowedAction } from '@/features/auth'
import { useClusterCapability } from '@/features/platform/cluster-capabilities'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import type { TableColumnsType, TabsProps } from 'antd'
import { helmMutations } from '../mutations'
import { helmQueries } from '../queries'
import type { HelmReleaseHistory, HelmReleaseTarget } from '../types'
import '@/features/platform/extensions/styles.css'

const HelmReleaseValuesPanel = lazy(async () => {
  const module = await import('./values-panel')
  return { default: module.HelmReleaseValuesPanel }
})

export function HelmReleaseDetailPage() {
  const { t, localeCode } = useI18n()
  const { clusterId, namespace } = usePlatformScopeStore()
  const { releaseName = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const capability = useClusterCapability('helm.releases', localeCode)
  const detailNamespace = searchParams.get('namespace') || namespace || ''
  const requestedTab = searchParams.get('tab') === 'history' ? 'history' : 'values'
  const [activeTab, setActiveTab] = useState(requestedTab)
  const [valuesDraft, setValuesDraft] = useState('')
  const target: HelmReleaseTarget | null = clusterId
    ? { clusterId, name: releaseName, namespace: detailNamespace }
    : null
  const detailQuery = useQuery(helmQueries.releaseDetail(target))
  const valuesQuery = useQuery(helmQueries.releaseValues(target, activeTab === 'values'))
  const historyQuery = useQuery(helmQueries.releaseHistory(target, activeTab === 'history'))
  const updateMutation = useMutation(helmMutations.updateValues(queryClient))

  useEffect(() => setActiveTab(requestedTab), [requestedTab])
  useEffect(() => setValuesDraft(valuesQuery.data?.content ?? ''), [valuesQuery.data?.content])

  const detail = detailQuery.data
  const values = valuesQuery.data
  const valuesOriginal = values?.original || values?.content || ''
  const canEdit = Boolean(
    (values?.editable || detail?.valuesEditable) &&
    hasAllowedAction(values?.allowedActions ?? detail?.allowedActions, 'update'),
  )
  const mutationsDisabled = capability.status !== 'unknown' && capability.status !== 'available'
  const capabilityReason = mutationsDisabled ? capability.reason : ''

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
          <AdminTable
            className="soha-platform-table"
            columns={historyColumns}
            dataSource={historyQuery.data ?? []}
            rowKey={(record) => record.revision}
            pageSize={10}
            tableSize="small"
          />
        ) : null,
    },
  ]

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
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
        </>
      )}
    </div>
  )
}
