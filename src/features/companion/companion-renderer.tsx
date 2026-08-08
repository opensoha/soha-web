import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { fetchCompanionAsset } from './api'
import { BUILTIN_COMPANION_PLUGIN_ID } from './builtin-pack'
import { SohaOrbit } from './soha-orbit'
import type { CompanionPackSelection, CompanionVisualState } from './types'

const Live2DCubismRenderer = lazy(async () => {
  const module = await import('./live2d-cubism-renderer')
  return { default: module.Live2DCubismRenderer }
})

interface CompanionRendererProps {
  pack: CompanionPackSelection
  state: CompanionVisualState
}

function CompanionImage({ pack, state }: CompanionRendererProps) {
  const [assetUrl, setAssetUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let currentUrl: string | null = null
    let cancelled = false
    setFailed(false)
    setAssetUrl(null)
    void fetchCompanionAsset(pack.pluginId, pack.manifest.entryAsset)
      .then((blob) => {
        if (cancelled) return
        currentUrl = URL.createObjectURL(blob)
        setAssetUrl(currentUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [pack.manifest.entryAsset, pack.pluginId])

  if (failed || !assetUrl) return <SohaOrbit state={state} />
  return <img alt="" className="soha-companion-pack-image" draggable={false} src={assetUrl} />
}

export function CompanionRenderer({ pack, state }: CompanionRendererProps) {
  const onUnavailable = useCallback(() => undefined, [])
  if (pack.pluginId === BUILTIN_COMPANION_PLUGIN_ID) return <SohaOrbit state={state} />
  if (pack.manifest.renderer === 'live2d-cubism') {
    return (
      <Suspense fallback={<SohaOrbit state={state} />}>
        <Live2DCubismRenderer onUnavailable={onUnavailable} state={state} />
      </Suspense>
    )
  }
  return <CompanionImage pack={pack} state={state} />
}
