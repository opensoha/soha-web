import { Card } from 'antd'
import { useI18n } from '@/i18n'
import {
  AccessControlResourceDetailPage,
  renderAccessControlRuleSummaries,
} from '../shared/detail-page'
import { AccessControlMetadataOverview } from '../shared/metadata-overview'
import { AccessControlReferencedByRelationships } from '../shared/relationships'
import type { RoleDetail } from './types'

export function PlatformAccessControlRoleDetailPage() {
  const { localeCode } = useI18n()
  return (
    <AccessControlResourceDetailPage<RoleDetail>
      kind="roles"
      label="Role"
      renderOverview={(detail) => (
        <>
          <AccessControlMetadataOverview
            detail={detail}
            extra={[{ key: localeCode === 'zh_CN' ? '规则数' : 'Rules', value: detail.rules }]}
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
        <AccessControlReferencedByRelationships
          kind="Role"
          name={detail.name}
          namespace={detail.namespace}
        />
      )}
    />
  )
}
