import type { ReactNode } from 'react'
import { Tabs } from 'antd'
import type { TabsProps } from 'antd'
import { PlatformResourceOverview } from '@/features/platform/shared/resource-overview'
import '../styles.css'

export function StorageDetailShell({
  children,
}: {
  children: ReactNode
  kind: string
  name: string
}) {
  return <div className="soha-page soha-workload-detail-page">{children}</div>
}

export function StorageDetailTabs({
  activeKey,
  items,
  onChange,
}: {
  activeKey: string
  items: TabsProps['items']
  onChange: (key: string) => void
}) {
  return (
    <Tabs
      activeKey={activeKey}
      className="soha-resource-tabs soha-workload-detail-tabs"
      indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
      items={items}
      onChange={onChange}
      size="small"
      tabBarGutter={18}
    />
  )
}

export function StorageResourceOverview({
  ageSeconds,
  annotations,
  createdAt,
  extra,
  labels,
  name,
  namespace,
}: {
  ageSeconds?: number
  annotations?: Record<string, string>
  createdAt?: string
  extra: Array<{ key: string; value: ReactNode }>
  labels?: Record<string, string>
  name: string
  namespace: string
}) {
  return (
    <PlatformResourceOverview
      ageSeconds={ageSeconds}
      annotations={annotations}
      createdAt={createdAt}
      facts={extra.map((item) => ({ ...item, label: item.key }))}
      labels={labels}
      name={name}
      namespace={namespace}
    />
  )
}
