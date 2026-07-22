import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Button, Card, Descriptions, Space, Spin, Statistic, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { providerPortalQueries } from '../queries'
import { PortalTagsOrEmpty } from '../shared/application-ui'
import { formatPortalDateTime } from '../shared/formatters'
import { PortalAccountMenu } from '../shared/account-menu'
import '../provider-portal-pages.css'

const { Text, Title } = Typography

export function PortalSecurityPage() {
  const navigate = useNavigate()
  const securityQuery = useQuery(providerPortalQueries.security())

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
          <PortalAccountMenu />
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
              value={formatPortalDateTime(security?.recentLoginAt)}
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
                  {
                    key: 'mfa',
                    label: 'MFA',
                    children: security?.mfaEnabled ? 'Enabled' : 'Not enabled',
                  },
                  {
                    key: 'recentLoginAt',
                    label: 'Recent login',
                    children: formatPortalDateTime(security?.recentLoginAt),
                  },
                ]}
              />
            </section>

            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <KeyOutlined />
                <span>Linked sources</span>
              </div>
              <div className="soha-portal-app-tags">
                <PortalTagsOrEmpty values={security?.linkedSources} />
              </div>
            </section>
          </div>

          <aside className="soha-portal-side">
            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <TeamOutlined />
                <span>Roles</span>
              </div>
              <div className="soha-portal-app-tags">
                <PortalTagsOrEmpty values={principal?.roles} />
              </div>
            </section>
            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <TeamOutlined />
                <span>Teams</span>
              </div>
              <div className="soha-portal-app-tags">
                <PortalTagsOrEmpty values={principal?.teams} />
              </div>
            </section>
            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <InfoCircleOutlined />
                <span>Tags</span>
              </div>
              <div className="soha-portal-app-tags">
                <PortalTagsOrEmpty values={principal?.tags} />
              </div>
            </section>
          </aside>
        </section>
      </main>
    </div>
  )
}
