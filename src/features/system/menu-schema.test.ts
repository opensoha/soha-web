/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import {
  buildMenuSectionOptions,
  normalizeMenuSection,
  resolveMenuSectionLabel,
} from './menu-schema'

describe('menu section schema helpers', () => {
  it('normalizes legacy display labels to canonical section keys', () => {
    expect(normalizeMenuSection('Dashboard')).toBe('platform')
    expect(normalizeMenuSection('observe')).toBe('ops')
    expect(normalizeMenuSection('ai-operations')).toBe('ai-governance')
    expect(normalizeMenuSection('Delivery')).toBe('delivery')
    expect(normalizeMenuSection('extension')).toBe('extensions')
    expect(normalizeMenuSection('control')).toBe('control')
  })

  it('renders canonical labels for normalized aliases', () => {
    expect(resolveMenuSectionLabel('observe')).toBe('Observe')
    expect(resolveMenuSectionLabel('Dashboard')).toBe('Dashboard')
    expect(resolveMenuSectionLabel('extensions')).toBe('扩展')
    expect(resolveMenuSectionLabel('extensions', 'en_US')).toBe('Extensions')
    expect(resolveMenuSectionLabel('control')).toBe('control')
    expect(resolveMenuSectionLabel('ai-interaction')).toBe('交互')
    expect(resolveMenuSectionLabel('ai-engineering')).toBe('AI 工程')
    expect(resolveMenuSectionLabel('ai-model-access')).toBe('模型与接入')
    expect(resolveMenuSectionLabel('ai-governance')).toBe('治理与可观测')
  })

  it('only keeps active section options and removes duplicate aliases', () => {
    expect(
      buildMenuSectionOptions(['platform', 'Dashboard', 'observe', 'ops', 'control', 'deliver']),
    ).toEqual([
      { value: 'platform', label: 'Dashboard' },
      { value: 'ops', label: 'Observe' },
      { value: 'delivery', label: '应用交付' },
      { value: 'control', label: 'control' },
    ])
  })
})
