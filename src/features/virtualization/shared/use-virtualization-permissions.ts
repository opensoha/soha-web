import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useWorkbenchModuleEnabled } from '@/features/modules'

export function useVirtualizationPermissions() {
  const permissionSnapshotQuery = usePermissionSnapshot()
  const { moduleEnabled: virtualizationModuleEnabled } = useWorkbenchModuleEnabled('virtualization')
  const snapshot = permissionSnapshotQuery.data?.data
  const hasManage = hasPermission(snapshot, 'virtualization.manage')
  const hasVirtualizationPermission = (key: string) =>
    virtualizationModuleEnabled && (hasPermission(snapshot, key) || hasManage)

  return {
    virtualizationModuleEnabled,
    canManage: virtualizationModuleEnabled && hasManage,
    canManageVMs: hasVirtualizationPermission('virtualization.vms.manage'),
    canManageClusters: hasVirtualizationPermission('virtualization.clusters.manage'),
    canManageImages: hasVirtualizationPermission('virtualization.images.manage'),
    canManageFlavors: hasVirtualizationPermission('virtualization.flavors.manage'),
    canManageOperations: hasVirtualizationPermission('virtualization.operations.manage'),
    canSync: hasVirtualizationPermission('virtualization.sync.manage'),
    canViewMetrics: hasVirtualizationPermission('virtualization.vms.metrics'),
    canAccessConsole: hasVirtualizationPermission('virtualization.vms.console'),
  }
}
