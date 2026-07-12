import { useMemo, useState } from 'react'
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import type { IdentityApplication, IdentityApplicationLaunch } from '@/features/identity'
import { providerPortalMutations } from '../mutations'
import { providerPortalQueries } from '../queries'
import {
  PortalApplicationAvatar,
  PortalTags,
  portalProviderLabels,
  portalStatusLabels,
} from '../shared/application-ui'
import { formatPortalDateTime, portalApplicationSearchText } from '../shared/formatters'
import type { PortalSecuritySummary } from '../shared/types'
import '../provider-portal-pages.css'

const { Paragraph, Text, Title } = Typography

type PortalFilterMode = 'all' | 'favorites' | 'recent' | 'featured'

function ApplicationCard({
  application,
  favoriteLoading,
  launchLoading,
  onFavoriteToggle,
  onLaunch,
  onViewDetails,
}: {
  application: IdentityApplication
  favoriteLoading: boolean
  launchLoading: boolean
  onFavoriteToggle: (application: IdentityApplication) => void
  onLaunch: (application: IdentityApplication) => void
  onViewDetails: (application: IdentityApplication) => void
}) {
  const status = portalStatusLabels[application.status] ?? portalStatusLabels.draft
  const providerLabel = portalProviderLabels[application.providerType] ?? application.providerType
  return (
    <Card
      className="soha-portal-app-card"
      hoverable
      size="small"
      title={
        <div className="soha-portal-app-title">
          <PortalApplicationAvatar application={application} />
          <div className="soha-portal-app-title-copy">
            <Text strong ellipsis title={application.name}>
              {application.name}
            </Text>
            <Text type="secondary" ellipsis title={application.category || application.slug}>
              {application.category || application.slug}
            </Text>
          </div>
        </div>
      }
      extra={
        <Tooltip title={application.favorite ? '取消收藏' : '收藏'}>
          <Button
            aria-label={application.favorite ? '取消收藏' : '收藏'}
            icon={application.favorite ? <StarFilled /> : <StarOutlined />}
            loading={favoriteLoading}
            size="small"
            type="text"
            onClick={(event) => {
              event.stopPropagation()
              onFavoriteToggle(application)
            }}
          />
        </Tooltip>
      }
    >
      <div className="soha-portal-app-card-body">
        <Paragraph
          className="soha-portal-app-description"
          ellipsis={{ rows: 2, tooltip: application.description }}
        >
          {application.description || 'No description'}
        </Paragraph>
        <div className="soha-portal-app-meta">
          <Tag color={status.color}>{status.label}</Tag>
          <Tag>{providerLabel}</Tag>
          {application.featured ? <Tag color="blue">Featured</Tag> : null}
        </div>
        <div className="soha-portal-app-tags">
          <PortalTags values={application.tags} />
        </div>
        <div className="soha-portal-app-actions">
          <Button icon={<InfoCircleOutlined />} onClick={() => onViewDetails(application)}>
            Details
          </Button>
          <Button
            disabled={application.status !== 'enabled'}
            icon={<LinkOutlined />}
            loading={launchLoading}
            type="primary"
            onClick={() => onLaunch(application)}
          >
            Open
          </Button>
        </div>
      </div>
    </Card>
  )
}

function PortalSecurityPanel({ security }: { security?: PortalSecuritySummary }) {
  const principal = security?.principal
  return (
    <section className="soha-portal-side-panel" aria-label="Security summary">
      <div className="soha-portal-side-title">
        <SafetyCertificateOutlined />
        <span>Security</span>
      </div>
      <div className="soha-portal-principal">
        <Avatar icon={<UserOutlined />} size={40} />
        <div className="soha-portal-principal-copy">
          <Text strong>{principal?.userName || 'User'}</Text>
          <Text type="secondary" ellipsis title={principal?.email}>
            {principal?.email || principal?.userId || '-'}
          </Text>
        </div>
      </div>
      <div className="soha-portal-security-grid">
        <div>
          <Text type="secondary">MFA</Text>
          <div>
            <Badge
              status={security?.mfaEnabled ? 'success' : 'default'}
              text={security?.mfaEnabled ? 'Enabled' : 'Not enabled'}
            />
          </div>
        </div>
        <div>
          <Text type="secondary">Sessions</Text>
          <div className="soha-portal-side-value">{security?.activeSession ?? 0}</div>
        </div>
        <div>
          <Text type="secondary">Sources</Text>
          <div className="soha-portal-side-value">{security?.linkedSources.length ?? 0}</div>
        </div>
        <div>
          <Text type="secondary">Recent login</Text>
          <div className="soha-portal-side-value">
            {formatPortalDateTime(security?.recentLoginAt)}
          </div>
        </div>
      </div>
    </section>
  )
}

function RecentLaunchList({
  applications,
  launches,
  launchLoadingId,
  onLaunch,
}: {
  applications: IdentityApplication[]
  launches: IdentityApplicationLaunch[]
  launchLoadingId?: string
  onLaunch: (application: IdentityApplication) => void
}) {
  const appById = useMemo(
    () => new Map(applications.map((application) => [application.id, application])),
    [applications],
  )
  return (
    <section className="soha-portal-side-panel" aria-label="Recent launches">
      <div className="soha-portal-side-title">
        <ClockCircleOutlined />
        <span>Recent</span>
      </div>
      {launches.length ? (
        <div className="soha-portal-recent-list">
          {launches.slice(0, 6).map((launch) => {
            const application = appById.get(launch.applicationId)
            return (
              <button
                className="soha-portal-recent-item"
                disabled={!application}
                key={launch.id}
                type="button"
                onClick={() => application && onLaunch(application)}
              >
                <span className="soha-portal-recent-main">
                  <span className="soha-portal-recent-name">
                    {launch.applicationName || application?.name || launch.applicationId}
                  </span>
                  <span className="soha-portal-recent-time">
                    {formatPortalDateTime(launch.createdAt)}
                  </span>
                </span>
                {launchLoadingId === application?.id ? <Spin size="small" /> : <LinkOutlined />}
              </button>
            )
          })}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No recent launches" />
      )}
    </section>
  )
}

