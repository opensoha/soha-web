import { useEffect, useRef } from 'react'
import { SohaOrbit } from './soha-orbit'
import type { CompanionVisualState } from './types'

export function disposeLive2DHost(host: HTMLElement) {
  for (const canvas of host.querySelectorAll('canvas')) {
    const gl = (canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    const loseContext = gl?.getExtension('WEBGL_lose_context') as
      | { loseContext: () => void }
      | null
    loseContext?.loseContext()
  }
  host.replaceChildren()
}

interface Live2DCubismRendererProps {
  onUnavailable: () => void
  state: CompanionVisualState
}

export function Live2DCubismRenderer({ onUnavailable, state }: Live2DCubismRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onUnavailable()
    const host = hostRef.current
    return () => {
      if (host) disposeLive2DHost(host)
    }
  }, [onUnavailable])

  return (
    <div ref={hostRef} className="soha-companion-live2d-host" data-runtime="license-gated">
      <SohaOrbit state={state} />
    </div>
  )
}
