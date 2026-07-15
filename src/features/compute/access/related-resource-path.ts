import type { ComputeResourceRef } from '@opensoha/contracts/gen/ts/sohaapi'

export function computeRelatedResourcePath(
  resource: Pick<ComputeResourceRef, 'id' | 'kind'>,
): string | null {
  const id = encodeURIComponent(resource.id)
  switch (resource.kind) {
    case 'vm':
      return `/compute/virtualization/vms/${id}`
    case 'project':
      return `/compute/runtimes/projects/${id}`
    case 'runtime_host':
      return '/compute/runtimes/hosts'
    case 'connection':
      return '/compute/virtualization/clusters'
    case 'agent_host':
      return '/compute/access?sourceType=agent_host'
    default:
      return null
  }
}
