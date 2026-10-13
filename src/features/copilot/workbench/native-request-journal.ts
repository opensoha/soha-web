// Each submission has its own entry so two windows cannot overwrite each other's recovery IDs.
// Store only opaque IDs. Request contents, attachments, tokens and context stay out of storage.
function prefix(owner: string, sessionId: string) {
  return `soha.native-request.v1:${encodeURIComponent(owner)}/${encodeURIComponent(sessionId)}/`
}

export function pendingNativeRequests(owner?: string, sessionId?: string): string[] {
  if (!owner || !sessionId) return []
  const scope = prefix(owner, sessionId)
  const ids: string[] = []
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (key?.startsWith(scope)) {
      const id = decodeURIComponent(key.slice(scope.length))
      if (!id || id.length > 128) throw new Error('任务恢复标识不完整，请核对原会话')
      ids.push(id)
    }
  }
  return ids.sort()
}

export function rememberNativeRequest(owner: string, sessionId: string, requestId: string) {
  if (!owner || !sessionId || !requestId || requestId.length > 128)
    throw new Error('无法保存任务恢复标识')
  const key = prefix(owner, sessionId) + encodeURIComponent(requestId)
  if (localStorage.getItem(key) !== 'cancel') localStorage.setItem(key, '1')
}

export function requestNativeCancellation(owner: string, sessionId: string) {
  for (const requestId of pendingNativeRequests(owner, sessionId))
    localStorage.setItem(prefix(owner, sessionId) + encodeURIComponent(requestId), 'cancel')
}

export function nativeCancellationRequested(owner: string, sessionId: string, requestId: string) {
  return localStorage.getItem(prefix(owner, sessionId) + encodeURIComponent(requestId)) === 'cancel'
}

export function pendingNativeCancellations(owner?: string) {
  const entries: Array<{ sessionId: string; requestId: string }> = []
  if (!owner) return entries
  const scope = `soha.native-request.v1:${encodeURIComponent(owner)}/`
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (!key?.startsWith(scope) || localStorage.getItem(key) !== 'cancel') continue
    const [session, request] = key.slice(scope.length).split('/')
    const sessionId = decodeURIComponent(session ?? '')
    const requestId = decodeURIComponent(request ?? '')
    if (!sessionId || !requestId || requestId.length > 128)
      throw new Error('任务取消标识不完整，请核对原会话')
    entries.push({ sessionId, requestId })
  }
  return entries.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

export function nativeRecoveryBatch<T>(ids: T[], page: number) {
  if (ids.length <= 64) return ids
  const offset = (page * 64) % ids.length
  return [...ids.slice(offset), ...ids.slice(0, offset)].slice(0, 64)
}

export function forgetNativeRequest(owner: string, sessionId: string, requestId: string) {
  try {
    const key = prefix(owner, sessionId) + encodeURIComponent(requestId)
    if (localStorage.getItem(key) === null) return false
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
