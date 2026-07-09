import { Button, Card, Space, Tag, Typography } from 'antd'
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
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementDetailHeader, ManagementState } from '@/components/management-list'
import {
  OverviewChip,
  OverviewMetricCard,
  OverviewSectionBar,
  type OverviewChipItem,
  type OverviewMetricItem,
} from '@/components/overview-visuals'
import { hasPermission, usePermissionSnapshot } from '@/features/auth/permission-snapshot'
import { api } from '@/services/api-client'
import { formatDateTime } from '@/utils/time'
import type { ApiResponse } from '@/types'
import type { AuditLog, OnlineUser } from '@/features/system/system-model'
import {
  identityApplicationQueryKeys,
  listIdentityApplications,
} from './identity-applications-api'
import {
  identityProviderQueryKeys,
  listIdentityProviders,
} from './identity-providers-api'
import {
  identityOutpostQueryKeys,
  listIdentityOutposts,
} from './identity-outposts-api'
import './identity-overview-page.css'

const { Text } = Typography

function resultTag(result?: string) {
  const value = result || '-'
  const color = ['success', 'allow', 'published'].includes(value) ? 'green' : ['deny', 'denied', 'failure', 'error'].includes(value) ? 'red' : 'default'
  return <Tag color={color}>{value}</Tag>
}

function latestUpdated(items: Array<{ updatedAt?: string; createdAt?: string }>) {
  const latest = items
    .map((item) => new Date(item.updatedAt || item.createdAt || '').getTime())
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)[0]
  return latest ? new Date(latest).toISOString() : ''
}

function hasAny(snapshot: ReturnType<typeof usePermissionSnapshot>['data'], keys: string[]) {
  return keys.some((key) => hasPermission(snapshot?.data, key))
}

