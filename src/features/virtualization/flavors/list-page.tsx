import { useMemo, useState } from 'react'
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
  Switch,
  Tag,
  Tooltip,
} from 'antd'
import type { DrawerProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ComponentProps } from 'react'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { hasAllowedAction } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { AdminTable } from '@/components/admin-table'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementTableToolbar,
  useManagementTextFilter,
} from '@/components/management-list'
import {
  virtualizationMutations,
  withVirtualizationMutationSuccess,
} from '@/features/virtualization/mutations'
import { virtualizationQueries } from '@/features/virtualization/queries'
import { useVirtualizationPermissions } from '@/features/virtualization/shared/use-virtualization-permissions'
import {
  ENABLED_FILTER_OPTIONS,
  classNames,
  localTableSummary,
} from '@/features/virtualization/virtualization-model'
import type { EnabledFilter } from '@/features/virtualization/virtualization-model'
import '@/features/virtualization/virtualization-workbench.css'
import type {
  VirtualizationFlavor,
  VirtualizationFlavorInput,
} from '@/features/virtualization/virtualization-types'

const stableDrawerMotion = null as unknown as DrawerProps['motion']

const tableEllipsis = { showTitle: false } as const

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

export function VirtualizationFlavorsPage() {
  const [editing, setEditing] = useState<VirtualizationFlavor | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [flavorFilters, setFlavorFilters] = useState<{ enabled?: EnabledFilter; search?: string }>({
    enabled: 'all',
  })
  const [filterForm] = Form.useForm<{ enabled?: EnabledFilter; search?: string }>()
  const [form] = Form.useForm<VirtualizationFlavorInput>()
  const { virtualizationModuleEnabled, canManageFlavors } = useVirtualizationPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const flavorsQuery = useQuery(virtualizationQueries.flavors(virtualizationModuleEnabled))
  const flavors = flavorsQuery.data ?? []
  const textFilteredFlavors = useManagementTextFilter(
    flavors,
    flavorFilters.search ?? '',
    (record) => [record.name, record.description],
  )
  const flavorRows = useMemo(() => {
    return textFilteredFlavors.filter((record) => {
      return flavorFilters.enabled === 'disabled'
        ? record.enabled === false
        : flavorFilters.enabled === 'enabled'
          ? record.enabled !== false
          : true
    })
  }, [flavorFilters.enabled, textFilteredFlavors])
  const afterSave = () => {
    message.success('规格已保存')
    setDrawerOpen(false)
    setEditing(null)
    form.resetFields()
  }
  const createMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.createFlavor(queryClient), afterSave),
  )
  const updateMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.updateFlavor(queryClient), afterSave),
  )
  const deleteMutation = useMutation(
    withVirtualizationMutationSuccess(virtualizationMutations.deleteFlavor(queryClient), () =>
      message.success('规格已删除'),
    ),
  )
  const savePending = createMutation.isPending || updateMutation.isPending
  function openEditor(record?: VirtualizationFlavor) {
    setEditing(record ?? null)
    form.setFieldsValue(record ?? { enabled: true })
    setDrawerOpen(true)
  }
  const columns: ColumnsType<VirtualizationFlavor> = [
    {
      title: '名称',
      dataIndex: 'name',
      fixed: 'left',
      render: tableTooltipText,
      ellipsis: tableEllipsis,
      width: 180,
    },
    { title: 'CPU', dataIndex: 'cpu', width: 90 },
    { title: '内存 MiB', dataIndex: 'memoryMiB', width: 120 },
    { title: '磁盘 GiB', dataIndex: 'diskGiB', width: 120 },
    {
      title: '状态',
      dataIndex: 'enabled',
      render: (value) => (value === false ? <Tag>禁用</Tag> : <Tag color="green">启用</Tag>),
      width: 100,
    },
    {
      title: '描述',
      dataIndex: 'description',
      render: (value) => tableTooltipText(value || '-'),
      ellipsis: tableEllipsis,
      width: 320,
    },
    {
      ...tableColumnPresets.action,
      title: '操作',
      render: (_value, record) => {
        const canUpdate = canManageFlavors && hasAllowedAction(record.allowedActions, 'update')
        const canDelete = canManageFlavors && hasAllowedAction(record.allowedActions, 'delete')
        if (!canUpdate && !canDelete) return null
        return (
          <Space className="soha-row-action-icons">
            {canUpdate ? (
              <ManagementIconButton
                aria-label="编辑规格"
                size="small"
                tooltip="编辑"
                icon={<EditOutlined />}
                onClick={() => openEditor(record)}
              />
            ) : null}
            {canDelete ? (
              <Popconfirm title="确认删除规格？" onConfirm={() => deleteMutation.mutate(record.id)}>
                <ManagementIconButton
                  aria-label="删除规格"
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
            loading={flavorsQuery.isFetching}
            onReset={() => {
              filterForm.resetFields()
              setFlavorFilters({ enabled: 'all' })
            }}
          />
        ),
        children: (
          <>
            <ManagementKeywordField label="关键字" placeholder="搜索规格名称或描述" />
            <ManagementQueryField minWidth={180} name="enabled" label="启用状态" width={180}>
              <Select options={ENABLED_FILTER_OPTIONS} />
            </ManagementQueryField>
          </>
        ),
        collapsible: true,
        form: filterForm,
        initialValues: { enabled: 'all' },
        onFinish: (values) =>
          setFlavorFilters({ enabled: values.enabled ?? 'all', search: values.search }),
        wrapperClassName: 'soha-vrt-query',
      }}
      tableNode={
        <VirtualizationAdminTable
          rowKey="id"
          headerExtra={
            canManageFlavors ? (
              <ManagementTableToolbar>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
                  新增规格
                </Button>
              </ManagementTableToolbar>
            ) : null
          }
          loading={flavorsQuery.isLoading}
          dataSource={flavorRows}
          columns={columns}
          paginationSummary={localTableSummary(flavorRows.length, flavors.length)}
          scroll={{ x: 1070 }}
        />
      }
      afterTable={
        <Drawer
          title={editing ? '编辑规格' : '新增规格'}
          size="large"
          motion={stableDrawerMotion}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{ cpu: 2, memoryMiB: 4096, diskGiB: 40, enabled: true }}
            onFinish={(values) =>
              editing
                ? updateMutation.mutate({ id: editing.id, payload: values })
                : createMutation.mutate(values)
            }
          >
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <div className="grid gap-3 md:grid-cols-3">
              <Form.Item name="cpu" label="CPU" rules={[{ required: true }]}>
                <InputNumber min={1} className="w-full" />
              </Form.Item>
              <Form.Item name="memoryMiB" label="内存 MiB" rules={[{ required: true }]}>
                <InputNumber min={128} className="w-full" />
              </Form.Item>
              <Form.Item name="diskGiB" label="磁盘 GiB" rules={[{ required: true }]}>
                <InputNumber min={1} className="w-full" />
              </Form.Item>
            </div>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
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
