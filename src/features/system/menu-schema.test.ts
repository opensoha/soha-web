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
    expect(normalizeMenuSection('logs')).toBe('observe-signals')
    expect(normalizeMenuSection('observability-data')).toBe('observe-data')
    expect(normalizeMenuSection('observability-dashboards')).toBe('dashboards')
    expect(normalizeMenuSection('alerts')).toBe('alerting')
    expect(normalizeMenuSection('ai-operations')).toBe('ai-governance')
    expect(normalizeMenuSection('Delivery')).toBe('delivery')
    expect(normalizeMenuSection('extension')).toBe('extensions')
    expect(normalizeMenuSection('system-integrations')).toBe('integrations')
    expect(normalizeMenuSection('control')).toBe('control')
  })

  it('renders canonical labels for normalized aliases', () => {
    expect(resolveMenuSectionLabel('observe')).toBe('Observe')
    expect(resolveMenuSectionLabel('logging')).toBe('探索')
    expect(resolveMenuSectionLabel('observe-data')).toBe('数据与集成')
    expect(resolveMenuSectionLabel('dashboards')).toBe('仪表盘')
    expect(resolveMenuSectionLabel('dashboards', 'en_US')).toBe('Dashboards')
    expect(resolveMenuSectionLabel('alerting')).toBe('告警与响应')
    expect(resolveMenuSectionLabel('alerting', 'en_US')).toBe('Alerting & Response')
    expect(resolveMenuSectionLabel('Dashboard')).toBe('Dashboard')
    expect(resolveMenuSectionLabel('extensions')).toBe('扩展')
    expect(resolveMenuSectionLabel('extensions', 'en_US')).toBe('Extensions')
    expect(resolveMenuSectionLabel('integrations')).toBe('系统集成')
    expect(resolveMenuSectionLabel('integrations', 'en_US')).toBe('System Integrations')
    expect(resolveMenuSectionLabel('users')).toBe('用户管理')
    expect(resolveMenuSectionLabel('users', 'en_US')).toBe('User Management')
    expect(resolveMenuSectionLabel('control')).toBe('control')
    expect(resolveMenuSectionLabel('ai-interaction')).toBe('交互')
    expect(resolveMenuSectionLabel('ai-engineering')).toBe('AI 工程')
    expect(resolveMenuSectionLabel('ai-model-access')).toBe('模型与接入')
    expect(resolveMenuSectionLabel('ai-governance')).toBe('治理与可观测')
  })

  it('only keeps active section options and removes duplicate aliases', () => {
    expect(
      buildMenuSectionOptions([
        'platform',
        'Dashboard',
        'observe',
        'ops',
        'logs',
        'alerts',
        'control',
        'deliver',
      ]),
    ).toEqual([
      { value: 'platform', label: 'Dashboard' },
      { value: 'ops', label: 'Observe' },
      { value: 'observe-signals', label: '探索' },
      { value: 'alerting', label: '告警与响应' },
      { value: 'delivery', label: '应用交付' },
      { value: 'control', label: 'control' },
    ])
  })
})
