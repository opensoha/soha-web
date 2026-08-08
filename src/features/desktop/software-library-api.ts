export interface DesktopSoftwarePackage {
  id: string
  name: string
  description?: string
  publisher: string
  category?: string
  version: string
  size: number
}

export type SoftwareInstallState =
  'queued' | 'downloading' | 'verifying' | 'opening' | 'completed' | 'failed'

export interface SoftwareInstallTask {
  id: string
  softwareId: string
  name: string
  state: SoftwareInstallState
  progress: number
  message: string
}

async function readJSON<T>(response: Response): Promise<T> {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('桌面运行时暂不可用')
  }
  const result = (await response.json()) as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(result.error?.message || '请求失败')
  return result
}

function softwareRequest(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers)
  const accessToken = getStoredAccessToken()
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  return fetch(path, { ...options, headers })
}

export async function getSoftwareCatalog() {
  const response = await softwareRequest('/app/v1/software')
  const result = await readJSON<{ items: DesktopSoftwarePackage[] }>(response)
  return result.items
}

export async function installSoftware(id: string) {
  const response = await softwareRequest(`/app/v1/software/${encodeURIComponent(id)}/install`, {
    method: 'POST',
  })
  const result = await readJSON<{ task: SoftwareInstallTask }>(response)
  return result.task
}

export async function getSoftwareInstallTask(id: string) {
  const response = await softwareRequest(`/app/v1/software/tasks/${encodeURIComponent(id)}`)
  const result = await readJSON<{ task: SoftwareInstallTask }>(response)
  return result.task
}
import { getStoredAccessToken } from '@/features/auth'
