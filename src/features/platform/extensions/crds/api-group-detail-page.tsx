import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Tag, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ManagementDetailHeader,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { CRDKindWorkspace } from './kind-workspace'
import { crdQueries } from './queries'
import { getServedVersions, groupCRDsByApi, isNamespacedCRD, safeDecodeURIComponent } from './utils'
import '@/features/platform/extensions/styles.css'

const { Text } = Typography

export function CRDApiGroupDetailPage() {
  const { t, localeCode } = useI18n()
  const { groupName } = useParams()
  const { clusterId } = usePlatformScopeStore()
  const navigate = useNavigate()
  const [selectedCRDName, setSelectedCRDName] = useState<string | null>(null)
  const decodedGroupName = safeDecodeURIComponent(groupName)
  const catalogQuery = useQuery(crdQueries.catalog(clusterId))
  const apiGroups = useMemo(() => groupCRDsByApi(catalogQuery.data ?? []), [catalogQuery.data])
  const groupSummary = useMemo(
    () => apiGroups.find((item) => item.group === decodedGroupName) ?? null,
    [apiGroups, decodedGroupName],
  )
  const groupCRDs = useMemo(() => groupSummary?.crds ?? [], [groupSummary?.crds])
  const selectedCRD = useMemo(
    () => groupCRDs.find((item) => item.name === selectedCRDName) ?? groupCRDs[0] ?? null,
    [groupCRDs, selectedCRDName],
  )

  useEffect(() => {
    if (!groupCRDs.length) {
      setSelectedCRDName(null)
    } else if (!selectedCRDName || !groupCRDs.some((item) => item.name === selectedCRDName)) {
      setSelectedCRDName(groupCRDs[0].name)
    }
  }, [groupCRDs, selectedCRDName])

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title={decodedGroupName || t('route.extensions-group-detail.title', 'API Detail')}
        actions={
          <ManagementTableToolbar>
            <Button
              autoInsertSpace={false}
              size="small"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/extensions')}
            >
              {t(
                'page.extensions.crd.backToApis',
                localeCode === 'zh_CN' ? '返回 API 列表' : 'Back to API catalog',
              )}
            </Button>
          </ManagementTableToolbar>
        }
      />
      {!clusterId ? (
        <Card className="soha-detail-card" style={{ marginTop: 0 }}>
          <ManagementState compact kind="select-scope" />
        </Card>
      ) : catalogQuery.isLoading ? (
        <Card className="soha-detail-card" style={{ marginTop: 0 }} loading />
      ) : !groupSummary ? (
        <Card className="soha-detail-card" style={{ marginTop: 0 }}>
          <ManagementState
            compact
            kind="not-found"
            title={t(
              'page.extensions.crd.groupEmpty',
              'The selected API group is not available in the current cluster.',
            )}
          />
        </Card>
      ) : (
        <div className="soha-crd-workspace">
          <Card className="soha-crd-sidebar-card" style={{ marginTop: 0 }}>
            <div className="soha-crd-sidebar-body">
              <div>
                <Text strong>{t('page.extensions.crd.kindCatalogTitle', 'CRD Resources')}</Text>
              </div>
              <div className="soha-tag-list">
                <Tag color="geekblue">{groupSummary.crdCount} Kinds</Tag>
                {groupSummary.namespacedCount ? (
                  <Tag color="gold">Namespaced {groupSummary.namespacedCount}</Tag>
                ) : null}
                {groupSummary.clusterCount ? (
                  <Tag color="blue">Cluster {groupSummary.clusterCount}</Tag>
                ) : null}
              </div>
              <div className="soha-tag-list">
                {groupSummary.versions.map((value) => (
                  <Tag key={value} color="blue">
                    {value}
                  </Tag>
                ))}
              </div>
              <div className="soha-crd-kind-list">
                {groupCRDs.map((crd) => {
                  const active = selectedCRD?.name === crd.name
                  return (
                    <button
                      key={crd.name}
                      type="button"
                      className={`soha-crd-kind-item ${active ? 'is-active' : ''}`}
                      onClick={() => setSelectedCRDName(crd.name)}
                    >
                      <span className="soha-crd-kind-item__header">
                        <span className="soha-crd-kind-item__name">{crd.name}</span>
                        <Tag color={isNamespacedCRD(crd) ? 'gold' : 'blue'} variant="filled">
                          {isNamespacedCRD(crd) ? 'Namespaced' : 'Cluster scoped'}
                        </Tag>
                      </span>
                      <span className="soha-crd-kind-item__meta">Kind: {crd.kind}</span>
                      <span className="soha-crd-kind-item__meta">Plural: {crd.plural}</span>
                      <span className="soha-crd-kind-item__meta">
                        {getServedVersions(crd).join(' · ')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>
          <div className="soha-crd-detail-column">
            {selectedCRD ? <CRDKindWorkspace crd={selectedCRD} /> : <ManagementState compact />}
          </div>
        </div>
      )}
    </div>
  )
}
