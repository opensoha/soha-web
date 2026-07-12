import { hasPermission } from '@/features/auth'
import type { PermissionSnapshot } from '@/types'

export function canInstallPlugin(snapshot?: PermissionSnapshot) {
  return hasPermission(snapshot, 'plugin.install')
}

export function canManagePlugins(snapshot?: PermissionSnapshot) {
  return hasPermission(snapshot, 'plugin.manage')
}

export function canConfigurePluginSecrets(snapshot?: PermissionSnapshot) {
  return hasPermission(snapshot, 'plugin.configure_secrets')
}
