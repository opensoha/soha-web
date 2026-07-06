import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Avatar,
  Badge,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Result,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LinkOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  favoritePortalApplication,
  getPortalApplication,
  getPortalBootstrap,
  getPortalSecuritySummary,
  launchPortalApplication,
  providerPortalQueryKeys,
  unfavoritePortalApplication,
} from './provider-portal-api'
import type {
  IdentityApplication,
  IdentityApplicationLaunch,
  IdentityProviderType,
  PortalSecuritySummary,
} from './provider-portal-api'
import './provider-portal-pages.css'

const { Paragraph, Text, Title } = Typography

type PortalFilterMode = 'all' | 'favorites' | 'recent' | 'featured'

const providerLabels: Record<IdentityProviderType, string> = {
  link: 'Link',
  oidc: 'OIDC',
  proxy: 'Proxy',
}

const statusLabels: Record<string, { color: string; label: string; status: 'success' | 'warning' | 'default' }> = {
  enabled: { color: 'green', label: 'Available', status: 'success' },
  maintenance: { color: 'gold', label: 'Maintenance', status: 'warning' },
  disabled: { color: 'default', label: 'Disabled', status: 'default' },
  draft: { color: 'default', label: 'Draft', status: 'default' },
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function searchableText(app: IdentityApplication) {
  return [
    app.name,
    app.slug,
    app.description,
    app.category,
    app.providerType,
    ...(app.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function compactTags(values: string[], max = 3) {
  const tags = values.filter(Boolean)
  if (!tags.length) return null
  return (
    <Space size={[4, 4]} wrap>
      {tags.slice(0, max).map((tag) => (
        <Tag key={tag}>{tag}</Tag>
      ))}
      {tags.length > max ? <Tag>+{tags.length - max}</Tag> : null}
    </Space>
  )
}

function tagsOrEmpty(values?: string[], max = 8) {
  const tags = values?.filter(Boolean) ?? []
  if (!tags.length) {
    return <Text type="secondary">None</Text>
  }
  return compactTags(tags, max)
}

function metadataValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

function ApplicationAvatar({ application }: { application: IdentityApplication }) {
  return (
    <Avatar
      alt={application.name}
      className="soha-portal-app-avatar"
      icon={application.iconUrl ? undefined : <AppstoreOutlined />}
      shape="square"
      size={46}
      src={application.iconUrl || undefined}
    >
      {application.name.slice(0, 1).toUpperCase()}
    </Avatar>
  )
}

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
  const status = statusLabels[application.status] ?? statusLabels.draft
  const providerLabel = providerLabels[application.providerType] ?? application.providerType
  return (
    <Card
      className="soha-portal-app-card"
      hoverable
      size="small"
      title={
        <div className="soha-portal-app-title">
          <ApplicationAvatar application={application} />
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
        <div className="soha-portal-app-tags">{compactTags(application.tags ?? [])}</div>
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
          <div className="soha-portal-side-value">{formatDateTime(security?.recentLoginAt)}</div>
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
                  <span className="soha-portal-recent-time">{formatDateTime(launch.createdAt)}</span>
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

  const bootstrapQuery = useQuery({
    queryKey: providerPortalQueryKeys.bootstrap,
    queryFn: getPortalBootstrap,
  })

  const refreshPortal = () => {
    void queryClient.invalidateQueries({ queryKey: ['provider-portal'] })
  }

  const launchMutation = useMutation({
    mutationFn: (application: IdentityApplication) => launchPortalApplication(application.id),
    onSuccess: (decision) => {
      if (!decision?.launchUrl) {
        message.warning('Application launch URL is not configured')
        return
      }
      refreshPortal()
      window.location.assign(decision.launchUrl)
    },
  })

  const favoriteMutation = useMutation({
    mutationFn: async (application: IdentityApplication) => {
      if (application.favorite) {
        await unfavoritePortalApplication(application.id)
        return
      }
      await favoritePortalApplication(application.id)
    },
    onSuccess: () => {
      refreshPortal()
    },
  })

  const bootstrap = bootstrapQuery.data
  const applications = bootstrap?.applications ?? []
  const favoriteApplications = applications.filter((application) => application.favorite)
  const recentApplications = new Set((bootstrap?.recent ?? []).map((launch) => launch.applicationId))
  const categories = bootstrap?.categories ?? []

  const filteredApplications = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return applications.filter((application) => {
      if (category && application.category !== category) return false
      if (keyword && !searchableText(application).includes(keyword)) return false
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
    <div className="soha-provider-portal">
      <header className="soha-portal-header">
        <div className="soha-portal-brand">
          <div className="soha-portal-mark">
            <DashboardOutlined />
          </div>
          <div>
            <Title level={3}>Soha Portal</Title>
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
                  loading={launchMutation.variables?.id === application.id && launchMutation.isPending}
                  onClick={() => launchMutation.mutate(application)}
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
              {applications.filter((item) => item.featured).slice(0, 5).map((application) => (
                <Button
                  key={application.id}
                  icon={<AppstoreOutlined />}
                  loading={launchMutation.variables?.id === application.id && launchMutation.isPending}
                  onClick={() => launchMutation.mutate(application)}
                >
                  {application.name}
                </Button>
              ))}
              {!applications.some((item) => item.featured) ? <Text type="secondary">No pinned apps</Text> : null}
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
                      favoriteMutation.isPending && favoriteMutation.variables?.id === application.id
                    }
                    key={application.id}
                    launchLoading={launchMutation.isPending && launchMutation.variables?.id === application.id}
                    onFavoriteToggle={(item) => favoriteMutation.mutate(item)}
                    onLaunch={(item) => launchMutation.mutate(item)}
                    onViewDetails={(item) => navigate(`/portal/applications/${encodeURIComponent(item.id)}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="soha-portal-empty">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching applications" />
              </div>
            )}
          </section>

          <aside className="soha-portal-side">
            <PortalSecurityPanel security={bootstrap?.security} />
            <RecentLaunchList
              applications={applications}
              launchLoadingId={launchMutation.variables?.id}
              launches={bootstrap?.recent ?? []}
              onLaunch={(application) => launchMutation.mutate(application)}
            />
          </aside>
        </div>
      </main>
    </div>
  )
}

export function PortalApplicationDetailPage() {
  const navigate = useNavigate()
  const { applicationId = '' } = useParams()
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  const applicationQuery = useQuery({
    enabled: Boolean(applicationId),
    queryKey: providerPortalQueryKeys.application(applicationId),
    queryFn: () => getPortalApplication(applicationId),
  })

  const refreshPortal = () => {
    void queryClient.invalidateQueries({ queryKey: ['provider-portal'] })
    if (applicationId) {
      void queryClient.invalidateQueries({
        queryKey: providerPortalQueryKeys.application(applicationId),
      })
    }
  }

  const launchMutation = useMutation({
    mutationFn: (application: IdentityApplication) => launchPortalApplication(application.id),
    onSuccess: (decision) => {
      if (!decision?.launchUrl) {
        message.warning('Application launch URL is not configured')
        return
      }
      refreshPortal()
      window.location.assign(decision.launchUrl)
    },
  })

  const favoriteMutation = useMutation({
    mutationFn: async (application: IdentityApplication) => {
      if (application.favorite) {
        await unfavoritePortalApplication(application.id)
        return
      }
      await favoritePortalApplication(application.id)
    },
    onSuccess: refreshPortal,
  })

  const application = applicationQuery.data
  const status = application ? statusLabels[application.status] ?? statusLabels.draft : statusLabels.draft
  const providerLabel = application ? providerLabels[application.providerType] ?? application.providerType : '-'
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
              <Button icon={<ArrowLeftOutlined />} type="primary" onClick={() => navigate('/portal')}>
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
          <ApplicationAvatar application={application} />
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
            onClick={() => launchMutation.mutate(application)}
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
                  <Paragraph type="secondary">{application.description || 'No description'}</Paragraph>
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
                  { key: 'providerId', label: 'Provider ID', children: application.providerId || '-' },
                  { key: 'status', label: 'Status', children: status.label },
                  { key: 'lastLaunchedAt', label: 'Last launch', children: formatDateTime(application.lastLaunchedAt) },
                  { key: 'createdAt', label: 'Created', children: formatDateTime(application.createdAt) },
                  { key: 'updatedAt', label: 'Updated', children: formatDateTime(application.updatedAt) },
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
                <Alert
                  showIcon
                  type="warning"
                  title="Launch URL is not configured"
                />
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
              <div className="soha-portal-app-tags">{tagsOrEmpty(application.tags)}</div>
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
                      <Text>{metadataValue(value)}</Text>
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

export function PortalSecurityPage() {
  const navigate = useNavigate()
  const securityQuery = useQuery({
    queryKey: providerPortalQueryKeys.security,
    queryFn: getPortalSecuritySummary,
  })

  const security = securityQuery.data
  const principal = security?.principal

  if (securityQuery.isLoading) {
    return (
      <div className="soha-provider-portal is-loading">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="soha-provider-portal">
      <header className="soha-portal-header">
        <div className="soha-portal-brand">
          <div className="soha-portal-mark">
            <SafetyCertificateOutlined />
          </div>
          <div>
            <Title level={3}>Security</Title>
            <Text type="secondary">Identity, sessions, and linked sources</Text>
          </div>
        </div>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/portal')}>
            Portal
          </Button>
          <Button icon={<UserOutlined />} onClick={() => navigate('/account/profile')}>
            Profile
          </Button>
        </Space>
      </header>

      <main className="soha-portal-main">
        <section className="soha-portal-security-overview">
          <Card size="small">
            <Statistic
              title="MFA"
              value={security?.mfaEnabled ? 'Enabled' : 'Not enabled'}
              prefix={<LockOutlined />}
            />
          </Card>
          <Card size="small">
            <Statistic
              title="Active sessions"
              value={security?.activeSession ?? 0}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
          <Card size="small">
            <Statistic
              title="Linked sources"
              value={security?.linkedSources.length ?? 0}
              prefix={<KeyOutlined />}
            />
          </Card>
          <Card size="small">
            <Statistic
              title="Recent login"
              value={formatDateTime(security?.recentLoginAt)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </section>

        <section className="soha-portal-detail-layout">
          <div className="soha-portal-detail-main">
            <section className="soha-portal-side-panel">
              <div className="soha-portal-principal is-large">
                <Avatar icon={<UserOutlined />} size={48} />
                <div className="soha-portal-principal-copy">
                  <Title level={4}>{principal?.userName || 'User'}</Title>
                  <Text type="secondary" ellipsis title={principal?.email}>
                    {principal?.email || principal?.userId || '-'}
                  </Text>
                </div>
              </div>
              <Descriptions
                bordered
                column={{ xs: 1, sm: 1, md: 2 }}
                size="small"
                items={[
                  { key: 'userId', label: 'User ID', children: principal?.userId || '-' },
                  { key: 'email', label: 'Email', children: principal?.email || '-' },
                  { key: 'mfa', label: 'MFA', children: security?.mfaEnabled ? 'Enabled' : 'Not enabled' },
                  { key: 'recentLoginAt', label: 'Recent login', children: formatDateTime(security?.recentLoginAt) },
                ]}
              />
            </section>

            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <KeyOutlined />
                <span>Linked sources</span>
              </div>
              <div className="soha-portal-app-tags">{tagsOrEmpty(security?.linkedSources)}</div>
            </section>
          </div>

          <aside className="soha-portal-side">
            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <TeamOutlined />
                <span>Roles</span>
              </div>
              <div className="soha-portal-app-tags">{tagsOrEmpty(principal?.roles)}</div>
            </section>
            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <TeamOutlined />
                <span>Teams</span>
              </div>
              <div className="soha-portal-app-tags">{tagsOrEmpty(principal?.teams)}</div>
            </section>
            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <InfoCircleOutlined />
                <span>Tags</span>
              </div>
              <div className="soha-portal-app-tags">{tagsOrEmpty(principal?.tags)}</div>
            </section>
          </aside>
        </section>
      </main>
    </div>
  )
}
