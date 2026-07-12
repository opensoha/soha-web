import { Tag, Typography } from 'antd'
import { BooleanTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { AccessControlResourceDetailPage } from '../shared/detail-page'
import { AccessControlMetadataOverview } from '../shared/metadata-overview'
import { AccessControlReferencedByRelationships } from '../shared/relationships'
import type { ServiceAccountDetail } from './types'

const { Text } = Typography

function renderStringList(values: string[] | undefined, emptyLabel: string) {
  if (!values?.length) return <Text type="secondary">{emptyLabel}</Text>
  return (
    <div className="soha-tag-list">
      {values.map((value) => (
        <Tag key={value}>{value}</Tag>
      ))}
    </div>
  )
}

export function PlatformAccessControlServiceAccountDetailPage() {
  const { localeCode } = useI18n()
  return (
    <AccessControlResourceDetailPage<ServiceAccountDetail>
      kind="serviceaccounts"
      label="ServiceAccount"
      renderOverview={(detail) => (
        <AccessControlMetadataOverview
          detail={detail}
          extra={[
            {
              key: 'Secrets',
              value: renderStringList(
                detail.secrets,
                localeCode === 'zh_CN' ? '暂无关联 Secrets' : 'No secrets',
              ),
            },
            {
              key: localeCode === 'zh_CN' ? '镜像拉取密钥' : 'Image Pull Secrets',
              value: renderStringList(
                detail.imagePullSecrets,
                localeCode === 'zh_CN' ? '暂无 imagePullSecrets' : 'No image pull secrets',
              ),
            },
            {
              key: localeCode === 'zh_CN' ? '自动挂载 Token' : 'Automount Token',
              value: (
                <BooleanTag
                  falseLabel={localeCode === 'zh_CN' ? '否' : 'No'}
                  trueLabel={localeCode === 'zh_CN' ? '是' : 'Yes'}
                  value={detail.automountServiceAccountToken}
                />
              ),
            },
          ]}
        />
      )}
      renderRelationships={(detail) => (
        <AccessControlReferencedByRelationships
          kind="ServiceAccount"
          name={detail.name}
          namespace={detail.namespace}
        />
      )}
    />
  )
}
