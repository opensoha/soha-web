import type { ReactNode } from 'react'
import { Result, Spin } from 'antd'
import { areWorkbenchModuleFeaturesEnabled, useModuleStatuses } from '@/features/modules'

export function AIWorkbenchFeatureGate({
  children,
  features,
}: {
  children: ReactNode
  features: string[]
}) {
  const query = useModuleStatuses()
  if (query.isPending) {
    return <Spin fullscreen />
  }
  if (!areWorkbenchModuleFeaturesEnabled(query.data, 'ai', features)) {
    return <Result status="404" title="功能未启用" subTitle="当前环境未启用此 AI 能力。" />
  }
  return children
}
