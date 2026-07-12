import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { DrawerProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ComponentProps } from 'react'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { hasAllowedAction } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { AdminTable } from '@/components/admin-table'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementTableToolbar,
} from '@/components/management-list'
import {
  virtualizationMutations,
  withVirtualizationMutationSuccess,
} from '@/features/virtualization/mutations'
import { virtualizationQueries } from '@/features/virtualization/queries'
import { useVirtualizationPermissions } from '@/features/virtualization/shared/use-virtualization-permissions'
import {
  STATUS_COLORS,
  VIRTUALIZATION_PROVIDER_OPTIONS,
  buildImagePayload,
  classNames,
  normalizePage,
  providerLabel,
  virtualizationPageSummary,
} from '@/features/virtualization/virtualization-model'
import '@/features/virtualization/virtualization-workbench.css'
import type {
  VirtualizationImage,
  VirtualizationImageInput,
  VirtualizationListParams,
  VirtualizationPage,
} from '@/features/virtualization/virtualization-types'

const { Text } = Typography

const stableDrawerMotion = null as unknown as DrawerProps['motion']

const tableEllipsis = { showTitle: false } as const

function statusTag(value?: string) {
  if (!value) return <Text type="secondary">-</Text>
  const key = value.toLowerCase()
  return <Tag color={STATUS_COLORS[key] ?? 'default'}>{value}</Tag>
}

function tableTooltipText(value: unknown) {
  const text = String(value ?? '').trim() || '-'
  const content = <span className="soha-vrt-table-tooltip-text">{text}</span>
  if (text === '-') return content
  return (
    <Tooltip
      placement="topLeft"
      title={<span className="soha-vrt-table-tooltip-content">{text}</span>}
    >
      {content}
    </Tooltip>
  )
}

function VirtualizationAdminTable({
  className,
  columnSettingIconOnly = true,
  columnSettingPlacement = 'header',
  shellClassName,
  tableSize = 'small',
  ...props
}: ComponentProps<typeof AdminTable>) {
  return (
    <AdminTable
      {...props}
      className={classNames('soha-vrt-table', className)}
      columnSettingIconOnly={columnSettingIconOnly}
      columnSettingPlacement={columnSettingPlacement}
      shellClassName={classNames('soha-management-table-shell', shellClassName)}
      tableSize={tableSize}
    />
  )
}

function pageTablePagination<T>(
  page: VirtualizationPage<T>,
  setFilters: React.Dispatch<React.SetStateAction<VirtualizationListParams>>,
) {
  return {
    current: page.page,
    pageSize: page.pageSize,
    total: page.total,
    onPageChange: (pageNumber: number) =>
      setFilters((current) => ({ ...current, page: pageNumber })),
    onPageSizeChange: (pageSize: number) =>
      setFilters((current) => ({ ...current, page: 1, pageSize })),
  }
}

