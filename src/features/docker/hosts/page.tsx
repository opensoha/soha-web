import { useState } from 'react'
import { App, Button, Form, Input, Popconfirm, Select, Space, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CloudServerOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
} from '@/components/management-list'
import { formatDateTime } from '@/utils/time'
import { computeQueries, latestTaskForResource, ResourceTaskActions } from '@/features/compute'
import { dockerApi } from '../docker-api'
import { dockerQueries } from '../queries'
import type { DockerHost, DockerQuickCreateHostInput } from '../docker-types'
import { RuntimeHostStepModal } from './create-page'
import {
  ARCHITECTURE_OPTIONS,
  DockerAdminTable,
  HOST_STATUS_OPTIONS,
  architectureTag,
  compactRecord,
  formatBytes,
  normalizePage,
  pageTablePagination,
  refreshDocker,
  statusTag,
  type DockerFilterState,
  useDockerPermissions,
} from '../shared/ui'

const { Text } = Typography

interface QuickCreateHostFormValues extends DockerQuickCreateHostInput {
  memoryGiB?: number
  diskGiB?: number
}

export function buildQuickHostPayload(
  values: QuickCreateHostFormValues,
): DockerQuickCreateHostInput {
  return compactRecord({
    ...values,
    memoryBytes: values.memoryGiB ? Math.round(values.memoryGiB * 1024 ** 3) : values.memoryBytes,
    diskBytes: values.diskGiB ? Math.round(values.diskGiB * 1024 ** 3) : values.diskBytes,
    memoryGiB: undefined,
    diskGiB: undefined,
  })
}

function HostsTable({ embedded = false }: { embedded?: boolean }) {
  const [filters, setFilters] = useState<DockerFilterState>({
    page: 1,
    pageSize: embedded ? 5 : 10,
  })
  const [filterForm] = Form.useForm<DockerFilterState>()
  const [editorOpen, setEditorOpen] = useState(false)
  const [initialMode, setInitialMode] = useState<'existing' | 'provision'>('existing')
  const [editing, setEditing] = useState<DockerHost | null>(null)
  const { dockerModuleEnabled, canManageHosts, canViewOperations } = useDockerPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const hostsQuery = useQuery(dockerQueries.hosts(filters, dockerModuleEnabled))
  const tasksQuery = useQuery({
    ...computeQueries.tasks({ domain: 'container_runtime', limit: 100 }),
    enabled: dockerModuleEnabled && canViewOperations,
  })
  const deleteMutation = useMutation({
    mutationFn: dockerApi.deleteHost,
    onSuccess: () => {
      message.success('主机已删除')
      refreshDocker(queryClient)
    },
  })
  const page = normalizePage(hostsQuery.data, filters.page ?? 1, filters.pageSize ?? 10)
  const columns: ColumnsType<DockerHost> = [
    {
      title: '名称',
      dataIndex: 'name',
      fixed: 'left',
      width: 190,
      render: (value, record) => <Text strong>{value || record.id}</Text>,
    },
    { title: '状态', dataIndex: 'status', width: 110, render: statusTag },
    { title: '架构', dataIndex: 'architecture', width: 120, render: architectureTag },
    {
      title: 'Endpoint',
      dataIndex: 'endpoint',
      width: 220,
      render: (value, record) => value || record.ipAddress || '-',
    },
    {
      title: '环境/归属',
      width: 180,
      render: (_value, record) =>
        [record.environment, record.owner || record.team].filter(Boolean).join(' / ') || '-',
    },
    {
      title: 'VM',
      width: 180,
      render: (_value, record) =>
        record.vmName || record.vmId || record.virtualizationConnectionId || '-',
    },
    {
      title: '规格',
      width: 180,
      render: (_value, record) =>
        `${record.cpuCoreCount || '-'}C / ${formatBytes(record.memoryBytes)} / ${formatBytes(record.diskBytes)}`,
    },
    {
      title: '端口池',
      width: 140,
      render: (_value, record) =>
        record.availablePortStart && record.availablePortEnd
          ? `${record.availablePortStart}-${record.availablePortEnd}`
          : '-',
    },
    { title: '心跳', dataIndex: 'lastHeartbeatAt', width: 155, render: formatDateTime },
    {
      title: '最近任务',
      fixed: 'right',
      width: 188,
      render: (_value, record) => (
        <ResourceTaskActions
          task={latestTaskForResource(tasksQuery.data?.items ?? [], 'runtime_host', record.id)}
          resourceKind="runtime_host"
          resourceId={record.id}
        />
      ),
    },
    {
      title: '操作',
      align: 'center',
      fixed: 'right',
      width: 96,
      render: (_value, record) =>
        canManageHosts ? (
          <Space className="soha-row-action-icons">
            <ManagementIconButton
              aria-label="编辑主机"
              size="small"
              tooltip="编辑"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(record)
                setInitialMode('existing')
                setEditorOpen(true)
              }}
            />
            <Popconfirm
              title="确认删除 Docker 主机？"
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <ManagementIconButton
                aria-label="删除主机"
                size="small"
                tooltip="删除"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Space>
        ) : null,
    },
  ]
  return (
    <>
      {!embedded ? (
        <div className="soha-vrt-query">
          <ManagementQueryPanel
            form={filterForm}
            actions={
              <ManagementQueryActions
                loading={hostsQuery.isFetching}
                onReset={() => {
                  filterForm.resetFields()
                  setFilters({ page: 1, pageSize: filters.pageSize ?? 10 })
                }}
              />
            }
            onFinish={(values) => setFilters((current) => ({ ...current, ...values, page: 1 }))}
          >
            <ManagementKeywordField placeholder="主机、Endpoint、VM 或 IP" />
            <ManagementQueryField minWidth={132} width={150} name="status" label="状态">
              <Select
                allowClear
                placeholder="全部"
                options={HOST_STATUS_OPTIONS.map((item) => ({ value: item, label: item }))}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={148} width={170} name="architecture" label="架构">
              <Select allowClear placeholder="全部" options={ARCHITECTURE_OPTIONS} />
            </ManagementQueryField>
            <ManagementQueryField minWidth={150} width={180} name="environment" label="环境">
              <Input allowClear placeholder="dev / test" />
            </ManagementQueryField>
          </ManagementQueryPanel>
        </div>
      ) : null}
      <DockerAdminTable
        rowKey="id"
        enableColumnSelection={!embedded}
        loading={hostsQuery.isLoading}
        dataSource={page.items}
        columns={columns}
        scroll={{ x: 1528 }}
        pagination={pageTablePagination(page, embedded, setFilters)}
        actions={
          canManageHosts && !embedded ? (
            <>
              <Button
                icon={<CloudServerOutlined />}
                onClick={() => {
                  setEditing(null)
                  setInitialMode('provision')
                  setEditorOpen(true)
                }}
              >
                虚拟化快速构建
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null)
                  setInitialMode('existing')
                  setEditorOpen(true)
                }}
              >
                接入主机
              </Button>
            </>
          ) : null
        }
        enableDensity={!embedded}
        refreshing={hostsQuery.isFetching}
        showColumnSettings={!embedded}
        showRefresh={!embedded}
        onRefresh={() => hostsQuery.refetch()}
      />
      <RuntimeHostStepModal
        editing={editing}
        initialMode={initialMode}
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
      />
    </>
  )
}

export function DockerHostsPage() {
  return <ManagementDataPage className="soha-docker-page" tableNode={<HostsTable />} />
}
