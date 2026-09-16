import { describe, expect, it } from 'vitest'
import { getAntdTheme, getThemePalette } from './app-theme'

describe('shared table theme', () => {
  it.each(['light', 'dark'] as const)(
    'uses readable headers and distinct densities in %s',
    (mode) => {
      const table = getAntdTheme(mode).components?.Table
      const palette = getThemePalette(mode)
      expect(getAntdTheme(mode).components?.Drawer?.colorBgElevated).toBe(palette.colorBgContainer)
      expect(table?.headerColor).toBe(palette.colorText)
      expect(table?.headerSplitColor).toBe(palette.colorBorder)
      expect(table?.borderColor).toBe(palette.colorBorder)
      expect(table?.cellPaddingBlockSM).toBe(8)
      expect(table?.cellPaddingBlockMD).toBe(12)
    },
  )
})
