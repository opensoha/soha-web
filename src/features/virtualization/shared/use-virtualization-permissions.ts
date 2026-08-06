import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useWorkbenchModuleEnabled } from '@/features/modules'

export function useVirtualizationPermissions() {
  const permissionSnapshotQuery = usePermissionSnapshot()
  const { moduleEnabled: virtualizationModuleEnabled } = useWorkbenchModuleEnabled('virtualization')
  const snapshot = permissionSnapshotQuery.data?.data
  const hasVirtualizationPermission = (key: string) =>
    virtualizationModuleEnabled && hasPermission(snapshot, key)
  const canCreateVMs = hasVirtualizationPermission('virtualization.vms.create')
  const canPowerVMs = hasVirtualizationPermission('virtualization.vms.power')
  const canResizeVMs = hasVirtualizationPermission('virtualization.vms.resize')
  const canDeleteVMs = hasVirtualizationPermission('virtualization.vms.delete')

  return {
    virtualizationModuleEnabled,
    canCreateVMs,
    canManageVMs: canCreateVMs || canPowerVMs || canResizeVMs || canDeleteVMs,
    canCreateClusters: hasVirtualizationPermission('virtualization.clusters.create'),
    canUpdateClusters: hasVirtualizationPermission('virtualization.clusters.update'),
    canDeleteClusters: hasVirtualizationPermission('virtualization.clusters.delete'),
    canTestClusters: hasVirtualizationPermission('virtualization.clusters.test'),
    canSyncClusters: hasVirtualizationPermission('virtualization.clusters.sync'),
    canCreateImages: hasVirtualizationPermission('virtualization.images.create'),
    canUpdateImages: hasVirtualizationPermission('virtualization.images.update'),
    canDeleteImages: hasVirtualizationPermission('virtualization.images.delete'),
    canCreateFlavors: hasVirtualizationPermission('virtualization.flavors.create'),
    canUpdateFlavors: hasVirtualizationPermission('virtualization.flavors.update'),
    canDeleteFlavors: hasVirtualizationPermission('virtualization.flavors.delete'),
    canViewTasks:
      hasVirtualizationPermission('virtualization.operations.view') ||
      hasVirtualizationPermission('virtualization.sync.view'),
    canCancelOperations: hasVirtualizationPermission('virtualization.operations.cancel'),
    canRetryOperations: hasVirtualizationPermission('virtualization.operations.retry'),
    canSync: hasVirtualizationPermission('virtualization.sync.sync'),
    canViewMetrics: hasVirtualizationPermission('virtualization.vms.metrics'),
    canAccessConsole: hasVirtualizationPermission('virtualization.vms.console'),
  }
}
