/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'
import { disposeLive2DHost } from './live2d-cubism-renderer'

describe('Live2D host teardown', () => {
  it('loses WebGL contexts and clears mounted canvases', () => {
    const host = document.createElement('div')
    const canvas = document.createElement('canvas')
    const loseContext = vi.fn()
    vi.spyOn(canvas, 'getContext').mockImplementation(
      () =>
        ({
          getExtension: () => ({ loseContext }),
        }) as unknown as WebGLRenderingContext,
    )
    host.append(canvas)

    disposeLive2DHost(host)

    expect(loseContext).toHaveBeenCalledOnce()
    expect(host.childElementCount).toBe(0)
  })
})
