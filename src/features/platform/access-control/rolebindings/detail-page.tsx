import { useI18n } from '@/i18n'
import { AccessControlResourceDetailPage } from '../shared/detail-page'
import { AccessControlMetadataOverview } from '../shared/metadata-overview'
import {
  AccessControlBindingRelationships,
  AccessControlRoleRefLink,
  AccessControlSubjectLinks,
} from '../shared/relationships'
import type { RoleBindingDetail } from './types'

export function PlatformAccessControlRoleBindingDetailPage() {
  const { localeCode } = useI18n()
  return (
    <AccessControlResourceDetailPage<RoleBindingDetail>
      kind="rolebindings"
      label="RoleBinding"
      renderOverview={(detail) => (
        <AccessControlMetadataOverview
          detail={detail}
          extra={[
            {
              key: 'RoleRef',
              value: (
                <AccessControlRoleRefLink namespace={detail.namespace} value={detail.roleRef} />
              ),
            },
            {
              key: localeCode === 'zh_CN' ? 'Subjects' : 'Subjects',
              value: (
                <AccessControlSubjectLinks
                  namespace={detail.namespace}
                  subjects={detail.subjects}
                />
              ),
            },
          ]}
        />
      )}
      renderRelationships={(detail) => (
        <AccessControlBindingRelationships
          namespace={detail.namespace}
          roleRef={detail.roleRef}
          subjects={detail.subjects}
        />
      )}
    />
  )
}
