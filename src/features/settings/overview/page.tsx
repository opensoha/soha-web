import {
  ArrowRightOutlined,
  AuditOutlined,
  HistoryOutlined,
  FileProtectOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card } from 'antd'
import { Link } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import {
  OverviewMetricCard,
  type OverviewChipItem,
  type OverviewMetricItem,
} from '@/components/overview-visuals'
import { accessQueries } from '@/features/access'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { systemQueries } from '@/features/system'
import './styles.css'

export function SettingsOverviewPage() {
  const permissionQuery = usePermissionSnapshot()
  const permissions = permissionQuery.data?.data
  const canViewUsers = hasPermission(permissions, 'access.users.view')
  const canViewRoles = hasPermission(permissions, 'access.roles.view')
  const canViewTeams = hasPermission(permissions, 'access.groups.view')
  const canViewPolicies = hasPermission(permissions, 'access.policies.view')
  const canViewOnlineUsers = hasPermission(permissions, 'system.online-users.view')
  const canViewAudit = hasPermission(permissions, 'system.audit.view')
  const canViewOperations = hasPermission(permissions, 'system.operations.view')
  const usersQuery = useQuery(accessQueries.users(canViewUsers))
  const rolesQuery = useQuery(accessQueries.roles(canViewRoles))
  const teamsQuery = useQuery(accessQueries.teams(canViewTeams))
  const policiesQuery = useQuery(accessQueries.policies(canViewPolicies))
  const sessionsQuery = useQuery(systemQueries.sessions(canViewOnlineUsers))
  const auditSummaryQuery = useQuery(systemQueries.auditSummary(canViewAudit))
  const operationSummaryQuery = useQuery(systemQueries.operationSummary(canViewOperations))
  const accessMetricQueries = [usersQuery, rolesQuery, teamsQuery, policiesQuery]
  const hasAccessMetricsError = accessMetricQueries.some((query) => query.isError)
  const hasSystemActivityError = [sessionsQuery, auditSummaryQuery, operationSummaryQuery].some(
    (query) => query.isError,
  )

  const users = usersQuery.data ?? []
  const roles = rolesQuery.data ?? []
  const teams = teamsQuery.data ?? []
  const policies = policiesQuery.data ?? []
  const activeUsers = users.filter((item) => item.status === 'active').length
  const disabledUsers = users.filter((item) => item.status === 'disabled').length
  const sessions = sessionsQuery.data ?? []
  const onlineUsers = new Set(sessions.map((item) => item.userId).filter(Boolean)).size
  const permissionLoading = permissionQuery.isLoading

  const overviewStats = [
    {
      key: 'users',
      label: '用户总数',
      value: canViewUsers && !usersQuery.isError ? users.length : '-',
      helper: !canViewUsers
        ? '无查看权限'
        : usersQuery.isError
          ? '加载失败'
          : `正常 ${activeUsers} · 停用 ${disabledUsers}`,
      icon: <UserOutlined />,
      tone: usersQuery.isError ? 'danger' : 'default',
    },
    {
      key: 'roles',
      label: '角色数',
      value: canViewRoles && !rolesQuery.isError ? roles.length : '-',
      helper: !canViewRoles
        ? '无查看权限'
        : rolesQuery.isError
          ? '加载失败'
          : `${roles.filter((item) => item.userCount > 0).length} 个角色已分配用户`,
      icon: <SafetyCertificateOutlined />,
      tone: rolesQuery.isError ? 'danger' : 'default',
    },
    {
      key: 'teams',
      label: '组织数',
      value: canViewTeams && !teamsQuery.isError ? teams.length : '-',
      helper: !canViewTeams
        ? '无查看权限'
        : teamsQuery.isError
          ? '加载失败'
          : `${teams.filter((item) => item.userCount > 0).length} 个组织已有成员`,
      icon: <TeamOutlined />,
      tone: teamsQuery.isError ? 'danger' : 'default',
    },
    {
      key: 'policies',
      label: '访问策略',
      value: canViewPolicies && !policiesQuery.isError ? policies.length : '-',
      helper: !canViewPolicies
        ? '无查看权限'
        : policiesQuery.isError
          ? '加载失败'
          : `允许 ${policies.filter((item) => item.effect === 'allow').length} · 拒绝 ${policies.filter((item) => item.effect === 'deny').length}`,
      icon: <FileProtectOutlined />,
      tone: policiesQuery.isError ? 'danger' : 'default',
    },
  ] satisfies OverviewMetricItem[]

  const userStatus = [
    {
      key: 'active',
      label: '正常用户',
      value: activeUsers,
      helper: '当前可正常登录',
      tone: 'success',
    },
    {
      key: 'disabled',
      label: '停用用户',
      value: disabledUsers,
      helper: '当前已禁止登录',
      tone: 'warning',
    },
    {
      key: 'no-role',
      label: '未分配角色',
      value: users.filter((item) => item.roles.length === 0).length,
      helper: '尚未获得角色权限',
      tone: 'default',
    },
    {
      key: 'no-team',
      label: '未加入组织',
      value: users.filter((item) => item.teams.length === 0).length,
      helper: '尚未加入任何组织',
      tone: 'default',
    },
  ] satisfies OverviewChipItem[]

  const systemActivity = [
    ...(canViewOnlineUsers && !sessionsQuery.isError
      ? [
          {
            key: 'online-users',
            label: '在线用户',
            value: onlineUsers,
            helper: `${sessions.length} 个活跃会话`,
            tone: 'success' as const,
            icon: <TeamOutlined />,
            path: '/system/online-users',
            action: '查看会话',
          },
        ]
      : []),
    ...(canViewOperations && !operationSummaryQuery.isError
      ? [
          {
            key: 'operations',
            label: '操作记录',
            value: operationSummaryQuery.data?.total ?? 0,
            helper: `失败 ${operationSummaryQuery.data?.failureCount ?? 0}`,
            tone: (operationSummaryQuery.data?.failureCount ?? 0) > 0 ? 'warning' : 'default',
            icon: <HistoryOutlined />,
            path: '/system/operations',
            action: '查看操作',
          } as const,
        ]
      : []),
    ...(canViewAudit && !auditSummaryQuery.isError
      ? [
          {
            key: 'audit',
            label: '审计记录',
            value: auditSummaryQuery.data?.total ?? 0,
            helper: `保留 ${auditSummaryQuery.data?.retentionDays ?? 0} 天`,
            tone: 'default' as const,
            icon: <AuditOutlined />,
            path: '/system/audit',
            action: '查看审计',
          },
        ]
      : []),
  ]

  if (permissionQuery.isError) {
    return (
      <div className="soha-page soha-settings-overview">
        <ManagementState
          kind="error"
          actions={
            <Button
              onClick={() => {
                void permissionQuery.refetch()
              }}
            >
              重试
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="soha-page soha-overview-page soha-settings-overview">
      {hasAccessMetricsError ? (
        <ManagementState
          bordered={false}
          compact
          kind="error"
          title="部分访问治理数据加载失败"
          actions={
            <Button
              onClick={() => {
                for (const query of accessMetricQueries) {
                  if (query.isError) void query.refetch()
                }
              }}
            >
              重试失败项
            </Button>
          }
        />
      ) : null}
      <div className="soha-overview-metric-grid">
        {overviewStats.map(({ key, ...item }, index) => (
          <OverviewMetricCard
            key={key}
            {...item}
            loading={
              permissionLoading ||
              [usersQuery, rolesQuery, teamsQuery, policiesQuery][index].isLoading
            }
          />
        ))}
      </div>

      <div className="soha-settings-overview-panels">
        <Card
          className="soha-overview-panel-card"
          title="账户与权限"
          extra={
            canViewUsers ? (
              <Link to="/access/users">
                查看用户 <ArrowRightOutlined />
              </Link>
            ) : null
          }
          loading={permissionLoading || (canViewUsers && usersQuery.isLoading)}
        >
          {canViewUsers && !usersQuery.isError ? (
            <>
              <div className="soha-settings-account-summary">
                {userStatus.slice(0, 2).map((item) => (
                  <div key={item.key} className={`soha-settings-account-stat is-${item.tone}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.helper}</small>
                  </div>
                ))}
              </div>
              <div className="soha-settings-account-membership">
                {userStatus.slice(2).map((item) => (
                  <div key={item.key} className="soha-settings-account-row">
                    <div>
                      <span>{item.label}</span>
                      <small>{item.helper}</small>
                    </div>
                    <strong>
                      {item.value}
                      <small> 人</small>
                    </strong>
                  </div>
                ))}
              </div>
            </>
          ) : usersQuery.isError ? (
            <ManagementState compact bordered={false} kind="error" title="用户状态加载失败" />
          ) : (
            <ManagementState compact bordered={false} kind="no-permission" />
          )}
        </Card>

        <Card
          className="soha-overview-panel-card"
          title="系统活动"
          loading={
            permissionLoading ||
            (canViewOnlineUsers && sessionsQuery.isLoading) ||
            (canViewAudit && auditSummaryQuery.isLoading) ||
            (canViewOperations && operationSummaryQuery.isLoading)
          }
        >
          {hasSystemActivityError ? (
            <ManagementState
              bordered={false}
              compact
              kind="error"
              title="部分系统活动加载失败"
              actions={
                <Button
                  onClick={() => {
                    if (sessionsQuery.isError) void sessionsQuery.refetch()
                    if (auditSummaryQuery.isError) void auditSummaryQuery.refetch()
                    if (operationSummaryQuery.isError) void operationSummaryQuery.refetch()
                  }}
                >
                  重试失败项
                </Button>
              }
            />
          ) : null}
          {systemActivity.length ? (
            <div className="soha-settings-activity-list">
              {systemActivity.map((item) => (
                <div key={item.key} className={`soha-settings-activity-row is-${item.tone}`}>
                  <span className="soha-settings-activity-icon">{item.icon}</span>
                  <div className="soha-settings-activity-copy">
                    <span>
                      {item.label}
                      <strong>{item.value}</strong>
                    </span>
                    <small>{item.helper}</small>
                  </div>
                  <Link to={item.path}>
                    {item.action} <ArrowRightOutlined />
                  </Link>
                </div>
              ))}
            </div>
          ) : !hasSystemActivityError ? (
            <ManagementState compact bordered={false} kind="no-permission" />
          ) : null}
        </Card>
      </div>
    </div>
  )
}
