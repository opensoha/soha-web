import { Descriptions } from 'antd'
import { useI18n } from '@/i18n'
import type { ResourceCreateContext } from '../types'

export function ResourceCreateScopeSummary({ context }: { context: ResourceCreateContext }) {
  const { localeCode } = useI18n()
  const isChinese = localeCode === 'zh_CN'
  return (
    <Descriptions
      bordered
      className="soha-resource-create-scope"
      column={{ xs: 1, sm: 2, md: 3 }}
      items={[
        { key: 'cluster', label: isChinese ? '集群' : 'Cluster', children: context.clusterId },
        {
          key: 'namespace',
          label: isChinese ? '默认命名空间' : 'Default namespace',
          children:
            context.scopeMode === 'cluster'
              ? isChinese
                ? '集群级'
                : 'Cluster scoped'
              : context.defaultNamespace || (isChinese ? '未选择' : 'Not selected'),
        },
        {
          key: 'kind',
          label: isChinese ? '资源类型' : 'Resource kind',
          children: context.expectedKind || (isChinese ? '由 YAML 决定' : 'Resolved from YAML'),
        },
      ]}
      size="small"
    />
  )
}
