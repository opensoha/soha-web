export { dockerApi } from './docker-api'
export { dockerKeys } from './keys'
export { dockerMutations } from './mutations'
export { dockerQueries } from './queries'
export { RuntimeHostStepModal } from './hosts/create-page'
export type * from './docker-types'

export const dockerRouteLoaders = {
  hosts: async () => {
    const module = await import('./hosts/page')
    return { default: module.DockerHostsPage }
  },
  projects: async () => {
    const module = await import('./projects/list-page')
    return { default: module.DockerProjectsPage }
  },
  projectDetail: async () => {
    const module = await import('./projects/detail-page')
    return { default: module.DockerProjectDetailPage }
  },
  templates: async () => {
    const module = await import('./templates/page')
    return { default: module.DockerTemplatesPage }
  },
}
