import { Card, Descriptions, Table } from 'antd'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { StatusTag } from '@/components/status-tag'
import {
  buildRelatedResourcePath,
  buildWorkloadDetailPath,
} from '@/features/platform/workloads-model'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type { Pod } from '@/types'
import type { TableColumnsType } from 'antd'
import { ConfigurationConditions } from '../shared/detail-tables'
import { ConfigurationQueryDetailPage } from '../shared/detail-shell'
import { resolveConfigurationNamespace } from '../shared/scope'
import type { PodDisruptionBudgetResource } from './types'

function PDBOverview({ detail }: { detail: PodDisruptionBudgetResource }) {
  const workloadPath = detail.workload
    ? buildRelatedResourcePath(detail.workload, detail.namespace)
    : null
  const columns: TableColumnsType<Pod> = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (value: string, pod) => (
        <Link to={buildWorkloadDetailPath('pods', value, detail.namespace, pod.namespace)}>
          {value}
        </Link>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'phase',
      width: 120,
      render: (value: string) => <StatusTag value={value} />,
    },
    { title: 'Ready', dataIndex: 'readyContainers', width: 100 },
    { title: 'Restarts', dataIndex: 'restarts', width: 100 },
    { title: 'Node', dataIndex: 'nodeName', render: (value?: string) => value || '-' },
  ]
  return (
    <>
      <Card className="soha-detail-card" title="Selection">
        <Descriptions
          column={{ xs: 1, sm: 2 }}
          items={[
            { key: 'selector', label: 'Selector', children: detail.selector || '-' },
            {
              key: 'workload',
              label: 'Workload',
              children: detail.workload ? (
                workloadPath ? (
                  <Link to={workloadPath}>{`${detail.workload.kind}/${detail.workload.name}`}</Link>
                ) : (
                  `${detail.workload.kind}/${detail.workload.name}`
                )
              ) : (
                '-'
              ),
            },
          ]}
          size="small"
        />
      </Card>
      <Card className="soha-detail-card" title="Pods">
        <Table
          className="soha-platform-table"
          columns={columns}
          dataSource={detail.pods ?? []}
          pagination={false}
          rowKey={(pod) => `${pod.namespace}/${pod.name}`}
          size="small"
        />
      </Card>
      <ConfigurationConditions conditions={detail.conditions} />
    </>
  )
}

export function ConfigurationPDBDetailPage() {
  const name = useParams().name as string
  const [searchParams] = useSearchParams()
  const { namespace } = usePlatformScopeStore()
  const detailNamespace = resolveConfigurationNamespace(namespace, searchParams.get('namespace'))
  return (
    <ConfigurationQueryDetailPage<PodDisruptionBudgetResource>
      kind="poddisruptionbudgets"
      label="PodDisruptionBudget"
      name={name}
      namespace={detailNamespace}
      overviewExtra={(detail) => [
        { key: 'Min Available', value: detail.minAvailable || '-' },
        { key: 'Max Unavailable', value: detail.maxUnavailable || '-' },
        { key: 'Healthy', value: `${detail.currentHealthy}/${detail.desiredHealthy}` },
        { key: 'Disruptions Allowed', value: detail.disruptionsAllowed },
      ]}
      renderOverview={(detail) => <PDBOverview detail={detail} />}
    />
  )
}
