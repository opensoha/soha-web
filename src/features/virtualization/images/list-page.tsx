import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { hasAllowedAction } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import { tableColumnPresets } from '@/utils/table-columns'
import { StepFormModal } from '@/components/step-form-modal'
import { BooleanTag, MetadataTag, StatusTag } from '@/components/status-tag'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
} from '@/components/management-list'
import {
  virtualizationMutations,
  withVirtualizationMutationSuccess,
} from '@/features/virtualization/mutations'
import { virtualizationQueries } from '@/features/virtualization/queries'
import { useVirtualizationPermissions } from '@/features/virtualization/shared/use-virtualization-permissions'
import { VirtualizationAdminTable } from '@/features/virtualization/shared/ui'
import {
  VIRTUALIZATION_PROVIDER_OPTIONS,
  buildImagePayload,
  normalizePage,
  providerLabel,
  virtualizationPageSummary,
} from '@/features/virtualization/virtualization-model'
import '@/features/virtualization/virtualization-workbench.css'
import type {
  VirtualizationImageCategory,
  VirtualizationImage,
  VirtualizationImageInput,
  VirtualizationListParams,
  VirtualizationPage,
} from '@/features/virtualization/virtualization-types'

const { Text } = Typography

const tableEllipsis = { showTitle: false } as const

function statusTag(value?: string) {
  if (!value) return <Text type="secondary">-</Text>
  return <StatusTag value={value} />
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

function imageResourceType(record: VirtualizationImage) {
  const sourceKind = String(record.assetKind || record.sourceKind || record.source || '')
    .trim()
    .toLowerCase()
  const contentType = String(record.config?.contentType || '')
    .trim()
    .toLowerCase()
  if (sourceKind === 'template') return 'VM 模板'
  if (sourceKind === 'lxc_template' || contentType === 'vztmpl') return 'CT 模板'
  if (sourceKind === 'iso' || contentType === 'iso') return 'ISO 镜像'
  if (contentType === 'images') return 'VM 磁盘'
  if (contentType === 'rootdir') return 'CT 根卷'
  return (
    {
      datasource: 'DataSource',
      pvc: 'PVC 镜像源',
      storage: '存储池',
      storage_content: '存储内容',
      image: '磁盘/卷',
      images: 'VM 磁盘',
      rootdir: 'CT 根卷',
      datavolume: 'DataVolume',
      persistentvolumeclaim: 'PVC 卷',
    }[sourceKind] ||
    sourceKind ||
    '-'
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

interface VirtualizationImagesPageProps {
  category?: VirtualizationImageCategory
}

export function VirtualizationImagesPage({
  category: imageCategory = 'catalog',
}: VirtualizationImagesPageProps = {}) {
  const [editing, setEditing] = useState<VirtualizationImage | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [filters, setFilters] = useState<VirtualizationListParams>({ page: 1, pageSize: 10 })
  const [filterForm] = Form.useForm<VirtualizationListParams>()
  const [form] = Form.useForm<VirtualizationImageInput>()
  const { virtualizationModuleEnabled, canCreateImages, canUpdateImages, canDeleteImages } =
    useVirtualizationPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const imageProvider = Form.useWatch('provider', form) ?? 'kubevirt'
  const imagesQuery = useQuery(
    virtualizationQueries.images(
      { ...filters, category: imageCategory },
      virtualizationModuleEnabled,
    ),
  )
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
    setCurrentStep(0)
    form.resetFields()
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
    {
      title: 'Provider',
      dataIndex: 'provider',
      render: (value: string) => (
        <MetadataTag label={providerLabel(value)} tone={value === 'pve' ? 'gold' : 'blue'} />
      ),
      width: 120,
    },
    {
      title: '连接',
      dataIndex: 'connectionName',
      render: (value, record) => tableTooltipText(value || record.connectionId || '-'),
      ellipsis: tableEllipsis,
      width: 200,
    },
    {
      title: '类型',
      render: (_value, record) => (
        <MetadataTag
          label={imageResourceType(record)}
          tone={imageCategory === 'storage' ? 'gold' : 'blue'}
        />
      ),
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
      title: '可用性',
      render: (_value, record) => (
        <BooleanTag
          value={record.ready !== false}
          trueLabel="可用"
          falseLabel="不可用"
          falseColor="error"
        />
      ),
      width: 110,
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
        const canUpdate = canUpdateImages && hasAllowedAction(record.allowedActions, 'update')
        const canDelete = canDeleteImages && hasAllowedAction(record.allowedActions, 'delete')
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
  if (imageCategory === 'storage') columns.splice(-1)
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
            <ManagementKeywordField
              label="关键字"
              placeholder={
                imageCategory === 'catalog' ? '搜索镜像、模板或 ISO' : '搜索存储、磁盘或卷'
              }
            />
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
          actions={
            canCreateImages && imageCategory === 'catalog' ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openImageEditor()}>
                新增镜像入口
              </Button>
            ) : null
          }
          refreshing={imagesQuery.isFetching}
          onRefresh={() => void imagesQuery.refetch()}
          loading={imagesQuery.isLoading}
          dataSource={imagesPage.items}
          columns={columns}
          scroll={{ x: 1546 }}
          pagination={pageTablePagination(imagesPage, setFilters)}
          paginationSummary={virtualizationPageSummary}
          expandable={{
            expandedRowRender: (record: VirtualizationImage) => (
              <Descriptions
                size="small"
                bordered
                column={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 2 }}
              >
                <Descriptions.Item label="命名空间">{record.namespace || '-'}</Descriptions.Item>
                <Descriptions.Item label="系统">{record.osType || '-'}</Descriptions.Item>
                <Descriptions.Item label="节点">{record.node || '-'}</Descriptions.Item>
                <Descriptions.Item label="存储">{record.storage || '-'}</Descriptions.Item>
                <Descriptions.Item label="StorageClass">
                  {record.storageClass || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="来源类型">
                  {record.sourceKind || record.source || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="来源引用" span="filled">
                  {record.sourceRef || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="描述" span="filled">
                  {record.description || '-'}
                </Descriptions.Item>
              </Descriptions>
            ),
          }}
        />
      }
      afterTable={
        <StepFormModal
          title={editing ? '编辑镜像入口' : '新增镜像入口'}
          current={currentStep}
          form={form}
          loading={savePending}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onCurrentChange={setCurrentStep}
          initialValues={{ provider: 'kubevirt', sourceKind: 'datasource' }}
          onFinish={(values) => {
            const payload = buildImagePayload(values)
            if (editing) updateMutation.mutate({ id: editing.id, payload })
            else createMutation.mutate(payload)
          }}
          steps={[
            {
              title: '基本信息',
              fieldNames: ['name', 'provider', 'connectionId'],
              children: (
                <>
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
                </>
              ),
            },
            {
              title: '来源配置',
              fieldNames: ['sourceKind', 'sourceRef'],
              children: (
                <>
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
                          imageProvider === 'pve' ? 'VMID 或 storage:volume' : 'namespace/name'
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
                      <Input placeholder="alpine / ubuntu / windows" />
                    </Form.Item>
                    <Form.Item name="sizeGiB" label="大小 GiB">
                      <InputNumber min={1} className="w-full" />
                    </Form.Item>
                  </div>
                  <Form.Item name="description" label="描述">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </>
              ),
            },
          ]}
          submitText="保存"
        />
      }
    />
  )
}
