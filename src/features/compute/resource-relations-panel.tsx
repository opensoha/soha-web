import { Alert, Empty, Space, Spin, Typography } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type {
  ComputeDomain,
  ComputeResourceKind,
  ComputeResourceRef,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { MetadataTag } from '@/components/status-tag'
import { useI18n } from '@/i18n'
import { formatDateTime } from '@/utils/time'
import { computeQueries } from './queries'
import './compute.css'

const { Text } = Typography

const RELATION_LABELS: Record<string, [string, string]> = {
  connected_by: ['连接于', 'Connected by'],
  contains: ['包含', 'Contains'],
  derived_from: ['来源于', 'Derived from'],
  exposes: ['暴露', 'Exposes'],
  manages: ['管理', 'Manages'],
  provisions: ['供给', 'Provisions'],
  runs_on: ['运行于', 'Runs on'],
}

const RELATION_SOURCE_LABELS: Record<string, [string, string]> = {
  derived: ['推导关系', 'Derived'],
  persisted: ['存储关系', 'Persisted'],
  provider: ['提供方关系', 'Provider'],
}

function resourcePath(resource: ComputeResourceRef) {
  if (resource.domain === 'virtualization' && resource.kind === 'vm') {
    return `/compute/virtualization/vms/${encodeURIComponent(resource.id)}`
  }
  if (resource.domain === 'container_runtime' && resource.kind === 'runtime_host') {
    return `/compute/runtimes/hosts/${encodeURIComponent(resource.id)}`
  }
  if (resource.domain === 'container_runtime' && resource.kind === 'project') {
    return `/compute/runtimes/projects/${encodeURIComponent(resource.id)}`
  }
  return undefined
}

function ResourceLink({ resource }: { resource: ComputeResourceRef }) {
  const path = resourcePath(resource)
  const label = resource.displayName || resource.id
  return path ? <Link to={path}>{label}</Link> : <Text strong>{label}</Text>
}

export function ComputeRelationsPanel({
  domain,
  kind,
  resourceId,
}: {
  domain: ComputeDomain
  kind: ComputeResourceKind
  resourceId: string
}) {
  const { localeCode } = useI18n()
  const query = useQuery(computeQueries.resourceRelations(domain, kind, resourceId))
  const relations = query.data?.relations ?? []

  if (query.isLoading) {
    return (
      <Spin description={localeCode === 'zh_CN' ? '正在加载资源关系...' : 'Loading relations...'} />
    )
  }
  if (query.isError) {
    return (
      <Alert
        showIcon
        type="error"
        title={localeCode === 'zh_CN' ? '资源关系加载失败' : 'Failed to load relations'}
        description={query.error.message}
      />
    )
  }
  if (relations.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={localeCode === 'zh_CN' ? '暂无资源关系' : 'No relations'}
      />
    )
  }

  return (
    <div className="soha-compute-relation-list">
      {relations.map((relation, index) => (
        <div
          className="soha-compute-relation-row"
          key={`${relation.type}:${relation.from.domain}:${relation.from.kind}:${relation.from.id}:${relation.to.domain}:${relation.to.kind}:${relation.to.id}:${index}`}
        >
          <div className="soha-compute-relation-chain">
            <ResourceLink resource={relation.from} />
            <Space size={6}>
              <ArrowRightOutlined aria-hidden />
              <MetadataTag
                label={
                  RELATION_LABELS[relation.type]?.[localeCode === 'zh_CN' ? 0 : 1] ?? relation.type
                }
                tone="blue"
              />
              <ArrowRightOutlined aria-hidden />
            </Space>
            <ResourceLink resource={relation.to} />
          </div>
          <Space size={6} wrap>
            <MetadataTag
              label={
                RELATION_SOURCE_LABELS[relation.source]?.[localeCode === 'zh_CN' ? 0 : 1] ??
                relation.source
              }
              tone="cyan"
            />
            {relation.stale ? (
              <MetadataTag label={localeCode === 'zh_CN' ? '数据陈旧' : 'Stale'} tone="gold" />
            ) : null}
            <Text type="secondary">{formatDateTime(relation.observedAt)}</Text>
          </Space>
        </div>
      ))}
    </div>
  )
}
