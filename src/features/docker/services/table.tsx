import { useState } from 'react'
import { App, Form, Select, Space, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  FileTextOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
} from '@/components/management-list'
import { formatDateTime } from '@/utils/time'
import { dockerApi } from '../docker-api'
import { dockerQueries } from '../queries'
import type { DockerService } from '../docker-types'
import {
  DockerAdminTable,
  formatBytes,
  formatPercent,
  normalizePage,
  operationActionLabel,
  pageTablePagination,
  refreshDocker,
  statusTag,
  type DockerFilterState,
  useDockerOptions,
  useDockerPermissions,
} from '../shared/ui'

const { Text } = Typography

export function ServicesTable({
  embedded = false,
  fixedProjectId,
}: {
  embedded?: boolean
  fixedProjectId?: string
}) {
  const [filters, setFilters] = useState<DockerFilterState>({
    page: 1,
    pageSize: embedded ? 5 : 10,
    projectId: fixedProjectId,
  })
  const [filterForm] = Form.useForm<DockerFilterState>()
  const { dockerModuleEnabled, canManageServices } = useDockerPermissions()
  const { hostOptions, projectOptions } = useDockerOptions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const servicesQuery = useQuery(dockerQueries.services(filters, dockerModuleEnabled))
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      dockerApi.serviceAction(id, action),
    onSuccess: (_response, variables) => {
      message.success(`${variables.action} 任务已提交`)
      refreshDocker(queryClient)
    },
  })
  const page = normalizePage(servicesQuery.data, filters.page ?? 1, filters.pageSize ?? 10)
  const columns: ColumnsType<DockerService> = [
    {
      title: '服务',
      dataIndex: 'name',
      fixed: 'left',
      width: 180,
      render: (value, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.containerId || record.id}</Text>
        </Space>
      ),
    },
    { title: '状态', dataIndex: 'status', width: 110, render: statusTag },
    { title: '镜像', dataIndex: 'image', width: 240, render: (value) => value || '-' },
    {
      title: '项目',
      dataIndex: 'projectId',
      width: 180,
      render: (value) => projectOptions.find((item) => item.value === value)?.label || value,
    },
    {
      title: '主机',
      dataIndex: 'hostId',
      width: 170,
      render: (value) => hostOptions.find((item) => item.value === value)?.label || value,
    },
    { title: 'CPU', dataIndex: 'cpuPercent', width: 90, render: formatPercent },
    { title: '内存', dataIndex: 'memoryBytes', width: 110, render: formatBytes },
    {
      title: '网络',
      width: 150,
      render: (_value, record) =>
        `${formatBytes(record.networkRxBytes)} / ${formatBytes(record.networkTxBytes)}`,
    },
    { title: '重启', dataIndex: 'restartCount', width: 80 },
    { title: '最近同步', dataIndex: 'lastSeenAt', width: 155, render: formatDateTime },
    {
      title: '操作',
      align: 'center',
      fixed: 'right',
      width: 130,
      render: (_value, record) =>
        canManageServices ? (
          <Space className="soha-row-action-icons">
            {['restart', 'start', 'stop'].map((action) => (
              <ManagementIconButton
                key={action}
                aria-label={operationActionLabel(action)}
                size="small"
                tooltip={operationActionLabel(action)}
                icon={
                  action === 'restart' ? (
                    <ReloadOutlined />
                  ) : action === 'start' ? (
                    <PlayCircleOutlined />
                  ) : (
                    <PoweroffOutlined />
                  )
                }
                loading={actionMutation.isPending}
                onClick={() => actionMutation.mutate({ id: record.id, action })}
              />
            ))}
            <ManagementIconButton
              aria-label="查看日志"
              size="small"
              tooltip="日志"
              icon={<FileTextOutlined />}
              loading={actionMutation.isPending}
              onClick={() => actionMutation.mutate({ id: record.id, action: 'logs' })}
            />
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
                loading={servicesQuery.isFetching}
                onReset={() => {
                  filterForm.resetFields()
                  setFilters({
                    page: 1,
                    pageSize: filters.pageSize ?? 10,
                    projectId: fixedProjectId,
                  })
                }}
              />
            }
            onFinish={(values) =>
              setFilters((current) => ({
                ...current,
                ...values,
                projectId: fixedProjectId,
                page: 1,
              }))
            }
          >
            <ManagementKeywordField placeholder="服务、镜像或容器" />
            <ManagementQueryField minWidth={180} width={220} name="hostId" label="主机">
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                placeholder="全部主机"
                options={hostOptions}
              />
            </ManagementQueryField>
            {!fixedProjectId ? (
              <ManagementQueryField minWidth={180} width={220} name="projectId" label="项目">
                <Select
                  allowClear
                  showSearch={{ optionFilterProp: 'label' }}
                  placeholder="全部项目"
                  options={projectOptions}
                />
              </ManagementQueryField>
            ) : null}
            <ManagementQueryField minWidth={132} width={150} name="status" label="状态">
              <Select
                allowClear
                placeholder="全部"
                options={['defined', 'running', 'exited', 'failed', 'unknown'].map((item) => ({
                  value: item,
                  label: item,
                }))}
              />
            </ManagementQueryField>
          </ManagementQueryPanel>
        </div>
      ) : null}
      <DockerAdminTable
        rowKey="id"
        enableColumnSelection={!embedded}
        loading={servicesQuery.isLoading}
        dataSource={page.items}
        columns={columns}
        scroll={{ x: 1440 }}
        pagination={pageTablePagination(page, embedded, setFilters)}
        enableDensity={!embedded}
        refreshing={servicesQuery.isFetching}
        showColumnSettings={!embedded}
        showRefresh={!embedded}
        onRefresh={() => servicesQuery.refetch()}
      />
    </>
  )
}
