import { Button, Card, Space, Typography } from 'antd'
import {
  ApiOutlined,
  AppstoreOutlined,
  AuditOutlined,
  KeyOutlined,
  LinkOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { ManagementDetailHeader, ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import {
  OverviewChip,
  OverviewMetricCard,
  OverviewSectionBar,
  type OverviewChipItem,
  type OverviewMetricItem,
} from '@/components/overview-visuals'
import { formatDateTime } from '@/utils/time'
import { useIdentityOverviewData } from './use-overview-data'
import './styles.css'

const { Text } = Typography

function resultTag(result?: string) {
  const value = result || '-'
  return <StatusTag value={value} />
}

function latestUpdated(items: Array<{ updatedAt?: string; createdAt?: string }>) {
  const latest = items
    .map((item) => new Date(item.updatedAt || item.createdAt || '').getTime())
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)[0]
  return latest ? new Date(latest).toISOString() : ''
}

export function IdentityOverviewPage() {
  const navigate = useNavigate()
  const {
    applications,
    providers,
    outposts,
    sessions,
    audits,
    runtime,
    loading,
    permissions,
    refreshAll,
  } = useIdentityOverviewData()
  const oidcProviders = providers.filter((provider) => provider.type === 'oidc')
  const proxyProviders = providers.filter((provider) => provider.type === 'proxy')
  const samlProviders = providers.filter((provider) => provider.type === 'saml')
  const enabledProviders = providers.filter(
    (provider) => provider.enabled && provider.status === 'enabled',
  )
  const enabledApplications = applications.filter((application) => application.status === 'enabled')
  const onlineOutposts = outposts.filter((outpost) => outpost.status === 'online')
  const oidcEnabled = oidcProviders.some(
    (provider) => provider.enabled && provider.status === 'enabled',
  )
  const proxyEnabled = proxyProviders.some(
    (provider) => provider.enabled && provider.status === 'enabled',
  )
  const overviewStats = [
    {
      key: 'applications',
      label: '应用目录',
      value: applications.length,
      helper: `${enabledApplications.length} 个已启用 / 最近更新 ${formatDateTime(latestUpdated(applications))}`,
      icon: <AppstoreOutlined />,
      loading: loading.applications,
      tone: enabledApplications.length > 0 ? 'success' : 'default',
    },
    {
      key: 'providers',
      label: 'Provider',
      value: providers.length,
      helper: `${enabledProviders.length} 个已启用 / ${oidcProviders.length} OIDC / ${proxyProviders.length} Proxy / ${samlProviders.length} SAML`,
      icon: <ApiOutlined />,
      loading: loading.providers,
      tone: enabledProviders.length > 0 ? 'success' : 'default',
    },
    {
      key: 'outposts',
      label: 'Outpost',
      value: outposts.length,
      helper: `${onlineOutposts.length} 个在线 / ${
        [
          runtime?.outpost.embeddedRuntime.available && 'Embedded',
          runtime?.outpost.agentRuntime.available && 'Agent',
          runtime?.outpost.kubernetesArtifact.available && 'Kubernetes',
          runtime?.outpost.externalProtocol.available && 'External-compatible',
        ]
          .filter(Boolean)
          .join('、') || '无可用执行端'
      }`,
      icon: <LinkOutlined />,
      loading: loading.outposts,
      tone: onlineOutposts.length > 0 ? 'success' : 'default',
    },
    {
      key: 'sessions',
      label: '活跃会话',
      value: sessions.length,
      helper: '来自统一登录源与 Provider Portal',
      icon: <UserSwitchOutlined />,
      loading: loading.sessions,
      tone: sessions.length > 0 ? 'success' : 'default',
    },
  ] satisfies Array<OverviewMetricItem & { loading?: boolean }>
  const protocolStatus = [
    {
      key: 'oidc',
      label: 'OIDC Provider',
      value: oidcProviders.length,
      helper: oidcEnabled ? '已启用' : '未启用',
      icon: <KeyOutlined />,
      tone: oidcEnabled ? 'success' : 'default',
    },
    {
      key: 'saml',
      label: 'SAML Provider',
      value: samlProviders.length,
      helper: runtime?.samlApplicationProvider.available
        ? samlProviders.some((provider) => provider.enabled && provider.status === 'enabled')
          ? '已启用'
          : '运行时可用，未启用'
        : runtime?.samlApplicationProvider.reason || '运行时不可用',
      icon: <SafetyCertificateOutlined />,
      tone: runtime?.samlApplicationProvider.available ? 'success' : 'default',
    },
    {
      key: 'proxy',
      label: 'Proxy Provider',
      value: proxyProviders.length,
      helper: proxyEnabled ? '已启用' : '未启用',
      icon: <ApiOutlined />,
      tone: proxyEnabled ? 'success' : 'default',
    },
  ] satisfies OverviewChipItem[]
  const operationStats = [
    {
      key: 'audit',
      label: '最近审计',
      value: audits.length,
      helper: '最近身份相关操作和协议访问记录',
      icon: <AuditOutlined />,
      tone: audits.length > 0 ? 'success' : 'default',
    },
  ] satisfies OverviewChipItem[]

  return (
    <div className="soha-page soha-overview-page soha-identity-overview-page">
      <ManagementDetailHeader
        actions={
          <Button icon={<ReloadOutlined />} onClick={refreshAll}>
            刷新
          </Button>
        }
        description="查看 Provider Portal、下游 Provider、活跃会话和身份审计的运行状态。"
        title="总览"
      />

      <div className="soha-overview-metric-grid">
        {overviewStats.map((item) => (
          <OverviewMetricCard
            key={item.key}
            label={item.label}
            value={item.value}
            helper={item.helper}
            icon={item.icon}
            tone={item.tone}
            loading={item.loading}
          />
        ))}
      </div>

      <div className="soha-overview-summary-grid">
        <Card
          className="soha-overview-panel-card"
          title="Provider 运行"
          extra={
            <Button
              size="small"
              icon={<KeyOutlined />}
              onClick={() => navigate('/identity/providers')}
            >
              Provider
            </Button>
          }
        >
          {permissions.providers ? (
            <div className="soha-overview-alert-stack">
              <OverviewSectionBar
                title="协议层"
                description="按后端 runtime capability 查看协议支持与启用状态。"
                extra={
                  <Button
                    type="text"
                    icon={<ApiOutlined />}
                    onClick={() => navigate('/identity/providers')}
                  >
                    管理 Provider
                  </Button>
                }
              />
              <div className="soha-overview-chip-grid soha-identity-overview-chip-grid">
                {protocolStatus.map((item) => (
                  <OverviewChip
                    key={item.key}
                    label={item.label}
                    value={item.value}
                    helper={item.helper}
                    icon={item.icon}
                    tone={item.tone}
                  />
                ))}
              </div>
            </div>
          ) : (
            <ManagementState
              compact
              bordered={false}
              kind="no-permission"
              title="无 Provider 权限"
            />
          )}
        </Card>

        <Card
          className="soha-overview-panel-card soha-identity-overview-audit-card"
          title="最近审计"
          extra={
            <Button size="small" icon={<AuditOutlined />} onClick={() => navigate('/system/audit')}>
              审计
            </Button>
          }
        >
          {!permissions.audit ? (
            <ManagementState compact bordered={false} kind="no-permission" title="无审计权限" />
          ) : audits.length === 0 ? (
            <ManagementState compact bordered={false} kind="empty" title="暂无审计记录" />
          ) : (
            <div className="soha-overview-attention-list soha-identity-overview-audit-list">
              {audits.slice(0, 6).map((item) => (
                <div key={item.id} className="soha-overview-attention-row">
                  <div className="soha-overview-attention-main">
                    <Space size={6} wrap>
                      {resultTag(item.result)}
                      <Text strong>{item.action}</Text>
                    </Space>
                    <div className="soha-overview-inline-caption">
                      {item.summary || item.resourceName || item.resourceKind || '-'}
                    </div>
                  </div>
                  <div className="soha-overview-attention-meta">
                    <span>{formatDateTime(item.createdAt)}</span>
                    <span>{item.actorName || item.actorId || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="soha-overview-runtime-card" title="运行入口">
        <div className="soha-overview-chip-grid soha-identity-overview-chip-grid">
          {operationStats.map((item) => (
            <OverviewChip
              key={item.key}
              label={item.label}
              value={item.value}
              helper={item.helper}
              icon={item.icon}
              tone={item.tone}
            />
          ))}
        </div>
        <div className="soha-identity-overview-actions">
          <Button
            disabled={!permissions.applications}
            icon={<AppstoreOutlined />}
            onClick={() => navigate('/identity/applications')}
          >
            应用目录
          </Button>
          <Button
            disabled={!permissions.providers}
            icon={<ApiOutlined />}
            onClick={() => navigate('/identity/providers')}
          >
            Provider 管理
          </Button>
          <Button
            disabled={!permissions.outposts}
            icon={<LinkOutlined />}
            onClick={() => navigate('/identity/outposts')}
          >
            Outpost 管理
          </Button>
          <Button
            disabled={!permissions.sessions}
            icon={<UserSwitchOutlined />}
            onClick={() => navigate('/system/online-users')}
          >
            在线用户
          </Button>
          <Button
            disabled={!permissions.audit}
            icon={<AuditOutlined />}
            onClick={() => navigate('/system/audit')}
          >
            审计事件
          </Button>
          <Button icon={<LinkOutlined />} onClick={() => navigate('/portal')}>
            门户首页
          </Button>
        </div>
      </Card>
    </div>
  )
}
