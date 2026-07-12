import { Card } from 'antd'
import { useI18n } from '@/i18n'
import {
  AccessControlResourceDetailPage,
  renderAccessControlRuleSummaries,
} from '../shared/detail-page'
import { AccessControlMetadataOverview } from '../shared/metadata-overview'
import { AccessControlReferencedByRelationships } from '../shared/relationships'
import type { ClusterRoleDetail } from './types'

export function PlatformAccessControlClusterRoleDetailPage() {
  const { localeCode } = useI18n()
  return (
    <AccessControlResourceDetailPage<ClusterRoleDetail>
      kind="clusterroles"
      label="ClusterRole"
      renderOverview={(detail) => (
        <>
          <AccessControlMetadataOverview
            detail={detail}
            extra={[
              { key: localeCode === 'zh_CN' ? '规则数' : 'Rules', value: detail.rules },
              {
                key: localeCode === 'zh_CN' ? '聚合规则' : 'Aggregation',
                value: detail.aggregationRules,
              },
            ]}
            scopeLabel={localeCode === 'zh_CN' ? '集群级' : 'Cluster-scoped'}
          />
          <Card
            className="soha-detail-card"
            title={localeCode === 'zh_CN' ? '规则摘要' : 'Rule Summaries'}
          >
            {renderAccessControlRuleSummaries(
              detail.ruleSummaries,
              localeCode === 'zh_CN' ? '暂无规则摘要' : 'No rule summaries',
            )}
          </Card>
        </>
      )}
      renderRelationships={(detail) => (
        <AccessControlReferencedByRelationships kind="ClusterRole" name={detail.name} />
      )}
    />
  )
}
