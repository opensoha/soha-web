import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { hasAllowedAction } from '@/features/auth'
import { tableColumnPresets } from '@/utils/table-columns'
import { StepFormModal } from '@/components/step-form-modal'
import { BooleanTag } from '@/components/status-tag'
import { ManagementDataPage } from '@/components/management-data-page'
import { localeText, useI18n } from '@/i18n'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  useManagementTextFilter,
} from '@/components/management-list'
import {
  virtualizationMutations,
  withVirtualizationMutationSuccess,
} from '@/features/virtualization/mutations'
import { virtualizationQueries } from '@/features/virtualization/queries'
import { useVirtualizationPermissions } from '@/features/virtualization/shared/use-virtualization-permissions'
import { VirtualizationAdminTable } from '@/features/virtualization/shared/ui'
import {
  ENABLED_FILTER_OPTIONS,
  localTableSummary,
} from '@/features/virtualization/virtualization-model'
import type { EnabledFilter } from '@/features/virtualization/virtualization-model'
import '@/features/virtualization/virtualization-workbench.css'
import type {
  VirtualizationFlavor,
  VirtualizationFlavorInput,
} from '@/features/virtualization/virtualization-types'

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

export function VirtualizationFlavorsPage() {
  const [editing, setEditing] = useState<VirtualizationFlavor | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [flavorFilters, setFlavorFilters] = useState<{ enabled?: EnabledFilter; search?: string }>({
    enabled: 'all',
  })
  const [filterForm] = Form.useForm<{ enabled?: EnabledFilter; search?: string }>()
  const [form] = Form.useForm<VirtualizationFlavorInput>()
  const { virtualizationModuleEnabled, canCreateFlavors, canUpdateFlavors, canDeleteFlavors } =
    useVirtualizationPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const { localeCode } = useI18n()
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
    message.success(localeText(localeCode, '规格已保存', 'Flavor saved'))
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
      message.success(localeText(localeCode, '规格已删除', 'Flavor deleted')),
    ),
  )
  const savePending = createMutation.isPending || updateMutation.isPending
  function openEditor(record?: VirtualizationFlavor) {
    setEditing(record ?? null)
    setCurrentStep(0)
    form.resetFields()
    form.setFieldsValue(record ?? { enabled: true })
    setDrawerOpen(true)
  }
  const columns: ColumnsType<VirtualizationFlavor> = [
    {
      title: localeText(localeCode, '名称', 'Name'),
      dataIndex: 'name',
      fixed: 'left',
      render: tableTooltipText,
      ellipsis: tableEllipsis,
      width: 180,
    },
    { title: 'CPU', dataIndex: 'cpu', width: 90 },
    { title: localeText(localeCode, '内存 MiB', 'Memory MiB'), dataIndex: 'memoryMiB', width: 120 },
    { title: localeText(localeCode, '磁盘 GiB', 'Disk GiB'), dataIndex: 'diskGiB', width: 120 },
    {
      title: localeText(localeCode, '状态', 'Status'),
      dataIndex: 'enabled',
      render: (value) => (
        <BooleanTag
          value={value !== false}
          trueLabel={localeText(localeCode, '启用', 'Enabled')}
          falseLabel={localeText(localeCode, '禁用', 'Disabled')}
        />
      ),
      width: 100,
    },
    {
      title: localeText(localeCode, '描述', 'Description'),
      dataIndex: 'description',
      render: (value) => tableTooltipText(value || '-'),
      ellipsis: tableEllipsis,
      width: 320,
    },
    {
      ...tableColumnPresets.action,
      title: localeText(localeCode, '操作', 'Actions'),
      render: (_value, record) => {
        const canUpdate = canUpdateFlavors && hasAllowedAction(record.allowedActions, 'update')
        const canDelete = canDeleteFlavors && hasAllowedAction(record.allowedActions, 'delete')
        if (!canUpdate && !canDelete) return null
        return (
          <Space className="soha-row-action-icons">
            {canUpdate ? (
              <ManagementIconButton
                aria-label={localeText(localeCode, '编辑规格', 'Edit flavor')}
                size="small"
                tooltip={localeText(localeCode, '编辑', 'Edit')}
                icon={<EditOutlined />}
                onClick={() => openEditor(record)}
              />
            ) : null}
            {canDelete ? (
              <Popconfirm
                title={localeText(localeCode, '确认删除规格？', 'Delete this flavor?')}
                onConfirm={() => deleteMutation.mutate(record.id)}
              >
                <ManagementIconButton
                  aria-label={localeText(localeCode, '删除规格', 'Delete flavor')}
                  size="small"
                  tooltip={localeText(localeCode, '删除', 'Delete')}
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
            <ManagementKeywordField
              label={localeText(localeCode, '关键字', 'Keyword')}
              placeholder={localeText(
                localeCode,
                '搜索规格名称或描述',
                'Search flavor name or description',
              )}
            />
            <ManagementQueryField
              minWidth={180}
              name="enabled"
              label={localeText(localeCode, '启用状态', 'Enabled')}
              width={180}
            >
              <Select
                options={ENABLED_FILTER_OPTIONS.map((option) => ({
                  ...option,
                  label:
                    option.value === 'all'
                      ? localeText(localeCode, '全部', 'All')
                      : option.value === 'enabled'
                        ? localeText(localeCode, '仅启用', 'Enabled only')
                        : localeText(localeCode, '仅禁用', 'Disabled only'),
                }))}
              />
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
          actions={
            canCreateFlavors ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
                {localeText(localeCode, '新增规格', 'Add flavor')}
              </Button>
            ) : null
          }
          refreshing={flavorsQuery.isFetching}
          onRefresh={() => void flavorsQuery.refetch()}
          loading={flavorsQuery.isLoading}
          dataSource={flavorRows}
          columns={columns}
          paginationSummary={localeText(
            localeCode,
            localTableSummary(flavorRows.length, flavors.length),
            `${flavorRows.length} of ${flavors.length}`,
          )}
          scroll={{ x: 1070 }}
        />
      }
      afterTable={
        <StepFormModal
          title={
            editing
              ? localeText(localeCode, '编辑规格', 'Edit flavor')
              : localeText(localeCode, '新增规格', 'Add flavor')
          }
          current={currentStep}
          form={form}
          loading={savePending}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onCurrentChange={setCurrentStep}
          onFinish={(values) =>
            editing
              ? updateMutation.mutate({ id: editing.id, payload: values })
              : createMutation.mutate(values)
          }
          initialValues={{ cpu: 2, memoryMiB: 4096, diskGiB: 40, enabled: true }}
          steps={[
            {
              title: localeText(localeCode, '基本信息', 'Basic information'),
              fieldNames: ['name'],
              children: (
                <>
                  <Form.Item
                    name="name"
                    label={localeText(localeCode, '名称', 'Name')}
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="enabled"
                    label={localeText(localeCode, '启用', 'Enabled')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </>
              ),
            },
            {
              title: localeText(localeCode, '资源规格', 'Resources'),
              fieldNames: ['cpu', 'memoryMiB', 'diskGiB'],
              children: (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Form.Item name="cpu" label="CPU" rules={[{ required: true }]}>
                      <InputNumber min={1} className="w-full" />
                    </Form.Item>
                    <Form.Item
                      name="memoryMiB"
                      label={localeText(localeCode, '内存 MiB', 'Memory MiB')}
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={128} className="w-full" />
                    </Form.Item>
                    <Form.Item
                      name="diskGiB"
                      label={localeText(localeCode, '磁盘 GiB', 'Disk GiB')}
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={1} className="w-full" />
                    </Form.Item>
                  </div>
                  <Form.Item
                    name="description"
                    label={localeText(localeCode, '描述', 'Description')}
                  >
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </>
              ),
            },
          ]}
          submitText={localeText(localeCode, '保存', 'Save')}
        />
      }
    />
  )
}
