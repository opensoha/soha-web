import type { PermissionCatalog } from '@opensoha/contracts/gen/ts/sohaapi'
import permissionCatalogArtifact from '@opensoha/contracts/auth/permission-catalog.json'
import { describe, expect, it } from 'vitest'
import { buildRolePermissionTreeData } from './permission-model'
import {
  type PermissionBrowserNode,
  buildRolePermissionBrowserData,
  permissionValuesForNode,
  toggleRolePermissionValues,
} from './permission-browser'

const definitions = (permissionCatalogArtifact as PermissionCatalog).permissions

function flattenNodes(nodes: PermissionBrowserNode[]): PermissionBrowserNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)])
}

describe('role permission browser model', () => {
  it('projects every assignable catalog permission into one page-owned browser', () => {
    const data = buildRolePermissionBrowserData(buildRolePermissionTreeData(definitions))
    const permissionKeys = data.workbenches.flatMap(permissionValuesForNode)
    const assignableKeys = definitions
      .filter((definition) => definition.assignable && definition.status === 'active')
      .map((definition) => definition.key)

    expect(new Set(permissionKeys)).toEqual(new Set(assignableKeys))
    expect(new Set(permissionKeys).size).toBe(permissionKeys.length)
  })

  it('does not render menu branches without permissions', () => {
    const data = buildRolePermissionBrowserData(buildRolePermissionTreeData(definitions))
    expect(
      flattenNodes(data.workbenches).every((node) => permissionValuesForNode(node).length > 0),
    ).toBe(true)
  })

  it('batch toggles a branch without dropping unknown stored permissions', () => {
    expect(
      toggleRolePermissionValues(
        ['future.permission.view', 'platform.configuration.view'],
        ['platform.configuration.view', 'platform.configuration.secret-data.view'],
        false,
      ),
    ).toEqual(['future.permission.view'])

    expect(
      toggleRolePermissionValues(
        ['future.permission.view'],
        ['platform.configuration.view', 'platform.configuration.secret-data.view'],
        true,
      ),
    ).toEqual([
      'future.permission.view',
      'platform.configuration.secret-data.view',
      'platform.configuration.view',
    ])
  })
})
