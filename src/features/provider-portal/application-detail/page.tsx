import {
  ArrowLeftOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LinkOutlined,
  StarFilled,
  StarOutlined,
  TeamOutlined,
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
          message.warning('Application launch URL is not configured')
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
  const providerLabel = application
    ? (portalProviderLabels[application.providerType] ?? application.providerType)
    : '-'
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
            title="Application not available"
            subTitle="The application is disabled, hidden, or not assigned to your identity."
            extra={
              <Button
                icon={<ArrowLeftOutlined />}
                type="primary"
                onClick={() => navigate('/portal')}
              >
                Back to Portal
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
            <Text type="secondary">{application.category || application.slug}</Text>
          </div>
        </div>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/portal')}>
            Portal
          </Button>
          <Tooltip title={application.favorite ? '取消收藏' : '收藏'}>
            <Button
              icon={application.favorite ? <StarFilled /> : <StarOutlined />}
              loading={favoriteMutation.isPending}
              onClick={() => favoriteMutation.mutate(application)}
            >
              {application.favorite ? 'Favorited' : 'Favorite'}
            </Button>
          </Tooltip>
          <Button
            disabled={application.status !== 'enabled'}
            icon={<LinkOutlined />}
            loading={launchMutation.isPending}
            type="primary"
            onClick={() => launchApplication(application)}
          >
            Open
          </Button>
        </Space>
      </header>

      <main className="soha-portal-main">
        <section className="soha-portal-detail-layout">
          <div className="soha-portal-detail-main">
            <section className="soha-portal-side-panel">
              <div className="soha-portal-detail-heading">
                <div>
                  <Title level={4}>Application</Title>
                  <Paragraph type="secondary">
                    {application.description || 'No description'}
                  </Paragraph>
                </div>
                <Space size={[4, 4]} wrap>
                  <Tag color={status.color}>{status.label}</Tag>
                  <Tag>{providerLabel}</Tag>
                  {application.featured ? <Tag color="blue">Featured</Tag> : null}
                </Space>
              </div>
              <Descriptions
                bordered
                column={{ xs: 1, sm: 1, md: 2 }}
                size="small"
                items={[
                  { key: 'slug', label: 'Slug', children: application.slug },
                  { key: 'category', label: 'Category', children: application.category || '-' },
                  { key: 'providerType', label: 'Provider type', children: providerLabel },
                  {
                    key: 'providerId',
                    label: 'Provider ID',
                    children: application.providerId || '-',
                  },
                  { key: 'status', label: 'Status', children: status.label },
                  {
                    key: 'lastLaunchedAt',
                    label: 'Last launch',
                    children: formatPortalDateTime(application.lastLaunchedAt),
                  },
                  {
                    key: 'createdAt',
                    label: 'Created',
                    children: formatPortalDateTime(application.createdAt),
                  },
                  {
                    key: 'updatedAt',
                    label: 'Updated',
                    children: formatPortalDateTime(application.updatedAt),
                  },
                ]}
              />
            </section>

            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <LinkOutlined />
                <span>Launch target</span>
              </div>
              {application.launchUrl ? (
                <Text className="soha-portal-url" copyable>
                  {application.launchUrl}
                </Text>
              ) : (
                <Alert showIcon type="warning" title="Launch URL is not configured" />
              )}
            </section>

            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <TeamOutlined />
                <span>Access scope</span>
              </div>
              {application.assignments?.length ? (
                <div className="soha-portal-assignment-list">
                  {application.assignments.map((assignment) => (
                    <Tag key={assignment.id || `${assignment.subjectType}:${assignment.subjectId}`}>
                      {assignment.subjectType}:{assignment.subjectId}
                    </Tag>
                  ))}
                </div>
              ) : (
                <Text type="secondary">Available to authenticated users</Text>
              )}
            </section>
          </div>

          <aside className="soha-portal-side">
            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <InfoCircleOutlined />
                <span>Tags</span>
              </div>
              <div className="soha-portal-app-tags">
                <PortalTagsOrEmpty values={application.tags} />
              </div>
            </section>

            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <KeyOutlined />
                <span>Metadata</span>
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
                <Text type="secondary">No metadata</Text>
              )}
            </section>
          </aside>
        </section>
      </main>
    </div>
  )
}
