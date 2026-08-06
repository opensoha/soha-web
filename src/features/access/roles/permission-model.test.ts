import type { PermissionCatalog } from '@opensoha/contracts/gen/ts/sohaapi'
import permissionCatalogArtifact from '@opensoha/contracts/auth/permission-catalog.json'
import type { DataNode } from 'antd/es/tree'
import { describe, expect, it } from 'vitest'
import { buildRolePermissionTreeData } from './permission-model'

const definitions = (permissionCatalogArtifact as PermissionCatalog).permissions

function nodePath(nodes: DataNode[], targetKey: string, parents: string[] = []): string[] {
  for (const node of nodes) {
    const path = [...parents, String(node.key)]
    if (String(node.key) === targetKey) return path
    const childPath = nodePath((node.children ?? []) as DataNode[], targetKey, path)
    if (childPath.length) return childPath
  }
  return []
}

function treeKeys(nodes: DataNode[]): string[] {
  return nodes.flatMap((node) => [
    String(node.key),
    ...treeKeys((node.children ?? []) as DataNode[]),
  ])
}

function findNode(nodes: DataNode[], targetKey: string): DataNode | undefined {
  for (const node of nodes) {
    if (String(node.key) === targetKey) return node
    const child = findNode((node.children ?? []) as DataNode[], targetKey)
    if (child) return child
  }
}

describe('role permission tree model', () => {
  it('places sensitive reads under their owning menus', () => {
    const tree = buildRolePermissionTreeData(definitions)
    expect(nodePath(tree, 'permission:platform.configuration.secret-data.view')).toContain(
      'route:configuration-secrets',
    )
    expect(nodePath(tree, 'permission:platform.helm.values.view')).toContain('route:helm-releases')
  })

  it('places exact workload operations under their owning pages', () => {
    const tree = buildRolePermissionTreeData(definitions)
    for (const permissionKey of [
      'platform.deployment.create',
      'platform.deployment.delete',
      'platform.deployment.restart',
      'platform.deployment.rollback',
      'platform.deployment.scale',
      'platform.deployment.update',
      'platform.deployment.view',
    ]) {
      expect(nodePath(tree, `permission:${permissionKey}`)).toContain('route:workloads-deployments')
    }
    expect(nodePath(tree, 'permission:platform.pods.exec')).toContain('route:workloads-pods')
  })

  it.each([
    ['platform.workloads.overview.view', 'workloads-overview'],
    ['platform.network.topology.view', 'network-topology'],
    ['platform.observability.logging.enable', 'clusters'],
    ['platform.observability.logging.disable', 'clusters'],
    ['platform.rbac.bind', 'platform-access-control'],
    ['platform.rbac.escalate', 'platform-access-control'],
  ])('places %s under its owning page', (permissionKey, routeID) => {
    expect(
      nodePath(buildRolePermissionTreeData(definitions), `permission:${permissionKey}`),
    ).toContain(`route:${routeID}`)
  })

  it.each([
    ['workspace.resource.view', 'workbench:platform'],
    ['workspace.application.view', 'workbench:delivery'],
  ])('places %s on its workbench entry', (permissionKey, workbenchID) => {
    const path = nodePath(buildRolePermissionTreeData(definitions), `permission:${permissionKey}`)
    expect(path).toContain(workbenchID)
    expect(path.some((key) => key.startsWith('permissions:'))).toBe(false)
  })

  it('does not leave Kubernetes permissions in an unowned domain bucket', () => {
    const platform = findNode(buildRolePermissionTreeData(definitions), 'workbench:platform')
    expect(treeKeys((platform?.children ?? []) as DataNode[])).not.toContain('permissions:platform')
    expect(treeKeys((platform?.children ?? []) as DataNode[])).not.toContain(
      'permissions:workspace',
    )
  })

  it.each([
    ['platform.workloads.replica-sets.view', 'workloads-replicasets'],
    ['platform.workloads.replication-controllers.view', 'workloads-replicationcontrollers'],
    ['platform.workloads.stateful-sets.view', 'workloads-statefulsets'],
    ['platform.workloads.daemon-sets.view', 'workloads-daemonsets'],
    ['platform.workloads.jobs.view', 'workloads-jobs'],
    ['platform.workloads.cron-jobs.view', 'workloads-cronjobs'],
    ['platform.configuration.config-maps.view', 'configuration-configmaps'],
    ['platform.configuration.secrets.view', 'configuration-secrets'],
    ['platform.network.services.view', 'network-services'],
    ['platform.network.ingresses.view', 'network-ingresses'],
    ['platform.storage.persistent-volume-claims.view', 'storage-pvc'],
    ['platform.storage.persistent-volumes.view', 'storage-pv'],
    ['platform.access-control.service-accounts.view', 'platform-access-control-serviceaccounts'],
    ['platform.access-control.roles.view', 'platform-access-control-roles'],
  ])('places %s under its exact resource page', (permissionKey, routeID) => {
    expect(
      nodePath(buildRolePermissionTreeData(definitions), `permission:${permissionKey}`),
    ).toContain(`route:${routeID}`)
  })

  it('contains every active assignable catalog permission exactly once', () => {
    const keys = treeKeys(buildRolePermissionTreeData(definitions))
    const permissionKeys = keys.filter((key) => key.startsWith('permission:'))
    const assignableKeys = definitions
      .filter((definition) => definition.assignable && definition.status === 'active')
      .map((definition) => `permission:${definition.key}`)

    expect(new Set(permissionKeys)).toEqual(new Set(assignableKeys))
    expect(new Set(permissionKeys).size).toBe(permissionKeys.length)
  })

  it('uses localized route titles in the permission browser', () => {
    const tree = buildRolePermissionTreeData(definitions, [], (key, fallback) =>
      key === 'route.ai-workbench-agent-providers.title' ? 'Agent 提供方' : (fallback ?? key),
    )

    expect(findNode(tree, 'route:ai-workbench-agent-providers')?.title).toBe('Agent 提供方')
  })

  it('preserves legacy and unknown stored permissions in a disabled compatibility area', () => {
    const tree = buildRolePermissionTreeData(definitions, [
      'ai.gateway.manage',
      'future.permission.view',
    ])
    const compatibility = tree.find((node) => node.key === 'workbench:compatibility')

    expect(compatibility?.children).toHaveLength(2)
    expect(compatibility?.children?.every((node) => node.disabled)).toBe(true)
  })
})
