import { Button, Card, Table, Tag, Tooltip } from 'antd'
import type { TableColumnsType } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import {
  buildRelatedResourcePath,
  buildWorkloadDetailPath,
  localizeRelatedRelation,
  localizeRelatedResourceKind,
} from '@/features/platform/workloads-model'
import { useI18n } from '@/i18n'
import type { Pod, WorkloadRelation } from '@/types'
import { formatAgeSeconds } from '@/utils/time'

export function WorkloadPodsCard({ pods = [], namespace }: { pods?: Pod[]; namespace: string }) {
  const { localeCode } = useI18n()
  const navigate = useNavigate()

  return (
    <Card
      className="soha-detail-card soha-related-pod-card"
      size="small"
      title={localeCode === 'zh_CN' ? '关联 Pods' : 'Related Pods'}
    >
      <div className="soha-related-pod-list">
        {pods.length === 0 ? (
          <ManagementState
            bordered={false}
            compact
            title={localeCode === 'zh_CN' ? '暂无关联 Pods' : 'No related Pods'}
          />
        ) : null}
        {pods.map((pod) => (
          <div className="soha-related-pod-item" key={`${pod.namespace}/${pod.name}`}>
            <div className="soha-related-pod-line">
              <Tooltip title={pod.name}>
                <Button
                  type="link"
                  className="soha-related-pod-name"
                  onClick={() =>
                    navigate(buildWorkloadDetailPath('pods', pod.name, namespace, pod.namespace))
                  }
                >
                  {pod.name}
                </Button>
              </Tooltip>
              <StatusTag value={pod.phase} />
              <Tag color="blue" className="soha-related-pod-tag">
                {pod.namespace || namespace || '-'}
              </Tag>
              <Tag color="cyan" className="soha-related-pod-tag">
                {pod.podIp || '-'}
              </Tag>
              <Tag color="success" className="soha-related-pod-tag">
                {`Ready ${pod.readyContainers || '-'}`}
              </Tag>
              <Tag
                color={(pod.restarts ?? 0) > 0 ? 'warning' : 'default'}
                className="soha-related-pod-tag"
              >
                {`${localeCode === 'zh_CN' ? '重启' : 'Restarts'} ${pod.restarts ?? 0}`}
              </Tag>
              <Tooltip title={pod.nodeName || '-'}>
                <Tag color="purple" className="soha-related-pod-tag soha-related-pod-tag-node">
                  {pod.nodeName || '-'}
                </Tag>
              </Tooltip>
              <Tag color="geekblue" className="soha-related-pod-tag">
                {formatAgeSeconds(pod.ageSeconds)}
              </Tag>
            </div>
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
        const path = buildRelatedResourcePath(record, namespace)
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
