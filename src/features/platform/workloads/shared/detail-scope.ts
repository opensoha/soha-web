import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { toScopeKey } from '@/types'

export function useWorkloadDetailScope() {
  const [searchParams] = useSearchParams()
  const {
    clusterId: scopedClusterId,
    namespace: scopedNamespace,
    setClusterId,
    setNamespace,
  } = usePlatformScopeStore()
  const requestedClusterId = searchParams.get('clusterId')?.trim() || null
  const hasRequestedNamespace = searchParams.has('namespace')
  const requestedNamespace = hasRequestedNamespace
    ? searchParams.get('namespace')?.trim() || null
    : undefined
  const clusterChanged = Boolean(requestedClusterId && requestedClusterId !== scopedClusterId)
  const clusterId = requestedClusterId || scopedClusterId
  const namespace =
    requestedNamespace !== undefined ? requestedNamespace : clusterChanged ? null : scopedNamespace

  useEffect(() => {
    if (clusterChanged && requestedClusterId) {
      setClusterId(requestedClusterId)
    }
    if (
      requestedNamespace !== undefined &&
      (clusterChanged || requestedNamespace !== scopedNamespace)
    ) {
      setNamespace(requestedNamespace)
    }
  }, [
    clusterChanged,
    requestedClusterId,
    requestedNamespace,
    scopedNamespace,
    setClusterId,
    setNamespace,
  ])

  return toScopeKey(clusterId, namespace)
}
