export interface DesktopAppInfo {
  name: string
  version: string
  platform: string
  arch: string
  updateSupported: boolean
}

const previewInfo: DesktopAppInfo = {
  name: 'Soha',
  version: '开发预览',
  platform: 'web',
  arch: '-',
  updateSupported: false,
}

export async function getDesktopAppInfo() {
  try {
    const response = await fetch('/app/v1/info')
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      return previewInfo
    }
    return (await response.json()) as DesktopAppInfo
  } catch {
    return previewInfo
  }
}

export async function checkDesktopAppUpdate() {
  const response = await fetch('/app/v1/updates/check', { method: 'POST' })
  const result = (await response.json()) as { message?: string }
  if (!response.ok) throw new Error(result.message || '检查更新失败')
  return result.message || '当前已是最新版本'
}
