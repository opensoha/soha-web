import { useEffect, useRef } from 'react'
import type { CompanionInteractionMotion } from './motion'
import { SohaOrbit } from './soha-orbit'
import type { CompanionVisualState } from './types'

export function disposeLive2DHost(host: HTMLElement) {
  for (const canvas of host.querySelectorAll('canvas')) {
    const gl = (canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    const loseContext = gl?.getExtension('WEBGL_lose_context') as { loseContext: () => void } | null
    loseContext?.loseContext()
  }
  host.replaceChildren()
}

interface Live2DCubismRendererProps {
  interaction?: CompanionInteractionMotion
  state: CompanionVisualState
  stateAnimation?: string
}

export function Live2DCubismRenderer({
  interaction,
  state,
  stateAnimation,
}: Live2DCubismRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    return () => {
      if (host) disposeLive2DHost(host)
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className="soha-companion-live2d-host"
      data-interaction={interaction?.animation}
      data-motion={stateAnimation}
      data-runtime="license-gated"
    >
      <SohaOrbit interaction={interaction} state={state} stateAnimation={stateAnimation} />
    </div>
  )
}
