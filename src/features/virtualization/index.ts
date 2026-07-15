export { virtualizationApi } from './virtualization-api'
export * from './keys'
export * from './mutations'
export { virtualizationQueries } from './queries'
export { VirtualizationConnectionStepModal } from './clusters/create-page'
export type * from './virtualization-types'

export const virtualizationRouteLoaders = {
  vms: async () => {
    const module = await import('./virtual-machines/list-page')
    return { default: module.VirtualizationVmsPage }
  },
  vmDetail: async () => {
    const module = await import('./virtual-machines/detail-page')
    return { default: module.VirtualizationVmDetailPage }
  },
  clusters: async () => {
    const module = await import('./clusters/list-page')
    return { default: module.VirtualizationClustersPage }
  },
  images: async () => {
    const module = await import('./images/list-page')
    return { default: module.VirtualizationImagesPage }
  },
  flavors: async () => {
    const module = await import('./flavors/list-page')
    return { default: module.VirtualizationFlavorsPage }
  },
}
