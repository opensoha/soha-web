import type { Cluster } from './types'

export const clusterTypeOptions = [
  { value: 'standard_kubernetes', labelZh: '标准 Kubernetes', labelEn: 'Standard Kubernetes' },
  { value: 'gke', labelZh: 'GKE', labelEn: 'GKE' },
  { value: 'ack', labelZh: 'ACK', labelEn: 'ACK' },
  { value: 'tke', labelZh: 'TKE', labelEn: 'TKE' },
  { value: 'aks', labelZh: 'AKS', labelEn: 'AKS' },
]

export function formatClusterType(value: string | undefined, localeCode: string) {
  const item = clusterTypeOptions.find((option) => option.value === value)
  if (!item) return value || '-'
  return localeCode === 'zh_CN' ? item.labelZh : item.labelEn
}

export function clusterTypeOf(cluster: Pick<Cluster, 'region' | 'labels'>) {
  const provider = cluster.labels?.provider
  return typeof provider === 'string' && provider.trim() !== '' ? provider.trim() : cluster.region
}

export function formatConnectionMode(value: string | undefined, localeCode: string) {
  if (value === 'direct_kubeconfig') return localeCode === 'zh_CN' ? '直连' : 'Direct'
  if (value === 'agent') return 'Agent'
  return value || '-'
}

export function clusterHealthTone(value?: string) {
  const normalized = (value || '').trim().toLowerCase()
  if (['healthy', 'connected', 'ready', 'available', 'running', 'normal'].includes(normalized)) {
    return 'success'
  }
  if (['error', 'failed', 'disconnected', 'critical', 'notready', 'lost'].includes(normalized)) {
    return 'error'
  }
  if (['pending', 'warning', 'queued', 'waiting'].includes(normalized)) return 'warning'
  if (['syncing', 'checking', 'initializing'].includes(normalized)) return 'processing'
  return 'muted'
}

export function formatClusterHealth(value: string | undefined, localeCode: string) {
  const normalized = (value || '').trim().toLowerCase()
  if (localeCode !== 'zh_CN') return value || 'unknown'
  if (['healthy', 'connected', 'ready', 'available', 'running', 'normal'].includes(normalized)) {
    return '正常'
  }
  if (['error', 'failed', 'disconnected', 'critical', 'notready', 'lost'].includes(normalized)) {
    return '异常'
  }
  if (['pending', 'warning', 'queued', 'waiting'].includes(normalized)) return '等待'
  if (['syncing', 'checking', 'initializing'].includes(normalized)) return '同步中'
  return value || '未知'
}
