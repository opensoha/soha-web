import { Button, Card, Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { TableCellText } from '@/components/table-cell-content'
import {
  buildRelatedResourcePath,
  buildWorkloadDetailPath,
  localizeRelatedRelation,
  localizeRelatedResourceKind,
} from '@/features/platform/workloads-model'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import type { Pod, WorkloadRelation } from '@/types'
import { formatAgeSeconds } from '@/utils/time'

export function WorkloadPodsCard({ pods = [], namespace }: { pods?: Pod[]; namespace: string }) {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const clusterId = usePlatformScopeStore((state) => state.clusterId)

  return (
    <Card
      className="soha-detail-card soha-related-pod-card soha-related-pod-cards"
      size="small"
      title={localeCode === 'zh_CN' ? '关联 Pods' : 'Related Pods'}
    >
      <div className="soha-related-pod-list" role="list">
        {pods.length === 0 ? (
          <ManagementState
            bordered={false}
            compact
            title={localeCode === 'zh_CN' ? '暂无关联 Pods' : 'No related Pods'}
          />
        ) : null}
        {pods.map((pod) => (
          <div
            className="soha-related-pod-item"
            role="listitem"
            key={`${pod.namespace}/${pod.name}`}
          >
            <div className="soha-related-pod-heading">
              <Button
                type="link"
                className="soha-related-pod-link"
                style={{ maxWidth: '100%' }}
                styles={{ content: { minWidth: 0 } }}
                onClick={() =>
                  navigate(
                    buildWorkloadDetailPath('pods', pod.name, namespace, pod.namespace, clusterId),
                  )
                }
              >
                <TableCellText value={pod.name} />
              </Button>
              <StatusTag value={pod.phase} />
            </div>
            <dl className="soha-related-pod-facts">
              <div>
                <dt>{localeCode === 'zh_CN' ? '命名空间' : 'Namespace'}</dt>
                <dd>{pod.namespace || namespace || '-'}</dd>
              </div>
              <div>
                <dt>{localeCode === 'zh_CN' ? '节点' : 'Node'}</dt>
                <dd>{pod.nodeName || '-'}</dd>
              </div>
              <div>
                <dt>Pod IP</dt>
                <dd>{pod.podIp || '-'}</dd>
              </div>
              <div>
                <dt>{localeCode === 'zh_CN' ? '就绪' : 'Ready'}</dt>
                <dd>{pod.readyContainers || '-'}</dd>
              </div>
              <div>
                <dt>{localeCode === 'zh_CN' ? '重启' : 'Restarts'}</dt>
                <dd className={pod.restarts > 0 ? 'has-restarts' : undefined}>
                  {pod.restarts ?? '-'}
                </dd>
              </div>
              <div>
                <dt>{localeCode === 'zh_CN' ? '运行时长' : 'Age'}</dt>
                <dd>{formatAgeSeconds(pod.ageSeconds)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function WorkloadRelationsCard({
  resources = [],
  namespace,
}: {
  resources?: WorkloadRelation[]
  namespace: string
}) {
  const { localeCode } = useI18n()
  const navigate = useNavigate()
  const clusterId = usePlatformScopeStore((state) => state.clusterId)
  const columns: TableColumnsType<WorkloadRelation> = [
    {
      title: localeCode === 'zh_CN' ? '资源类型' : 'Kind',
      dataIndex: 'kind',
      width: 150,
      render: (value: string) => <Tag>{localizeRelatedResourceKind(value, localeCode)}</Tag>,
    },
    {
      title: localeCode === 'zh_CN' ? '名称' : 'Name',
      dataIndex: 'name',
      render: (value: string, record) => {
        const path = buildRelatedResourcePath(record, namespace, clusterId)
        return path ? (
          <Button type="link" onClick={() => navigate(path)}>
            {value}
          </Button>
        ) : (
          value
        )
      },
    },
    {
      title: localeCode === 'zh_CN' ? '命名空间' : 'Namespace',
      dataIndex: 'namespace',
      width: 160,
      render: (value?: string) => value || namespace || '-',
    },
    {
      title: localeCode === 'zh_CN' ? '关联关系' : 'Relation',
      dataIndex: 'relation',
      width: 200,
      render: (value?: string) =>
        value ? <Tag>{localizeRelatedRelation(value, localeCode)}</Tag> : '-',
    },
  ]

  return (
    <Card
      className="soha-detail-card"
      size="small"
      title={localeCode === 'zh_CN' ? '关联资源' : 'Related Resources'}
    >
      <Table
        columns={columns}
        dataSource={resources}
        pagination={false}
        rowKey={(record) =>
          `${record.kind}:${record.namespace || namespace}:${record.name}:${record.relation || ''}`
        }
        size="small"
        locale={{
          emptyText: (
            <ManagementState
              bordered={false}
              compact
              title={localeCode === 'zh_CN' ? '暂无关联资源' : 'No related resources'}
            />
          ),
        }}
      />
    </Card>
  )
}
