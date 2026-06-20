import type { ReactNode } from 'react'
import { Card, Statistic, Typography } from 'antd'
import { Tiny } from '@ant-design/charts'
import { resolveThemeColorReference } from '@/theme/app-theme'

const { Text } = Typography

export type OverviewTone = 'default' | 'success' | 'warning' | 'danger'

export type OverviewMiniChartConfig =
  | { kind: 'line' | 'area' | 'column'; data: number[] }
  | { kind: 'progress' | 'ring'; percent: number }

export interface OverviewMetricItem {
  key: string
  label: ReactNode
  value: ReactNode
  helper?: ReactNode
  icon?: ReactNode
  tone?: OverviewTone
  chart?: OverviewMiniChartConfig
}

export interface OverviewChipItem {
  key: string
  label: ReactNode
  value: ReactNode
  helper?: ReactNode
  icon?: ReactNode
  tone?: OverviewTone
  chart?: OverviewMiniChartConfig
}

export interface OverviewMetricCardProps {
  label: ReactNode
  value: ReactNode
  helper?: ReactNode
  icon?: ReactNode
  tone?: OverviewTone
  className?: string
  chart?: OverviewMiniChartConfig
  loading?: boolean
  variant?: 'metric' | 'pod'
}

export interface OverviewChipProps {
  label: ReactNode
  value: ReactNode
  helper?: ReactNode
  icon?: ReactNode
  tone?: OverviewTone
  className?: string
  chart?: OverviewMiniChartConfig
}

export interface OverviewSectionBarProps {
  title: ReactNode
  description?: ReactNode
  kicker?: ReactNode
  extra?: ReactNode
  className?: string
}

function toneClassName(tone: OverviewTone = 'default') {
  return `is-${tone}`
}

function resolveOverviewToneColor(tone: OverviewTone = 'default') {
  switch (tone) {
    case 'success':
      return resolveThemeColorReference('var(--soha-success)', '#22c55e')
    case 'warning':
      return resolveThemeColorReference('var(--soha-warning)', '#f97316')
    case 'danger':
      return resolveThemeColorReference('var(--soha-danger)', '#ef4444')
    default:
      return resolveThemeColorReference('var(--soha-primary)', '#1677ff')
  }
}

function renderStatisticValue(value: ReactNode) {
  return typeof value === 'number' ? <Statistic value={value} /> : <span className="soha-overview-value">{value}</span>
}

function OverviewMiniChart({ chart, tone }: { chart?: OverviewMiniChartConfig; tone?: OverviewTone }) {
  if (!chart) return null
  const baseColor = resolveOverviewToneColor(tone)
  const weakColor = resolveThemeColorReference('var(--soha-fill-weak)', '#f9f9fb')

  if (chart.kind === 'progress') {
    return (
      <div className="soha-overview-mini-chart is-progress" aria-hidden="true">
        <Tiny.Progress
          percent={chart.percent}
          color={[weakColor, baseColor]}
        />
      </div>
    )
  }

  if (chart.kind === 'ring') {
    return (
      <div className="soha-overview-mini-chart is-ring" aria-hidden="true">
        <Tiny.Ring
          percent={chart.percent}
          color={[weakColor, baseColor]}
          radius={0.74}
        />
      </div>
    )
  }

  if (chart.kind === 'column') {
    return (
      <div className="soha-overview-mini-chart" aria-hidden="true">
        <Tiny.Column
          data={chart.data}
          color={baseColor}
          autoFit
        />
      </div>
    )
  }

  if (chart.kind === 'area') {
    return (
      <div className="soha-overview-mini-chart" aria-hidden="true">
        <Tiny.Area
          data={chart.data}
          color={baseColor}
          shapeField="smooth"
          autoFit
        />
      </div>
    )
  }

  if (chart.kind === 'line') {
    return (
      <div className="soha-overview-mini-chart" aria-hidden="true">
        <Tiny.Line
          data={chart.data}
          color={baseColor}
          shapeField="smooth"
          autoFit
        />
      </div>
    )
  }

  return null
}

export function OverviewMetricCard({
  label,
  value,
  helper,
  icon,
  tone = 'default',
  className,
  chart,
  loading,
  variant = 'metric',
}: OverviewMetricCardProps) {
  const baseClassName = variant === 'pod' ? 'soha-overview-pod-card' : 'soha-overview-metric-card'
  const headClassName = variant === 'pod' ? 'soha-overview-pod-card-head' : 'soha-overview-metric-card-head'

  return (
    <Card
      size="small"
      variant="outlined"
      loading={loading}
      className={[baseClassName, toneClassName(tone), className].filter(Boolean).join(' ')}
    >
      <div className={headClassName}>
        <div className="soha-overview-metric-copy">
          <Text className="soha-overview-metric-label">{label}</Text>
          {renderStatisticValue(value)}
        </div>
        {icon ? <span className="soha-overview-metric-icon">{icon}</span> : null}
      </div>
      {helper ? <Text className="soha-overview-metric-helper">{helper}</Text> : null}
      <OverviewMiniChart chart={chart} tone={tone} />
    </Card>
  )
}

export function OverviewChip({ label, value, helper, icon, tone = 'default', className, chart }: OverviewChipProps) {
  return (
    <div className={['soha-overview-chip', toneClassName(tone), className].filter(Boolean).join(' ')}>
      <div className="soha-overview-chip-head">
        {icon ? <span className="soha-overview-metric-icon">{icon}</span> : null}
        <span className="soha-overview-chip-label">{label}</span>
      </div>
      <span className="soha-overview-chip-value">{value}</span>
      {helper ? <span className="soha-overview-metric-helper">{helper}</span> : null}
      <OverviewMiniChart chart={chart} tone={tone} />
    </div>
  )
}

export function OverviewSectionBar({ title, description, kicker, extra, className }: OverviewSectionBarProps) {
  return (
    <div className={['soha-overview-section-bar', className].filter(Boolean).join(' ')}>
      <div className="soha-overview-section-copy">
        {kicker ? <div className="soha-overview-section-kicker">{kicker}</div> : null}
        <Text strong className="soha-overview-section-title">
          {title}
        </Text>
        {description ? <div className="soha-overview-inline-caption">{description}</div> : null}
      </div>
      {extra ? <div className="soha-overview-section-extra">{extra}</div> : null}
    </div>
  )
}
