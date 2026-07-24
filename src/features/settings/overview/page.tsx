import {
  ApartmentOutlined,
  FileProtectOutlined,
  LoginOutlined,
  MenuOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ManagementDetailHeader, ManagementState } from '@/components/management-list'
import {
  OverviewChip,
  OverviewMetricCard,
  type OverviewChipItem,
  type OverviewMetricItem,
} from '@/components/overview-visuals'
import { accessQueries } from '@/features/access'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import './styles.css'

export function SettingsOverviewPage() {
  const navigate = useNavigate()
  const permissionQuery = usePermissionSnapshot()
  const permissions = permissionQuery.data?.data
  const canViewUsers = hasPermission(permissions, 'access.users.view')
  const canViewRoles = hasPermission(permissions, 'access.roles.view')
  const canViewTeams = hasPermission(permissions, 'access.groups.view')
  const canViewPolicies = hasPermission(permissions, 'access.policies.view')
  const usersQuery = useQuery(accessQueries.users(canViewUsers))
  const rolesQuery = useQuery(accessQueries.roles(canViewRoles))
  const teamsQuery = useQuery(accessQueries.teams(canViewTeams))
  const policiesQuery = useQuery(accessQueries.policies(canViewPolicies))

  const users = usersQuery.data ?? []
  const roles = rolesQuery.data ?? []
  const teams = teamsQuery.data ?? []
  const policies = policiesQuery.data ?? []
  const activeUsers = users.filter((item) => item.status === 'active').length
  const disabledUsers = users.filter((item) => item.status === 'disabled').length
  const permissionLoading = permissionQuery.isLoading

  const overviewStats = [
    {
      key: 'users',
      label: '用户总数',
      value: canViewUsers ? users.length : '-',
      helper: canViewUsers ? `正常 ${activeUsers} · 停用 ${disabledUsers}` : '无查看权限',
      icon: <UserOutlined />,
      tone: 'default',
    },
    {
      key: 'roles',
      label: '角色数',
      value: canViewRoles ? roles.length : '-',
      helper: canViewRoles
        ? `${roles.filter((item) => item.userCount > 0).length} 个角色已分配用户`
        : '无查看权限',
      icon: <SafetyCertificateOutlined />,
      tone: 'success',
    },
    {
      key: 'teams',
      label: '组织数',
      value: canViewTeams ? teams.length : '-',
      helper: canViewTeams
        ? `${teams.filter((item) => item.userCount > 0).length} 个组织已有成员`
        : '无查看权限',
      icon: <TeamOutlined />,
      tone: 'default',
    },
    {
      key: 'policies',
      label: '访问策略',
      value: canViewPolicies ? policies.length : '-',
      helper: canViewPolicies
        ? `允许 ${policies.filter((item) => item.effect === 'allow').length} · 拒绝 ${policies.filter((item) => item.effect === 'deny').length}`
        : '无查看权限',
      icon: <FileProtectOutlined />,
      tone: 'warning',
    },
  ] satisfies OverviewMetricItem[]

  const userStatus = [
    { key: 'active', label: '正常用户', value: activeUsers, tone: 'success' },
    { key: 'disabled', label: '停用用户', value: disabledUsers, tone: 'warning' },
    {
      key: 'no-role',
      label: '未分配角色',
      value: users.filter((item) => item.roles.length === 0).length,
      tone: 'default',
    },
    {
      key: 'no-team',
      label: '未加入组织',
      value: users.filter((item) => item.teams.length === 0).length,
      tone: 'default',
    },
  ] satisfies OverviewChipItem[]

  const quickActions = [
    canViewUsers && { key: 'users', label: '用户管理', path: '/access/users', icon: <UserOutlined /> },
    canViewRoles && {
      key: 'roles',
      label: '角色管理',
      path: '/access/roles',
      icon: <SafetyCertificateOutlined />,
    },
    canViewTeams && {
      key: 'teams',
      label: '组织管理',
      path: '/access/teams',
      icon: <ApartmentOutlined />,
    },
    canViewPolicies && {
      key: 'policies',
      label: '策略管理',
      path: '/access/policies',
      icon: <FileProtectOutlined />,
    },
    hasPermission(permissions, 'settings.identity.view') && {
      key: 'login',
      label: '登录设置',
      path: '/settings/login',
      icon: <LoginOutlined />,
    },
    hasPermission(permissions, 'system.menus.view') && {
      key: 'menus',
      label: '菜单管理',
      path: '/system/menus',
      icon: <MenuOutlined />,
    },
  ].filter((item): item is Exclude<typeof item, false | undefined> => Boolean(item))

  return (
    <div className="soha-page soha-overview-page soha-settings-overview">
      <ManagementDetailHeader title="总览" description="用户、角色、组织与访问策略的管理概览。" />

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

      <div className="soha-overview-summary-grid">
        <Card className="soha-overview-panel-card" title="用户状态">
          {canViewUsers ? (
            <div className="soha-settings-overview-chip-grid">
              {userStatus.map(({ key, ...item }) => (
                <OverviewChip key={key} {...item} />
              ))}
            </div>
          ) : (
            <ManagementState compact bordered={false} kind="no-permission" />
          )}
        </Card>

        <Card className="soha-overview-panel-card" title="常用操作">
          {quickActions.length ? (
            <div className="soha-settings-overview-actions">
              {quickActions.map((item) => (
                <Button key={item.key} icon={item.icon} onClick={() => navigate(item.path)}>
                  {item.label}
                </Button>
              ))}
            </div>
          ) : (
            <ManagementState compact bordered={false} kind="no-permission" />
          )}
        </Card>
      </div>
    </div>
  )
}