export function SohaProviderPortalPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>()
  const [mode, setMode] = useState<PortalFilterMode>('all')

  const bootstrapQuery = useQuery(providerPortalQueries.bootstrap())
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

  const bootstrap = bootstrapQuery.data
  const applications = bootstrap?.applications ?? []
  const favoriteApplications = applications.filter((application) => application.favorite)
  const recentApplications = new Set(
    (bootstrap?.recent ?? []).map((launch) => launch.applicationId),
  )
  const categories = bootstrap?.categories ?? []

  const filteredApplications = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return applications.filter((application) => {
      if (category && application.category !== category) return false
      if (keyword && !portalApplicationSearchText(application).includes(keyword)) return false
      if (mode === 'favorites' && !application.favorite) return false
      if (mode === 'recent' && !recentApplications.has(application.id)) return false
      if (mode === 'featured' && !application.featured) return false
      return true
    })
  }, [applications, category, mode, query, recentApplications])

  if (bootstrapQuery.isLoading) {
    return (
      <div className="soha-provider-portal is-loading">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="soha-provider-portal soha-provider-portal-home">
      <header className="soha-portal-header">
        <div className="soha-portal-brand">
          <div className="soha-portal-mark">
            <DashboardOutlined />
          </div>
          <div>
            <Title level={3}>门户首页</Title>
            <Text type="secondary">Application access and identity workspace</Text>
          </div>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => bootstrapQuery.refetch()}>
            Refresh
          </Button>
          <Button icon={<SafetyCertificateOutlined />} onClick={() => navigate('/portal/security')}>
            Security
          </Button>
          <Button icon={<UserOutlined />} onClick={() => navigate('/account/profile')}>
            Profile
          </Button>
        </Space>
      </header>

      <main className="soha-portal-main">
        <section className="soha-portal-toolbar">
          <Input
            allowClear
            className="soha-portal-search"
            placeholder="Search applications"
            prefix={<SearchOutlined />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            allowClear
            className="soha-portal-category"
            placeholder="Category"
            options={categories.map((item) => ({ label: item, value: item }))}
            value={category}
            onChange={setCategory}
          />
          <Segmented
            className="soha-portal-mode"
            options={[
              { label: 'All', value: 'all' },
              { label: 'Favorites', value: 'favorites' },
              { label: 'Recent', value: 'recent' },
              { label: 'Featured', value: 'featured' },
            ]}
            value={mode}
            onChange={(value) => setMode(value as PortalFilterMode)}
          />
        </section>

        <section className="soha-portal-shortcuts">
          <div className="soha-portal-shortcut-group">
            <Text type="secondary">Favorites</Text>
            <div className="soha-portal-shortcut-row">
              {favoriteApplications.slice(0, 5).map((application) => (
                <Button
                  key={application.id}
                  icon={<StarFilled />}
                  loading={
                    launchMutation.variables?.id === application.id && launchMutation.isPending
                  }
                  onClick={() => launchApplication(application)}
                >
                  {application.name}
                </Button>
              ))}
              {!favoriteApplications.length ? <Text type="secondary">No favorites</Text> : null}
            </div>
          </div>
          <div className="soha-portal-shortcut-group">
            <Text type="secondary">Pinned</Text>
            <div className="soha-portal-shortcut-row">
              {applications
                .filter((item) => item.featured)
                .slice(0, 5)
                .map((application) => (
                  <Button
                    key={application.id}
                    icon={<AppstoreOutlined />}
                    loading={
                      launchMutation.variables?.id === application.id && launchMutation.isPending
                    }
                    onClick={() => launchApplication(application)}
                  >
                    {application.name}
                  </Button>
                ))}
              {!applications.some((item) => item.featured) ? (
                <Text type="secondary">No pinned apps</Text>
              ) : null}
            </div>
          </div>
        </section>

        <div className="soha-portal-workspace">
          <section className="soha-portal-apps">
            <div className="soha-portal-section-heading">
              <div>
                <Title level={4}>Applications</Title>
                <Text type="secondary">{filteredApplications.length} available</Text>
              </div>
            </div>
            {filteredApplications.length ? (
              <div className="soha-portal-app-grid">
                {filteredApplications.map((application) => (
                  <ApplicationCard
                    application={application}
                    favoriteLoading={
                      favoriteMutation.isPending &&
                      favoriteMutation.variables?.id === application.id
                    }
                    key={application.id}
                    launchLoading={
                      launchMutation.isPending && launchMutation.variables?.id === application.id
                    }
                    onFavoriteToggle={(item) => favoriteMutation.mutate(item)}
                    onLaunch={launchApplication}
                    onViewDetails={(item) =>
                      navigate(`/portal/applications/${encodeURIComponent(item.id)}`)
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="soha-portal-empty">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No matching applications"
                />
              </div>
            )}
          </section>

          <aside className="soha-portal-side">
            <PortalSecurityPanel security={bootstrap?.security} />
            <RecentLaunchList
              applications={applications}
              launchLoadingId={launchMutation.variables?.id}
              launches={bootstrap?.recent ?? []}
              onLaunch={launchApplication}
            />
          </aside>
        </div>
      </main>
    </div>
  )
}
