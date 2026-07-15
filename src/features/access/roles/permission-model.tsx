import type { DataNode } from 'antd/es/tree'
import { consolePermissionGroups, consolePermissionLabelMap } from '@/features/auth'
import { resolveRoutePermission, routeMeta } from '@/routes/meta'
import { ACCESS_ACTION_LABEL_MAP, ACCESS_ACTION_OPTIONS } from '../shared/options'
import { toStringArray } from '../shared/utils'

export { ACCESS_ACTION_LABEL_MAP, ACCESS_ACTION_OPTIONS }

const ROLE_PERMISSION_WORKBENCH_LABELS: Record<string, string> = {
  platform: '平台工作台',
  delivery: '应用交付',
  monitoring: '可观测与值班',
  ai: 'AI 工作台',
  aiGateway: 'AI Gateway',
  virtualization: '虚拟化',
  docker: 'Docker 工作台',
  settings: '设置中心',
  unknown: '其他菜单',
}

export function normalizePermissionKeys(value: unknown) {
  return toStringArray(value).sort((left, right) => left.localeCompare(right))
}

function permissionTreeKey(permissionKey: string) {
  return `permission:${permissionKey}`
}

function permissionFromTreeKey(key: string) {
  return key.startsWith('permission:') ? key.slice('permission:'.length) : ''
}

function routePermissionKeys(route: (typeof routeMeta)[number]) {
  const keys = route.permissionKeysAny?.length
    ? route.permissionKeysAny
    : [resolveRoutePermission(route)].filter(Boolean)
  return normalizePermissionKeys(keys)
}

function buildRolePermissionTreeData(): DataNode[] {
  const coveredRoutePermissionSet = new Set<string>()
  const emittedRoutePermissionSet = new Set<string>()
  const routeItems = routeMeta.filter(
    (route) => route.requiresAuth && route.navVisible && route.menuId,
  )
  const nodeByRouteID = new Map<string, DataNode & { children?: DataNode[] }>()
  const routeOrder = new Map(routeMeta.map((route, index) => [route.id, index]))

  routeItems.forEach((route) => {
    const permissions = routePermissionKeys(route)
    permissions.forEach((permissionKey) => coveredRoutePermissionSet.add(permissionKey))
    const uniquePermissions = permissions.filter((permissionKey) => {
      if (emittedRoutePermissionSet.has(permissionKey)) return false
      emittedRoutePermissionSet.add(permissionKey)
      return true
    })
    nodeByRouteID.set(route.id, {
      key: `route:${route.id}`,
      title: route.title,
      children: uniquePermissions.map((permissionKey) => ({
        key: permissionTreeKey(permissionKey),
        title: consolePermissionLabelMap[permissionKey]
          ? `${consolePermissionLabelMap[permissionKey]} (${permissionKey})`
          : permissionKey,
      })),
    })
  })

  const rootsByWorkbench = new Map<string, Array<DataNode & { children?: DataNode[] }>>()
  routeItems.forEach((route) => {
    const node = nodeByRouteID.get(route.id)
    if (!node) return
    const parent = route.parentId ? nodeByRouteID.get(route.parentId) : null
    if (parent) {
      parent.children = [...(parent.children ?? []), node]
      return
    }
    const workbench = route.workbenchId || route.group || 'unknown'
    const roots = rootsByWorkbench.get(workbench) ?? []
    roots.push(node)
    rootsByWorkbench.set(workbench, roots)
  })

  const pruneEmptyNodes = (nodes: DataNode[]): DataNode[] =>
    nodes
      .map((node) => {
        const children = pruneEmptyNodes((node.children ?? []) as DataNode[])
        return children.length ? { ...node, children } : node
      })
      .filter(
        (node) => String(node.key).startsWith('permission:') || (node.children?.length ?? 0) > 0,
      )

  const routeTree = Array.from(rootsByWorkbench.entries())
    .map(([workbench, children]) => ({
      key: `workbench:${workbench}`,
      title: ROLE_PERMISSION_WORKBENCH_LABELS[workbench] || workbench,
      children: pruneEmptyNodes(
        children.sort((left, right) => {
          const leftID = String(left.key).replace('route:', '')
          const rightID = String(right.key).replace('route:', '')
          return (routeOrder.get(leftID) ?? 0) - (routeOrder.get(rightID) ?? 0)
        }),
      ),
    }))
    .filter((node) => node.children.length > 0)

  const actionGroups = consolePermissionGroups
    .map((group) => ({
      key: `actions:${group.key}`,
      title: group.label,
      children: group.options
        .filter((option) => !coveredRoutePermissionSet.has(option.value))
        .map((option) => ({
          key: permissionTreeKey(option.value),
          title: `${option.label} (${option.value})`,
        })),
    }))
    .filter((group) => group.children.length > 0)

  return [
    { key: 'menus', title: '菜单与页面', children: routeTree },
    { key: 'actions', title: '页面动作与外部调用', children: actionGroups },
  ]
}

export const rolePermissionTreeData = buildRolePermissionTreeData()

export function checkedPermissionTreeKeys(permissionKeys: unknown) {
  return normalizePermissionKeys(permissionKeys).map(permissionTreeKey)
}

export function extractPermissionKeysFromTreeCheck(checkedKeys: unknown) {
  const rawKeys = Array.isArray(checkedKeys)
    ? checkedKeys
    : Array.isArray((checkedKeys as { checked?: unknown[] })?.checked)
      ? (checkedKeys as { checked: unknown[] }).checked
      : []
  return normalizePermissionKeys(
    rawKeys.map((key) => permissionFromTreeKey(String(key))).filter(Boolean),
  )
}
