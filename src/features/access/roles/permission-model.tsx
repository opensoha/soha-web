import type { PermissionDefinition } from '@opensoha/contracts/gen/ts/sohaapi'
import type { DataNode } from 'antd/es/tree'
import { resolveRoutePermission, routeMeta } from '@/routes/meta'
import { toStringArray } from '../shared/utils'

const ROLE_PERMISSION_WORKBENCH_LABELS: Record<string, string> = {
  platform: 'k8s工作台',
  delivery: '应用交付',
  monitoring: '可观测与值班',
  home: '应用门户',
  ai: 'AI 工作台',
  compute: '计算资源工作台',
  security: '身份与安全',
  settings: '设置中心',
  unknown: '其他权限',
}

const PERMISSION_DOMAIN_WORKBENCH: Record<string, string> = {
  ai: 'ai',
  access: 'settings',
  delivery: 'delivery',
  docker: 'compute',
  identity: 'security',
  observe: 'monitoring',
  overview: 'platform',
  platform: 'platform',
  plugin: 'settings',
  secret: 'settings',
  settings: 'settings',
  system: 'settings',
  virtualization: 'compute',
  workspace: 'platform',
}

const ROUTE_PERMISSION_OWNERS: Record<string, string> = {
  'ai.gateway.approvals.manage': 'ai-gateway-governance',
  'ai.gateway.clients.manage': 'ai-gateway-clients',
  'ai.gateway.grants.manage': 'ai-gateway-governance',
  'ai.gateway.invoke': 'ai-gateway-tokens',
  'ai.gateway.policies.manage': 'ai-gateway-governance',
  'ai.gateway.skills.manage': 'ai-gateway-governance',
  'ai.gateway.tokens.manage': 'ai-gateway-tokens',
  'ai.gateway.view': 'ai-gateway-manifest',
  'platform.configuration.secret-data.view': 'configuration-secrets',
  'platform.helm.values.view': 'helm-releases',
  'platform.observability.logging.disable': 'clusters',
  'platform.observability.logging.enable': 'clusters',
  'platform.rbac.bind': 'platform-access-control',
  'platform.rbac.escalate': 'platform-access-control',
  'platform.deployment.create': 'workloads-deployments',
  'platform.deployment.delete': 'workloads-deployments',
  'platform.deployment.restart': 'workloads-deployments',
  'platform.deployment.rollback': 'workloads-deployments',
  'platform.deployment.scale': 'workloads-deployments',
  'platform.deployment.update': 'workloads-deployments',
  'platform.deployment.view': 'workloads-deployments',
  'platform.pods.delete': 'workloads-pods',
  'platform.pods.exec': 'workloads-pods',
  'platform.pods.logs': 'workloads-pods',
  'platform.pods.view': 'workloads-pods',
  'plugin.configure': 'plugins-marketplace',
  'plugin.install': 'plugins-marketplace',
  'plugin.lifecycle': 'plugins-marketplace',
  'plugin.remove': 'plugins-marketplace',
  'plugin.upgrade': 'plugins-marketplace',
  'plugin.view': 'plugins-marketplace',
  'secret.create': 'settings-secrets',
  'secret.revoke': 'settings-secrets',
  'secret.rotate': 'settings-secrets',
  'secret.update': 'settings-secrets',
  'secret.use': 'settings-secrets',
  'secret.view': 'settings-secrets',
}

const PERMISSION_WORKBENCH_OWNERS: Record<string, string> = {
  'workspace.application.view': 'delivery',
  'workspace.resource.view': 'platform',
}

type RolePermissionTreeNode = DataNode & { children?: RolePermissionTreeNode[] }
type Translate = (key: string, fallback?: string) => string

export function normalizePermissionKeys(value: unknown) {
  return toStringArray(value).sort((left, right) => left.localeCompare(right))
}

function permissionTreeKey(permissionKey: string) {
  return `permission:${permissionKey}`
}

function routePermissionKeys(route: (typeof routeMeta)[number]) {
  const keys = route.permissionKeysAny?.length
    ? route.permissionKeysAny
    : [resolveRoutePermission(route)].filter(Boolean)
  return normalizePermissionKeys(keys)
}

function permissionStem(permissionKey: string) {
  return permissionKey.slice(0, Math.max(0, permissionKey.lastIndexOf('.')))
}

function routeDepth(
  route: (typeof routeMeta)[number],
  routeByID: Map<string, (typeof routeMeta)[number]>,
) {
  let depth = 0
  let current = route
  const visited = new Set<string>()
  while (current.parentId && !visited.has(current.parentId)) {
    visited.add(current.parentId)
    const parent = routeByID.get(current.parentId)
    if (!parent) break
    depth += 1
    current = parent
  }
  return depth
}

function normalizeWorkbenchID(route: (typeof routeMeta)[number]) {
  const workbench = route.workbenchId || route.group || 'unknown'
  if (workbench === 'identity') return 'security'
  if (workbench === 'observe') return 'monitoring'
  if (workbench === 'ai-gateway') return 'ai'
  if (workbench === 'access' || workbench === 'system') return 'settings'
  return workbench
}

