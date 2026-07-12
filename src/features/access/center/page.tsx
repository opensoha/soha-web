import { Navigate } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'

export function AccessCenterPage() {
  const permissionSnapshotQuery = usePermissionSnapshot()
  const snapshot = permissionSnapshotQuery.data?.data
  const firstAccessiblePath = hasPermission(snapshot, 'access.users.view')
    ? '/access/users'
    : hasPermission(snapshot, 'access.roles.view')
      ? '/access/roles'
      : hasPermission(snapshot, 'access.groups.view')
        ? '/access/teams'
        : hasPermission(snapshot, 'access.policies.view')
          ? '/access/policies'
          : null

  if (permissionSnapshotQuery.isLoading) {
    return (
      <div className="soha-page">
        <div className="flex items-center justify-center h-32">加载中...</div>
      </div>
    )
  }

  if (!firstAccessiblePath) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有访问控制页面权限。" />
      </div>
    )
  }

  return <Navigate to={firstAccessiblePath} replace />
}
