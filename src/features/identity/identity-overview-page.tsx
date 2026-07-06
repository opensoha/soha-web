import { useMemo } from 'react'
import { Button, Card, List, Space, Statistic, Tag, Typography } from 'antd'
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

function enabledTag(enabled: boolean) {
  return <Tag color={enabled ? 'green' : 'default'}>{enabled ? 'Enabled' : 'Disabled'}</Tag>
}

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
  const protocolStatus = useMemo(
    () => [
      {
        key: 'oidc',
        title: 'OIDC Provider',
        count: oidcProviders.length,
        enabled: oidcProviders.some((provider) => provider.enabled && provider.status === 'enabled'),
        path: '/identity/providers?type=oidc',
      },
      {
        key: 'proxy',
        title: 'Proxy Provider',
        count: proxyProviders.length,
        enabled: proxyProviders.some((provider) => provider.enabled && provider.status === 'enabled'),
        path: '/identity/providers?type=proxy',
      },
    ],
    [oidcProviders, proxyProviders],
  )

  const refreshAll = () => {
    void applicationsQuery.refetch()
    void providersQuery.refetch()
    void outpostsQuery.refetch()
    void sessionsQuery.refetch()
    void auditQuery.refetch()
  }

  return (
    <div className="soha-page soha-identity-overview-page">
      <ManagementDetailHeader
        actions={
          <Button icon={<ReloadOutlined />} onClick={refreshAll}>
            刷新
          </Button>
        }
        description="查看 Provider Portal、下游 Provider、活跃会话和身份审计的运行状态。"
        title="Identity Overview"
      />

      <div className="soha-identity-overview-stats">
        <Card variant="outlined">
          <Statistic
            loading={applicationsQuery.isLoading}
            prefix={<AppstoreOutlined />}
            title="Applications"
            value={applications.length}
            suffix={`/ ${enabledApplications.length} enabled`}
          />
          <Text type="secondary">最近更新 {formatDateTime(latestUpdated(applications))}</Text>
        </Card>
        <Card variant="outlined">
          <Statistic
            loading={providersQuery.isLoading}
            prefix={<ApiOutlined />}
            title="Providers"
            value={providers.length}
            suffix={`/ ${enabledProviders.length} enabled`}
          />
          <Text type="secondary">{oidcProviders.length} OIDC / {proxyProviders.length} Proxy</Text>
        </Card>
        <Card variant="outlined">
          <Statistic
            loading={outpostsQuery.isLoading}
            prefix={<LinkOutlined />}
            title="Outposts"
            value={outposts.length}
            suffix={`/ ${onlineOutposts.length} online`}
          />
          <Text type="secondary">Embedded、agent、Kubernetes 和 external</Text>
        </Card>
        <Card variant="outlined">
          <Statistic
            loading={sessionsQuery.isLoading}
            prefix={<UserSwitchOutlined />}
            title="Active Sessions"
            value={sessions.length}
          />
          <Text type="secondary">来自统一登录源与 Provider Portal</Text>
        </Card>
        <Card variant="outlined">
          <Statistic
            loading={auditQuery.isLoading}
            prefix={<AuditOutlined />}
            title="Recent Audit"
            value={audits.length}
          />
          <Text type="secondary">最近身份相关操作和协议访问记录</Text>
        </Card>
      </div>

      <div className="soha-identity-overview-grid">
        <Card
          variant="outlined"
          title="Protocol Layer"
          extra={<Button size="small" icon={<KeyOutlined />} onClick={() => navigate('/identity/providers')}>Providers</Button>}
        >
          <List
            dataSource={protocolStatus}
            renderItem={(item) => (
              <List.Item
                actions={[<Button key="open" size="small" type="link" onClick={() => navigate(item.path)}>打开</Button>]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{item.title}</Text>
                      {enabledTag(item.enabled)}
                    </Space>
                  }
                  description={`${item.count} configured provider${item.count === 1 ? '' : 's'}`}
                />
              </List.Item>
            )}
          />
        </Card>

        <Card
          variant="outlined"
          title="Recent Audit"
          extra={<Button size="small" icon={<AuditOutlined />} onClick={() => navigate('/identity/audit')}>Audit</Button>}
        >
          {canViewAudit ? (
            <List
              dataSource={audits.slice(0, 6)}
              locale={{ emptyText: <ManagementState compact bordered={false} kind="empty" title="暂无审计记录" /> }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space size={6} wrap>
                        {resultTag(item.result)}
                        <Text>{item.action}</Text>
                      </Space>
                    }
                    description={
                      <Space orientation="vertical" size={0}>
                        <Text type="secondary">{item.summary || item.resourceName || item.resourceKind || '-'}</Text>
                        <Text type="secondary">{formatDateTime(item.createdAt)} / {item.actorName || item.actorId || '-'}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <ManagementState compact bordered={false} kind="no-permission" title="无审计权限" />
          )}
        </Card>
      </div>

      <div className="soha-identity-overview-actions">
        <Button icon={<AppstoreOutlined />} onClick={() => navigate('/identity/applications')}>
          应用目录
        </Button>
        <Button icon={<ApiOutlined />} onClick={() => navigate('/identity/providers')}>
          Provider 管理
        </Button>
        <Button disabled={!canViewOutposts} icon={<LinkOutlined />} onClick={() => navigate('/identity/outposts')}>
          Outpost 管理
        </Button>
        <Button disabled={!canViewPolicies} icon={<SafetyCertificateOutlined />} onClick={() => navigate('/identity/policies')}>
          访问策略
        </Button>
        <Button icon={<UserSwitchOutlined />} onClick={() => navigate('/identity/sessions')}>
          会话管理
        </Button>
        <Button icon={<AuditOutlined />} onClick={() => navigate('/identity/audit')}>
          审计事件
        </Button>
        <Button icon={<LinkOutlined />} onClick={() => navigate('/portal')}>
          用户门户
        </Button>
      </div>
    </div>
  )
}