export function buildRolePermissionTreeData(
  definitions: PermissionDefinition[],
  storedPermissionKeys: string[] = [],
  translate?: Translate,
): DataNode[] {
  const routeItems = routeMeta.filter(
    (route) => route.requiresAuth && route.navVisible && route.menuId,
  )
  const routeByID = new Map(routeItems.map((route) => [route.id, route]))
  const nodeByRouteID = new Map<string, RolePermissionTreeNode>()
  const routeOrder = new Map(routeMeta.map((route, index) => [route.id, index]))

  routeItems.forEach((route) => {
    nodeByRouteID.set(route.id, {
      key: `route:${route.id}`,
      title: translate?.(`route.${route.id}.title`, route.title) ?? route.title,
      children: [],
    })
  })

  const rootsByWorkbench = new Map<string, RolePermissionTreeNode[]>()
  const permissionsByWorkbench = new Map<string, RolePermissionTreeNode[]>()
  routeItems.forEach((route) => {
    const node = nodeByRouteID.get(route.id)
    if (!node) return
    const parent = route.parentId ? nodeByRouteID.get(route.parentId) : null
    if (parent) {
      parent.children = [...(parent.children ?? []), node]
      return
    }
    const workbench = normalizeWorkbenchID(route)
    rootsByWorkbench.set(workbench, [...(rootsByWorkbench.get(workbench) ?? []), node])
  })

  function permissionOwner(permissionKey: string) {
    const explicitOwner = ROUTE_PERMISSION_OWNERS[permissionKey]
    if (explicitOwner && nodeByRouteID.has(explicitOwner)) return explicitOwner

    const targetStem = permissionStem(permissionKey)
    return routeItems
      .flatMap((route) =>
        routePermissionKeys(route)
          .filter((routePermissionKey) => {
            const stem = permissionStem(routePermissionKey)
            return (
              routePermissionKey === permissionKey ||
              targetStem === stem ||
              targetStem.startsWith(`${stem}.`)
            )
          })
          .map((routePermissionKey) => ({
            id: route.id,
            exactRank: routePermissionKey === permissionKey ? 0 : 1,
            aggregateRank: route.permissionKeysAny?.length ? 1 : 0,
            stemLength: permissionStem(routePermissionKey).length,
            depth: routeDepth(route, routeByID),
            order: routeOrder.get(route.id) ?? 0,
          })),
      )
      .sort(
        (left, right) =>
          left.exactRank - right.exactRank ||
          left.aggregateRank - right.aggregateRank ||
          right.stemLength - left.stemLength ||
          right.depth - left.depth ||
          left.order - right.order,
      )[0]?.id
  }

  const assignableDefinitions = definitions.filter(
    (definition) => definition.assignable && definition.status === 'active',
  )
  assignableDefinitions.forEach((definition) => {
    const node: RolePermissionTreeNode = {
      key: permissionTreeKey(definition.key),
      title:
        definition.riskLevel === 'high'
          ? `${definition.displayName} · 高风险`
          : definition.displayName,
    }
    const owner = permissionOwner(definition.key)
    const ownerNode = owner ? nodeByRouteID.get(owner) : null
    if (ownerNode) {
      ownerNode.children = [...(ownerNode.children ?? []), node]
      return
    }
    const workbenchOwner = PERMISSION_WORKBENCH_OWNERS[definition.key]
    if (workbenchOwner) {
      permissionsByWorkbench.set(workbenchOwner, [
        ...(permissionsByWorkbench.get(workbenchOwner) ?? []),
        node,
      ])
      return
    }
    const workbench = PERMISSION_DOMAIN_WORKBENCH[definition.domain] || 'unknown'
    const roots = rootsByWorkbench.get(workbench) ?? []
    const domainKey = `permissions:${definition.domain}`
    const domainNode = roots.find((root) => root.key === domainKey)
    if (domainNode) {
      domainNode.children = [...(domainNode.children ?? []), node]
    } else {
      roots.push({
        key: domainKey,
        title:
          translate?.(`permission.domain.${definition.domain}`, definition.domain) ??
          definition.domain,
        children: [node],
      })
    }
    rootsByWorkbench.set(workbench, roots)
  })

  const pruneEmptyNodes = (nodes: RolePermissionTreeNode[]): RolePermissionTreeNode[] =>
    nodes
      .map((node) => {
        const children = pruneEmptyNodes(node.children ?? [])
        return children.length ? { ...node, children } : node
      })
      .filter(
        (node) => String(node.key).startsWith('permission:') || (node.children?.length ?? 0) > 0,
      )

  const workbenchTree = Array.from(rootsByWorkbench.entries())
    .map(([workbench, children]) => {
      const title = ROLE_PERMISSION_WORKBENCH_LABELS[workbench] || workbench
      const prunedChildren = pruneEmptyNodes(
        children.sort((left, right) => {
          const leftID = String(left.key).replace('route:', '')
          const rightID = String(right.key).replace('route:', '')
          return (routeOrder.get(leftID) ?? 0) - (routeOrder.get(rightID) ?? 0)
        }),
      )
      return {
        key: `workbench:${workbench}`,
        title,
        children: [
          ...(permissionsByWorkbench.get(workbench) ?? []),
          ...prunedChildren.flatMap((node) =>
            String(node.title).replace(/\s/g, '').toLowerCase() ===
              title.replace(/\s/g, '').toLowerCase() && node.children?.length
              ? node.children
              : [node],
          ),
        ],
      }
    })
    .filter((node) => node.children.length > 0)

  const assignableKeys = new Set(assignableDefinitions.map((definition) => definition.key))
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]))
  const compatibilityKeys = normalizePermissionKeys(storedPermissionKeys).filter(
    (permissionKey) => !assignableKeys.has(permissionKey),
  )
  if (compatibilityKeys.length) {
    workbenchTree.push({
      key: 'workbench:compatibility',
      title: '兼容权限（只读）',
      children: compatibilityKeys.map((permissionKey) => {
        const definition = definitionByKey.get(permissionKey)
        return {
          key: permissionTreeKey(permissionKey),
          title: definition
            ? `${definition.displayName} (${permissionKey})`
            : `未知权限 (${permissionKey})`,
          disabled: true,
        }
      }),
    })
  }

  return workbenchTree
}
