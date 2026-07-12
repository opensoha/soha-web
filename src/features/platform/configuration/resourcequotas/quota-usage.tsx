import { Progress, Tooltip, Typography } from 'antd'
import type { ResourceQuotaResource } from './types'

const { Text } = Typography

function parseQuotaNumeric(value: string | undefined): number | null {
  if (value == null) return null
  const match = value.trim().match(/^([0-9]*\.?[0-9]+)\s*([a-zA-Z]*)$/)
  if (!match) return null
  const amount = Number.parseFloat(match[1])
  if (!Number.isFinite(amount)) return null
  const unit = match[2] || ''
  const multipliers: Record<string, number> = {
    '': 1,
    m: 0.001,
    k: 1000,
    Ki: 1024,
    M: 1000 ** 2,
    Mi: 1024 ** 2,
    G: 1000 ** 3,
    Gi: 1024 ** 3,
    T: 1000 ** 4,
    Ti: 1024 ** 4,
    P: 1000 ** 5,
    Pi: 1024 ** 5,
  }
  return multipliers[unit] != null ? amount * multipliers[unit] : amount
}

export function ResourceQuotaUsage({ record }: { record: ResourceQuotaResource }) {
  const hard = record.hard ?? {}
  const used = record.used ?? {}
  const keys = Object.keys(hard)
  if (keys.length === 0) return <Text type="secondary">-</Text>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
      {keys.map((key) => {
        const hardRaw = hard[key]
        const usedRaw = used[key] ?? '0'
        const hardNum = parseQuotaNumeric(hardRaw)
        const usedNum = parseQuotaNumeric(usedRaw)
        const percent =
          hardNum && hardNum > 0 && usedNum != null
            ? Math.min(100, Math.round((usedNum / hardNum) * 100))
            : 0
        return (
          <Tooltip key={key} title={`${key}: ${usedRaw} / ${hardRaw}`} placement="top">
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'var(--soha-text-tertiary)',
                }}
              >
                <span
                  style={{
                    maxWidth: 140,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {key}
                </span>
                <span>
                  {usedRaw} / {hardRaw}
                </span>
              </div>
              <Progress
                aria-label={`${key} quota usage`}
                percent={percent}
                showInfo={false}
                size="small"
              />
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}
