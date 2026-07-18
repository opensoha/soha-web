import { Card, Table } from 'antd'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { buildRelatedResourcePath } from '@/features/platform/workloads-model'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type { TableColumnsType } from 'antd'
import { ConfigurationConditions } from '../shared/detail-tables'
import { ConfigurationQueryDetailPage } from '../shared/detail-shell'
import { resolveConfigurationNamespace } from '../shared/scope'
import type { HorizontalPodAutoscalerMetric, HorizontalPodAutoscalerResource } from './types'

function HPAOverview({ detail }: { detail: HorizontalPodAutoscalerResource }) {
  const columns: TableColumnsType<HorizontalPodAutoscalerMetric> = [
    { title: 'Type', dataIndex: 'type', width: 140 },
    { title: 'Name', dataIndex: 'name', render: (value?: string) => value || '-' },
    { title: 'Target', dataIndex: 'target', render: (value?: string) => value || '-' },
    { title: 'Current', dataIndex: 'current', render: (value?: string) => value || '-' },
  ]
  return (
    <>
      <Card className="soha-detail-card" title="Metrics">
        <Table
          className="soha-platform-table"
          columns={columns}
          dataSource={detail.metrics ?? []}
          pagination={false}
          rowKey={(metric) => `${metric.type}/${metric.name ?? ''}/${metric.target ?? ''}`}
          size="small"
        />
      </Card>
      <ConfigurationConditions conditions={detail.conditions} />
    </>
  )
}

function targetLink(targetRef: string, namespace?: string) {
  const [kind, name] = targetRef.split('/', 2)
  if (!kind || !name) return targetRef || '-'
  const path = buildRelatedResourcePath({ kind, name, namespace }, namespace ?? null)
  return path ? <Link to={path}>{targetRef}</Link> : targetRef
}

export function ConfigurationHPADetailPage() {
  const name = useParams().name as string
  const [searchParams] = useSearchParams()
  const { namespace } = usePlatformScopeStore()
  const detailNamespace = resolveConfigurationNamespace(namespace, searchParams.get('namespace'))
  return (
    <ConfigurationQueryDetailPage<HorizontalPodAutoscalerResource>
      kind="hpas"
      label="HorizontalPodAutoscaler"
      name={name}
      namespace={detailNamespace}
      overviewExtra={(detail) => [
        { key: 'Target', value: targetLink(detail.targetRef, detail.namespace) },
        { key: 'Replicas', value: `${detail.currentReplicas}/${detail.desiredReplicas}` },
        { key: 'Min / Max', value: `${detail.minReplicas} / ${detail.maxReplicas}` },
      ]}
      renderOverview={(detail) => <HPAOverview detail={detail} />}
    />
  )
}
