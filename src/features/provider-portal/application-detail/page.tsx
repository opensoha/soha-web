import {
  ArrowLeftOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LinkOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Descriptions,
  Result,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import type { IdentityApplication } from '@/features/identity'
import { useI18n } from '@/i18n'
import { providerPortalMutations } from '../mutations'
import { providerPortalQueries } from '../queries'
import {
  PortalApplicationAvatar,
  PortalTagsOrEmpty,
  portalProviderLabels,
  portalStatusLabels,
} from '../shared/application-ui'
import { formatPortalDateTime, portalMetadataValue } from '../shared/formatters'
import '../provider-portal-pages.css'

const { Paragraph, Text, Title } = Typography

export function PortalApplicationDetailPage() {
  const { t, localeCode } = useI18n()
  const navigate = useNavigate()
  const { applicationId = '' } = useParams()
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  const applicationQuery = useQuery(providerPortalQueries.application(applicationId))
  const launchMutation = useMutation(providerPortalMutations.launch(queryClient))
  const favoriteMutation = useMutation(providerPortalMutations.toggleFavorite(queryClient))

  const launchApplication = (application: IdentityApplication) => {
    launchMutation.mutate(application, {
      onSuccess: (decision) => {
        if (!decision.launchUrl) {
          message.warning(
            t(
              'providerPortal.home.launchUrlNotConfigured',
              'Application launch URL is not configured',
            ),
          )
          return
        }
        window.location.assign(decision.launchUrl)
      },
    })
  }

  const application = applicationQuery.data
  const status = application
    ? (portalStatusLabels[application.status] ?? portalStatusLabels.draft)
    : portalStatusLabels.draft
  const statusLabel = t(
    `providerPortal.application.status.${application?.status ?? 'draft'}`,
    status.label,
  )
  const providerLabel = application
    ? t(
        `providerPortal.application.provider.${application.providerType}`,
        portalProviderLabels[application.providerType] ?? application.providerType,
      )
    : '-'
  const favoriteLabel = application?.favorite
    ? t('providerPortal.home.unfavorite', 'Unfavorite')
    : t('providerPortal.home.favorite', 'Favorite')
  const metadataEntries = Object.entries(application?.metadata ?? {}).slice(0, 8)

  if (applicationQuery.isLoading) {
    return (
      <div className="soha-provider-portal is-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (!application) {
    return (
      <div className="soha-provider-portal">
        <main className="soha-portal-main">
          <Result
            status="403"
            title={t('providerPortal.detail.unavailable', 'Application not available')}
            subTitle={t(
              'providerPortal.detail.unavailableDescription',
              'The application is disabled, hidden, or not assigned to your identity.',
            )}
            extra={
              <Button
                icon={<ArrowLeftOutlined />}
                type="primary"
                onClick={() => navigate('/portal')}
              >
                {t('providerPortal.detail.backToPortal', 'Back to Portal')}
              </Button>
            }
          />
        </main>
      </div>
    )
  }

  return (
    <div className="soha-provider-portal">
      <header className="soha-portal-header">
        <div className="soha-portal-brand">
          <PortalApplicationAvatar application={application} />
          <div>
            <Title level={3}>{application.name}</Title>
          </div>
        </div>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/portal')}>
            {t('providerPortal.detail.backToPortal', 'Back to Portal')}
          </Button>
          <Tooltip title={favoriteLabel}>
            <Button
              icon={application.favorite ? <StarFilled /> : <StarOutlined />}
              loading={favoriteMutation.isPending}
              aria-label={favoriteLabel}
              onClick={() => favoriteMutation.mutate(application)}
            >
              {application.favorite
                ? t('providerPortal.detail.favorited', 'Favorited')
                : favoriteLabel}
            </Button>
          </Tooltip>
          <Button
            disabled={application.status !== 'enabled'}
            icon={<LinkOutlined />}
            loading={launchMutation.isPending}
            type="primary"
            onClick={() => launchApplication(application)}
          >
            {t('providerPortal.home.open', 'Open')}
          </Button>
        </Space>
      </header>

      <main className="soha-portal-main">
        <section className="soha-portal-detail-layout">
          <div className="soha-portal-detail-main">
            <section className="soha-portal-side-panel">
              <div className="soha-portal-detail-heading">
                <div>
                  <Title level={4}>{t('providerPortal.detail.application', 'Application')}</Title>
                  <Paragraph type="secondary">
                    {application.description ||
                      t('providerPortal.home.noDescription', 'No description')}
                  </Paragraph>
                </div>
                <Space size={[4, 4]} wrap>
                  <Tag color={status.color}>{statusLabel}</Tag>
                  <Tag>{providerLabel}</Tag>
                  {application.featured ? (
                    <Tag color="blue">{t('providerPortal.home.featured', 'Featured')}</Tag>
                  ) : null}
                </Space>
              </div>
              <Descriptions
                bordered
                column={{ xs: 1, sm: 1, md: 2 }}
                size="small"
                items={[
                  {
                    key: 'slug',
                    label: t('providerPortal.detail.slug', 'Slug'),
                    children: application.slug,
                  },
                  {
                    key: 'providerType',
                    label: t('identity.applications.providerType', 'Provider type'),
                    children: providerLabel,
                  },
                  {
                    key: 'providerId',
                    label: t('identity.applications.providerId', 'Provider ID'),
                    children: application.providerId || '-',
                  },
                  { key: 'status', label: t('common.status', 'Status'), children: statusLabel },
                  {
                    key: 'lastLaunchedAt',
                    label: t('providerPortal.detail.lastLaunch', 'Last launch'),
                    children: formatPortalDateTime(application.lastLaunchedAt, localeCode),
                  },
                  {
                    key: 'createdAt',
                    label: t('common.createdAt', 'Created At'),
                    children: formatPortalDateTime(application.createdAt, localeCode),
                  },
                  {
                    key: 'updatedAt',
                    label: t('common.updatedAt', 'Updated At'),
                    children: formatPortalDateTime(application.updatedAt, localeCode),
                  },
                ]}
              />
            </section>

            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <LinkOutlined />
                <span>{t('identity.applications.launchUrl', 'Launch URL')}</span>
              </div>
              {application.launchUrl ? (
                <Text className="soha-portal-url" copyable>
                  {application.launchUrl}
                </Text>
              ) : (
                <Alert
                  showIcon
                  type="warning"
                  title={t(
                    'providerPortal.home.launchUrlNotConfigured',
                    'Application launch URL is not configured',
                  )}
                />
              )}
            </section>
          </div>

          <aside className="soha-portal-side">
            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <InfoCircleOutlined />
                <span>{t('providerPortal.home.tags', 'Tags')}</span>
              </div>
              <div className="soha-portal-app-tags">
                <PortalTagsOrEmpty values={application.tags} />
              </div>
            </section>

            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <KeyOutlined />
                <span>{t('providerPortal.detail.metadata', 'Metadata')}</span>
              </div>
              {metadataEntries.length ? (
                <div className="soha-portal-metadata-list">
                  {metadataEntries.map(([key, value]) => (
                    <div className="soha-portal-metadata-row" key={key}>
                      <Text type="secondary">{key}</Text>
                      <Text>{portalMetadataValue(value)}</Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary">{t('providerPortal.detail.noMetadata', 'No metadata')}</Text>
              )}
            </section>
          </aside>
        </section>
      </main>
    </div>
  )
}
