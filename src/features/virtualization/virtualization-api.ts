import { api } from '@/services/api-client'
import type { ApiResponse, Cluster } from '@/types'
import type {
  CreateVirtualMachineInput,
  VirtualMachine,
  VirtualMachineDevice,
  VirtualMachineDetail,
  VirtualMachinePowerAction,
  VirtualMachineResizeInput,
  VirtualizationListParams,
  VirtualizationCluster,
  VirtualizationConnectionDeleteDependencies,
  VirtualizationClusterInput,
  VirtualizationConsoleURL,
  VirtualizationFlavor,
  VirtualizationFlavorInput,
  VirtualizationImage,
  VirtualizationImageInput,
  VirtualizationOperation,
  VirtualizationOperationListParams,
  VirtualizationOperationLog,
  VirtualizationPage,
  VirtualizationVMMetrics,
} from './virtualization-types'

const BASE = '/virtualization'

function withQuery(path: string, params: Array<[string, string | number | undefined]>) {
  const search = new URLSearchParams()
  params.forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export const virtualizationApi = {
  platformClusters: async () => {
    const response = await api.get<ApiResponse<Cluster[]>>('/clusters')
    return response.data ?? []
  },
  vms: async (params: VirtualizationListParams = {}) => {
    const response = await api.get<
      ApiResponse<VirtualizationPage<VirtualMachine> | VirtualMachine[]>
    >(withQuery(`${BASE}/vms`, Object.entries(params)))
    return response.data ?? []
  },
  vmDetail: async (id: string) => {
    const response = await api.get<ApiResponse<VirtualMachineDetail>>(
      `${BASE}/vms/${encodeURIComponent(id)}/detail`,
    )
    return response.data
  },
  vmDevices: async (id: string) => {
    const response = await api.get<ApiResponse<VirtualMachineDevice[]>>(
      `${BASE}/vms/${encodeURIComponent(id)}/devices`,
    )
    return response.data ?? []
  },
  createVm: async (payload: CreateVirtualMachineInput) => {
    const response = await api.post<ApiResponse<VirtualizationOperation>>(`${BASE}/vms`, payload)
    return response.data
  },
  powerVm: async (id: string, action: VirtualMachinePowerAction) => {
    const response = await api.post<ApiResponse<VirtualizationOperation>>(
      `${BASE}/vms/${encodeURIComponent(id)}/power`,
      { action },
    )
    return response.data
  },
  resizeVm: async (id: string, payload: VirtualMachineResizeInput) => {
    const response = await api.post<ApiResponse<VirtualizationOperation>>(
      `${BASE}/vms/${encodeURIComponent(id)}/actions`,
      { action: 'resize', ...payload },
    )
    return response.data
  },
  clusters: async () => {
    const response = await api.get<ApiResponse<VirtualizationCluster[]>>(`${BASE}/clusters`)
    return response.data ?? []
  },
  createCluster: async (payload: VirtualizationClusterInput) => {
    const response = await api.post<ApiResponse<VirtualizationCluster>>(`${BASE}/clusters`, payload)
    return response.data
  },
  updateCluster: async (id: string, payload: VirtualizationClusterInput) => {
    const response = await api.put<ApiResponse<VirtualizationCluster>>(
      `${BASE}/clusters/${encodeURIComponent(id)}`,
      payload,
    )
    return response.data
  },
  clusterDeleteDependencies: async (id: string) => {
    const response = await api.get<ApiResponse<VirtualizationConnectionDeleteDependencies>>(
      `${BASE}/clusters/${encodeURIComponent(id)}/delete-dependencies`,
    )
    return response.data
  },
  deleteCluster: async (id: string, options: { force?: boolean } = {}) => {
    await api.delete<ApiResponse<void>>(
      `${BASE}/clusters/${encodeURIComponent(id)}${options.force ? '?force=true' : ''}`,
    )
  },
  testCluster: async (id: string) => {
    const response = await api.post<ApiResponse<VirtualizationOperation>>(
      `${BASE}/clusters/${encodeURIComponent(id)}/test`,
    )
    return response.data
  },
  syncCluster: async (id: string) => {
    const response = await api.post<ApiResponse<VirtualizationOperation>>(
      `${BASE}/clusters/${encodeURIComponent(id)}/sync`,
    )
    return response.data
  },
  images: async (params: VirtualizationListParams = {}) => {
    const response = await api.get<
      ApiResponse<VirtualizationPage<VirtualizationImage> | VirtualizationImage[]>
    >(withQuery(`${BASE}/images`, Object.entries(params)))
    return response.data ?? []
  },
  createImage: async (payload: VirtualizationImageInput) => {
    const response = await api.post<ApiResponse<VirtualizationImage>>(`${BASE}/images`, payload)
    return response.data
  },
  updateImage: async (id: string, payload: VirtualizationImageInput) => {
    const response = await api.put<ApiResponse<VirtualizationImage>>(
      `${BASE}/images/${encodeURIComponent(id)}`,
      payload,
    )
    return response.data
  },
  deleteImage: async (id: string) => {
    await api.delete<ApiResponse<void>>(`${BASE}/images/${encodeURIComponent(id)}`)
  },
  flavors: async () => {
    const response = await api.get<ApiResponse<VirtualizationFlavor[]>>(`${BASE}/flavors`)
    return response.data ?? []
  },
  createFlavor: async (payload: VirtualizationFlavorInput) => {
    const response = await api.post<ApiResponse<VirtualizationFlavor>>(`${BASE}/flavors`, payload)
    return response.data
  },
  updateFlavor: async (id: string, payload: VirtualizationFlavorInput) => {
    const response = await api.put<ApiResponse<VirtualizationFlavor>>(
      `${BASE}/flavors/${encodeURIComponent(id)}`,
      payload,
    )
    return response.data
  },
  deleteFlavor: async (id: string) => {
    await api.delete<ApiResponse<void>>(`${BASE}/flavors/${encodeURIComponent(id)}`)
  },
  operations: async (params: VirtualizationOperationListParams = {}) => {
    const queryParams: Array<[string, string | number | undefined]> = []
    if (params.assetType) queryParams.push(['assetType', params.assetType])
    if (params.taskKind) queryParams.push(['taskKind', params.taskKind])
    if (params.abnormal) queryParams.push(['abnormal', 'true'])
    if (params.pending) queryParams.push(['pending', 'true'])
    if (params.statuses?.length) queryParams.push(['statuses', params.statuses.join(',')])
    if (params.connectionId) queryParams.push(['connectionId', params.connectionId])
    if (params.vmId) queryParams.push(['vmId', params.vmId])
    if (params.search) queryParams.push(['search', params.search])
    const response = await api.get<ApiResponse<VirtualizationOperation[]>>(
      withQuery(`${BASE}/operations`, queryParams),
    )
    return response.data ?? []
  },
  operationLogs: async (id: string) => {
    const response = await api.get<ApiResponse<VirtualizationOperationLog[]>>(
      `${BASE}/operations/${encodeURIComponent(id)}/logs`,
    )
    return response.data ?? []
  },
  cancelOperation: async (id: string) => {
    const response = await api.post<ApiResponse<VirtualizationOperation>>(
      `${BASE}/operations/${encodeURIComponent(id)}/cancel`,
    )
    return response.data
  },
  retryOperation: async (id: string) => {
    const response = await api.post<ApiResponse<VirtualizationOperation>>(
      `${BASE}/operations/${encodeURIComponent(id)}/retry`,
    )
    return response.data
  },
  syncAll: async () => {
    const response = await api.post<ApiResponse<VirtualizationOperation>>(`${BASE}/sync`)
    return response.data
  },
  vmMetrics: async (id: string, rangeMinutes = 60, stepSeconds = 60) => {
    const response = await api.get<ApiResponse<VirtualizationVMMetrics>>(
      `${BASE}/vms/${encodeURIComponent(id)}/metrics?rangeMinutes=${rangeMinutes}&stepSeconds=${stepSeconds}`,
    )
    return response.data
  },
  vmConsoleURL: async (id: string) => {
    const response = await api.get<ApiResponse<VirtualizationConsoleURL>>(
      `${BASE}/vms/${encodeURIComponent(id)}/console`,
    )
    return response.data
  },
}