export function IdentityOverviewPage() {
  const navigate = useNavigate()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data
  const canViewApplications = hasPermission(snapshot?.data, 'identity.applications.view')
  const canViewProviders = hasPermission(snapshot?.data, 'identity.providers.view')
  const canViewOutposts = hasPermission(snapshot?.data, 'identity.outposts.view')
  const canViewPolicies = hasPermission(snapshot?.data, 'identity.policies.view')
  const canViewSessions = hasAny(snapshot, ['identity.sessions.view', 'system.online-users.view'])
  const canViewAudit = hasAny(snapshot, ['identity.audit.view', 'system.audit.view'])

  const applicationsQuery = useQuery({
    enabled: canViewApplications,
    queryKey: identityApplicationQueryKeys.applications({}),
    queryFn: () => listIdentityApplications({}),
  })
  const providersQuery = useQuery({
    enabled: canViewProviders,
    queryKey: identityProviderQueryKeys.providers({}),
    queryFn: () => listIdentityProviders({}),
  })
  const outpostsQuery = useQuery({
    enabled: canViewOutposts,
    queryKey: identityOutpostQueryKeys.outposts({}),
    queryFn: () => listIdentityOutposts({}),
  })
  const sessionsQuery = useQuery({
    enabled: canViewSessions,
    queryKey: ['identity', 'overview', 'sessions'],
    queryFn: () => api.get<ApiResponse<OnlineUser[]>>('/identity/sessions').then((response) => response.data ?? []),
  })
  const auditQuery = useQuery({
    enabled: canViewAudit,
    queryKey: ['identity', 'overview', 'audit'],
    queryFn: () => api.get<ApiResponse<AuditLog[]>>('/identity/audit/events?limit=8').then((response) => response.data ?? []),
  })

  const applications = applicationsQuery.data ?? []
  const providers = providersQuery.data ?? []
  const outposts = outpostsQuery.data ?? []
  const sessions = sessionsQuery.data ?? []
  const audits = auditQuery.data ?? []
  const oidcProviders = providers.filter((provider) => provider.type === 'oidc')
  const proxyProviders = providers.filter((provider) => provider.type === 'proxy')
  const enabledProviders = providers.filter((provider) => provider.enabled && provider.status === 'enabled')
  const enabledApplications = applications.filter((application) => application.status === 'enabled')
  const onlineOutposts = outposts.filter((outpost) => outpost.status === 'online')
  const oidcEnabled = oidcProviders.some((provider) => provider.enabled && provider.status === 'enabled')
  const proxyEnabled = proxyProviders.some((provider) => provider.enabled && provider.status === 'enabled')
  const overviewStats = [
    {
      key: 'applications',
      label: '应用目录',
      value: applications.length,
      helper: `${enabledApplications.length} 个已启用 / 最近更新 ${formatDateTime(latestUpdated(applications))}`,
      icon: <AppstoreOutlined />,
      loading: applicationsQuery.isLoading,
      tone: enabledApplications.length > 0 ? 'success' : 'default',
    },
    {
      key: 'providers',
      label: 'Provider',
      value: providers.length,
      helper: `${enabledProviders.length} 个已启用 / ${oidcProviders.length} OIDC / ${proxyProviders.length} Proxy`,
      icon: <ApiOutlined />,
      loading: providersQuery.isLoading,
      tone: enabledProviders.length > 0 ? 'success' : 'default',
    },
    {
      key: 'outposts',
      label: 'Outpost',
      value: outposts.length,
      helper: `${onlineOutposts.length} 个在线 / 支持 Embedded、agent、Kubernetes 和 external`,
      icon: <LinkOutlined />,
      loading: outpostsQuery.isLoading,
      tone: onlineOutposts.length > 0 ? 'success' : 'default',
    },
    {
      key: 'sessions',
      label: '活跃会话',
      value: sessions.length,
      helper: '来自统一登录源与 Provider Portal',
      icon: <UserSwitchOutlined />,
      loading: sessionsQuery.isLoading,
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
      key: 'policies',
      label: '访问策略',
      value: canViewPolicies ? '可查看' : '无权限',
      helper: 'Provider 与应用访问控制',
      icon: <SafetyCertificateOutlined />,
      tone: canViewPolicies ? 'success' : 'warning',
    },
    {
      key: 'audit',
      label: '最近审计',
      value: audits.length,
      helper: '最近身份相关操作和协议访问记录',
      icon: <AuditOutlined />,
      tone: audits.length > 0 ? 'success' : 'default',
    },
  ] satisfies OverviewChipItem[]

  const refreshAll = () => {
    void applicationsQuery.refetch()
    void providersQuery.refetch()
    void outpostsQuery.refetch()
    void sessionsQuery.refetch()
    void auditQuery.refetch()
  }

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
          extra={<Button size="small" icon={<KeyOutlined />} onClick={() => navigate('/identity/providers')}>Provider</Button>}
        >
          {canViewProviders ? (
            <div className="soha-overview-alert-stack">
              <OverviewSectionBar
                title="协议层"
                description="统一查看 OIDC 与 Proxy Provider 的启用状态。"
                extra={
                  <Button type="text" icon={<ApiOutlined />} onClick={() => navigate('/identity/providers')}>
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
            <ManagementState compact bordered={false} kind="no-permission" title="无 Provider 权限" />
          )}
        </Card>

        <Card
          className="soha-overview-panel-card soha-identity-overview-audit-card"
          title="最近审计"
          extra={<Button size="small" icon={<AuditOutlined />} onClick={() => navigate('/identity/audit')}>审计</Button>}
        >
          {!canViewAudit ? (
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
          <Button disabled={!canViewApplications} icon={<AppstoreOutlined />} onClick={() => navigate('/identity/applications')}>
            应用目录
          </Button>
          <Button disabled={!canViewProviders} icon={<ApiOutlined />} onClick={() => navigate('/identity/providers')}>
            Provider 管理
          </Button>
          <Button disabled={!canViewOutposts} icon={<LinkOutlined />} onClick={() => navigate('/identity/outposts')}>
            Outpost 管理
          </Button>
          <Button disabled={!canViewPolicies} icon={<SafetyCertificateOutlined />} onClick={() => navigate('/identity/policies')}>
            访问策略
          </Button>
          <Button disabled={!canViewSessions} icon={<UserSwitchOutlined />} onClick={() => navigate('/identity/sessions')}>
            会话管理
          </Button>
          <Button disabled={!canViewAudit} icon={<AuditOutlined />} onClick={() => navigate('/identity/audit')}>
            审计事件
          </Button>
          <Button icon={<LinkOutlined />} onClick={() => navigate('/portal')}>
            用户门户
          </Button>
        </div>
      </Card>
    </div>
  )
}
