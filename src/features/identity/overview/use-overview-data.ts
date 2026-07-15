import { useQuery } from '@tanstack/react-query'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { identityApplicationQueries } from '../applications'
import { identityOutpostQueries } from '../outposts'
import { identityProviderQueries } from '../providers'
import { identityOverviewQueries } from './queries'

function hasAnyPermission(snapshot: Parameters<typeof hasPermission>[0], keys: string[]) {
  return keys.some((key) => hasPermission(snapshot, key))
}

export function useIdentityOverviewData() {
  const snapshot = usePermissionSnapshot().data?.data
  const permissions = {
    applications: hasPermission(snapshot, 'identity.applications.view'),
    providers: hasPermission(snapshot, 'identity.providers.view'),
    outposts: hasPermission(snapshot, 'identity.outposts.view'),
    sessions: hasPermission(snapshot, 'system.online-users.view'),
    audit: hasAnyPermission(snapshot, ['identity.audit.view', 'system.audit.view']),
  }

  const applicationsQuery = useQuery({
    ...identityApplicationQueries.list({}),
    enabled: permissions.applications,
  })
  const providersQuery = useQuery({
    ...identityProviderQueries.list(),
    enabled: permissions.providers,
  })
  const outpostsQuery = useQuery({
    ...identityOutpostQueries.list(),
    enabled: permissions.outposts,
  })
  const sessionsQuery = useQuery({
    ...identityOverviewQueries.sessions(),
    enabled: permissions.sessions,
  })
  const auditQuery = useQuery({
    ...identityOverviewQueries.audit(),
    enabled: permissions.audit,
  })

  const refreshAll = () => {
    if (permissions.applications) void applicationsQuery.refetch()
    if (permissions.providers) void providersQuery.refetch()
    if (permissions.outposts) void outpostsQuery.refetch()
    if (permissions.sessions) void sessionsQuery.refetch()
    if (permissions.audit) void auditQuery.refetch()
  }

  return {
    applications: applicationsQuery.data ?? [],
    providers: providersQuery.data ?? [],
    outposts: outpostsQuery.data ?? [],
    sessions: sessionsQuery.data ?? [],
    audits: auditQuery.data ?? [],
    loading: {
      applications: applicationsQuery.isLoading,
      providers: providersQuery.isLoading,
      outposts: outpostsQuery.isLoading,
      sessions: sessionsQuery.isLoading,
    },
    permissions,
    refreshAll,
  }
}
