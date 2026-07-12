import { useI18n } from '@/i18n'
import { AccessControlResourceDetailPage } from '../shared/detail-page'
import { AccessControlMetadataOverview } from '../shared/metadata-overview'
import {
  AccessControlBindingRelationships,
  AccessControlRoleRefLink,
  AccessControlSubjectLinks,
} from '../shared/relationships'
import type { ClusterRoleBindingDetail } from './types'

export function PlatformAccessControlClusterRoleBindingDetailPage() {
  const { localeCode } = useI18n()
  return (
    <AccessControlResourceDetailPage<ClusterRoleBindingDetail>
      kind="clusterrolebindings"
      label="ClusterRoleBinding"
      renderOverview={(detail) => (
        <AccessControlMetadataOverview
          detail={detail}
          extra={[
            {
              key: 'RoleRef',
              value: <AccessControlRoleRefLink value={detail.roleRef} />,
            },
            {
              key: localeCode === 'zh_CN' ? 'Subjects' : 'Subjects',
              value: <AccessControlSubjectLinks subjects={detail.subjects} />,
            },
          ]}
          scopeLabel={localeCode === 'zh_CN' ? '集群级' : 'Cluster-scoped'}
        />
      )}
      renderRelationships={(detail) => (
        <AccessControlBindingRelationships roleRef={detail.roleRef} subjects={detail.subjects} />
      )}
    />
  )
}