export function VirtualizationImagesPage() {
  const [editing, setEditing] = useState<VirtualizationImage | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filters, setFilters] = useState<VirtualizationListParams>({ page: 1, pageSize: 10 })
  const [filterForm] = Form.useForm<VirtualizationListParams>()
  const [form] = Form.useForm<VirtualizationImageInput>()
  const { virtualizationModuleEnabled, canManageImages } = useVirtualizationPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const imageProvider = Form.useWatch('provider', form) ?? 'kubevirt'
  const imagesQuery = useQuery(virtualizationQueries.images(filters, virtualizationModuleEnabled))
  const clustersQuery = useQuery(virtualizationQueries.clusters(virtualizationModuleEnabled))
  const imagesPage = normalizePage(imagesQuery.data, filters.page ?? 1, filters.pageSize ?? 10)
  const clusters = clustersQuery.data ?? []
  const afterSave = () => {
    message.success('镜像入口已保存')
    setDrawerOpen(false)
    setEditing(null)
    form.resetFields()
  }
  const createMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.createImage(queryClient), afterSave),
  )
  const updateMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.updateImage(queryClient), afterSave),
  )
  const deleteMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.deleteImage(queryClient), () =>
      message.success('镜像入口已删除'),
    ),
  )
  const savePending = createMutation.isPending || updateMutation.isPending
  function openImageEditor(record?: VirtualizationImage) {
    setEditing(record ?? null)
    form.setFieldsValue(
      record
        ? {
            name: record.name,
            provider: record.provider ?? 'kubevirt',
            connectionId: record.connectionId,
            namespace: record.namespace,
            sourceKind: record.sourceKind ?? record.source,
            sourceRef: record.sourceRef,
            source: record.source,
            osType: record.osType,
            sizeGiB: record.sizeGiB,
            description: record.description,
          }
        : { provider: 'kubevirt', sourceKind: 'datasource' },
    )
    setDrawerOpen(true)
  }
  const columns: ColumnsType<VirtualizationImage> = [
    {
      title: '名称',
      dataIndex: 'name',
      fixed: 'left',
      render: tableTooltipText,
      ellipsis: tableEllipsis,
      width: 180,
    },
    { title: 'Provider', dataIndex: 'provider', render: providerLabel, width: 120 },
    {
      title: '连接',
      dataIndex: 'connectionName',
      render: (value, record) => tableTooltipText(value || record.connectionId || '-'),
      ellipsis: tableEllipsis,
      width: 200,
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      render: (value) => tableTooltipText(value || '-'),
      ellipsis: tableEllipsis,
      width: 160,
    },
    {
      title: '来源',
      render: (_value, record) =>
        tableTooltipText(record.assetKind || record.sourceKind || record.source || '-'),
      ellipsis: tableEllipsis,
      width: 160,
    },
    {
      title: '引用',
      dataIndex: 'sourceRef',
      render: (value) => tableTooltipText(value || '-'),
      ellipsis: tableEllipsis,
      width: 280,
    },
    {
      title: '节点/存储',
      render: (_value, record) =>
        tableTooltipText([record.node, record.storage].filter(Boolean).join(' / ') || '-'),
      ellipsis: tableEllipsis,
      width: 200,
    },
    {
      title: 'StorageClass',
      dataIndex: 'storageClass',
      render: (value) => tableTooltipText(value || '-'),
      ellipsis: tableEllipsis,
      width: 200,
    },
    {
      title: '可用性',
      render: (_value, record) =>
        record.ready === false ? <Tag color="red">不可用</Tag> : <Tag color="green">可用</Tag>,
      width: 110,
    },
    {
      title: '系统',
      dataIndex: 'osType',
      render: (value) => tableTooltipText(value || '-'),
      ellipsis: tableEllipsis,
      width: 120,
    },
    {
      title: '大小',
      dataIndex: 'sizeGiB',
      render: (value) => (value ? `${value} GiB` : '-'),
      width: 100,
    },
    { title: '状态', dataIndex: 'status', render: statusTag, width: 120 },
    {
      ...tableColumnPresets.datetime,
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: formatDateTime,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      render: (_value, record) => {
        const canUpdate = canManageImages && hasAllowedAction(record.allowedActions, 'update')
        const canDelete = canManageImages && hasAllowedAction(record.allowedActions, 'delete')
        if (!canUpdate && !canDelete) return null
        return (
          <Space className="soha-row-action-icons">
            {canUpdate ? (
              <ManagementIconButton
                aria-label="编辑镜像"
                size="small"
                tooltip="编辑"
                icon={<EditOutlined />}
                onClick={() => openImageEditor(record)}
              />
            ) : null}
            {canDelete ? (
              <Popconfirm
                title="确认删除镜像入口？"
                onConfirm={() => deleteMutation.mutate(record.id)}
              >
                <ManagementIconButton
                  aria-label="删除镜像"
                  size="small"
                  tooltip="删除"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            ) : null}
          </Space>
        )
      },
    },
  ]
  return (
    <ManagementDataPage
      className="soha-virtualization-page"
      query={{
        actions: (
          <ManagementQueryActions
            loading={imagesQuery.isFetching}
            onReset={() => {
              filterForm.resetFields()
              setFilters((current) => ({ page: 1, pageSize: current.pageSize ?? 10 }))
            }}
          />
        ),
        children: (
          <>
            <ManagementKeywordField label="关键字" placeholder="搜索镜像、模板或 ISO" />
            <ManagementQueryField minWidth={180} name="connectionId" label="连接" width={180}>
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                placeholder="全部连接"
                options={clusters.map((item) => ({ value: item.id, label: item.name }))}
              />
            </ManagementQueryField>
            <ManagementQueryField minWidth={160} name="provider" label="Provider" width={160}>
              <Select
                allowClear
                placeholder="全部 Provider"
                options={VIRTUALIZATION_PROVIDER_OPTIONS}
              />
            </ManagementQueryField>
          </>
        ),
        collapsible: true,
        form: filterForm,
        onFinish: (values) => setFilters((current) => ({ ...current, ...values, page: 1 })),
        wrapperClassName: 'soha-vrt-query',
      }}
      tableNode={
        <VirtualizationAdminTable
          rowKey="id"
          headerExtra={
            canManageImages ? (
              <ManagementTableToolbar>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openImageEditor()}>
                  新增镜像入口
                </Button>
              </ManagementTableToolbar>
            ) : null
          }
          loading={imagesQuery.isLoading}
          dataSource={imagesPage.items}
          columns={columns}
          scroll={{ x: 2270 }}
          pagination={pageTablePagination(imagesPage, setFilters)}
          paginationSummary={virtualizationPageSummary}
        />
      }
      afterTable={
        <Drawer
          title={editing ? '编辑镜像入口' : '新增镜像入口'}
          size="large"
          motion={stableDrawerMotion}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{ provider: 'kubevirt', sourceKind: 'datasource' }}
            onFinish={(values) => {
              const payload = buildImagePayload(values)
              if (editing) updateMutation.mutate({ id: editing.id, payload })
              else createMutation.mutate(payload)
            }}
          >
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <div className="grid gap-3 md:grid-cols-2">
              <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'kubevirt', label: 'KubeVirt' },
                    { value: 'pve', label: 'PVE' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="connectionId" label="连接" rules={[{ required: true }]}>
                <Select
                  showSearch={{ optionFilterProp: 'label' }}
                  options={clusters
                    .filter((item) => !imageProvider || item.provider === imageProvider)
                    .map((item) => ({ value: item.id, label: item.name }))}
                />
              </Form.Item>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Form.Item name="sourceKind" label="来源类型" rules={[{ required: true }]}>
                <Select
                  options={
                    imageProvider === 'pve'
                      ? [
                          { value: 'template', label: 'PVE template' },
                          { value: 'iso', label: 'PVE ISO' },
                        ]
                      : [
                          { value: 'datasource', label: 'KubeVirt DataSource' },
                          { value: 'pvc', label: 'PVC' },
                        ]
                  }
                />
              </Form.Item>
              <Form.Item name="sourceRef" label="来源引用" rules={[{ required: true }]}>
                <Input
                  placeholder={
                    imageProvider === 'pve'
                      ? 'local:vztmpl/ubuntu.tar.zst 或 local:iso/ubuntu.iso'
                      : 'namespace/name'
                  }
                />
              </Form.Item>
            </div>
            {imageProvider === 'kubevirt' ? (
              <Form.Item name="namespace" label="命名空间">
                <Input />
              </Form.Item>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <Form.Item name="osType" label="操作系统">
                <Input placeholder="ubuntu / windows / centos" />
              </Form.Item>
              <Form.Item name="sizeGiB" label="大小 GiB">
                <InputNumber min={1} className="w-full" />
              </Form.Item>
            </div>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={savePending}>
                保存
              </Button>
              <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            </Space>
          </Form>
        </Drawer>
      }
    />
  )
}
