import { useState } from 'react'
import { App, Button, Form, Input, Popconfirm, Select, Space, Switch, Tabs, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementDataPage } from '@/components/management-data-page'
import { StepFormModal } from '@/components/step-form-modal'
import {
  ManagementIconButton,
  ManagementKeywordField,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementQueryPanel,
} from '@/components/management-list'
import { formatDateTime } from '@/utils/time'
import { localeText, useI18n } from '@/i18n'
import { dockerApi } from '../docker-api'
import { dockerQueries } from '../queries'
import type { DockerTemplate, DockerTemplateInput } from '../docker-types'
import {
  DEFAULT_COMPOSE,
  DockerAdminTable,
  boolTag,
  compactRecord,
  normalizePage,
  pageTablePagination,
  refreshDocker,
  type DockerFilterState,
  useDockerPermissions,
} from '../shared/ui'

const { Text } = Typography
const { TextArea } = Input

export function buildTemplatePayload(values: DockerTemplateInput): DockerTemplateInput {
  return compactRecord({
    ...values,
    templateKind: values.templateKind || 'compose',
    enabled: values.enabled !== false,
  })
}

function TemplatesTable() {
  const [filters, setFilters] = useState<DockerFilterState>({ page: 1, pageSize: 15 })
  const [filterForm] = Form.useForm<DockerFilterState>()
  const [form] = Form.useForm<DockerTemplateInput>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [editing, setEditing] = useState<DockerTemplate | null>(null)
  const { dockerModuleEnabled, canCreateTemplates, canUpdateTemplates, canDeleteTemplates } =
    useDockerPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const { localeCode } = useI18n()
  const templatesQuery = useQuery(dockerQueries.templates(filters, dockerModuleEnabled))
  const saveMutation = useMutation({
    mutationFn: (values: DockerTemplateInput) =>
      editing
        ? dockerApi.updateTemplate(editing.id, buildTemplatePayload(values))
        : dockerApi.createTemplate(buildTemplatePayload(values)),
    onSuccess: () => {
      message.success(
        editing
          ? localeText(localeCode, '模板已更新', 'Template updated')
          : localeText(localeCode, '模板已创建', 'Template created'),
      )
      setDrawerOpen(false)
      setEditing(null)
      form.resetFields()
      refreshDocker(queryClient)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: dockerApi.deleteTemplate,
    onSuccess: () => {
      message.success(localeText(localeCode, '模板已删除', 'Template deleted'))
      refreshDocker(queryClient)
    },
  })
  const page = normalizePage(templatesQuery.data, filters.page ?? 1, filters.pageSize ?? 15)
  const columns: ColumnsType<DockerTemplate> = [
    {
      title: localeText(localeCode, '模板', 'Template'),
      dataIndex: 'name',
      fixed: 'left',
      width: 220,
      render: (value, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.description || record.id}</Text>
        </Space>
      ),
    },
    {
      title: localeText(localeCode, '类型', 'Type'),
      dataIndex: 'templateKind',
      width: 130,
      render: (value) => value || 'compose',
    },
    {
      title: localeText(localeCode, '状态', 'Status'),
      dataIndex: 'enabled',
      width: 100,
      render: boolTag,
    },
    {
      title: localeText(localeCode, '变量', 'Variables'),
      dataIndex: 'variables',
      width: 130,
      render: (value) => Object.keys(value ?? {}).length,
    },
    {
      title: localeText(localeCode, '更新时间', 'Updated at'),
      dataIndex: 'updatedAt',
      width: 155,
      render: formatDateTime,
    },
    {
      title: localeText(localeCode, '操作', 'Actions'),
      align: 'center',
      className: 'soha-table-actions-column',
      fixed: 'right',
      width: 96,
      render: (_value, record) =>
        canUpdateTemplates || canDeleteTemplates ? (
          <Space className="soha-row-action-icons">
            {canUpdateTemplates ? (
              <ManagementIconButton
                aria-label={localeText(localeCode, '编辑模板', 'Edit template')}
                size="small"
                tooltip={localeText(localeCode, '编辑', 'Edit')}
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(record)
                  form.setFieldsValue(record)
                  setCurrentStep(0)
                  setDrawerOpen(true)
                }}
              />
            ) : null}
            {canDeleteTemplates ? (
              <Popconfirm
                title={localeText(localeCode, '确认删除模板？', 'Delete this template?')}
                onConfirm={() => deleteMutation.mutate(record.id)}
              >
                <ManagementIconButton
                  aria-label={localeText(localeCode, '删除模板', 'Delete template')}
                  size="small"
                  tooltip={localeText(localeCode, '删除', 'Delete')}
                  danger
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            ) : null}
          </Space>
        ) : null,
    },
  ]
  return (
    <>
      <div className="soha-vrt-query">
        <ManagementQueryPanel
          form={filterForm}
          actions={
            <ManagementQueryActions
              loading={templatesQuery.isFetching}
              onReset={() => {
                filterForm.resetFields()
                setFilters({ page: 1, pageSize: filters.pageSize ?? 15 })
              }}
            />
          }
          onFinish={(values) => setFilters((current) => ({ ...current, ...values, page: 1 }))}
        >
          <ManagementKeywordField
            placeholder={localeText(localeCode, '模板名称或描述', 'Template name or description')}
          />
          <ManagementQueryField
            minWidth={132}
            width={150}
            name="kind"
            label={localeText(localeCode, '类型', 'Type')}
          >
            <Select
              allowClear
              placeholder={localeText(localeCode, '全部', 'All')}
              options={[{ value: 'compose', label: 'compose' }]}
            />
          </ManagementQueryField>
          <ManagementQueryField
            minWidth={132}
            width={150}
            name="enabled"
            label={localeText(localeCode, '启用', 'Enabled')}
          >
            <Select
              allowClear
              placeholder={localeText(localeCode, '全部', 'All')}
              options={[
                { value: true, label: localeText(localeCode, '启用', 'Enabled') },
                { value: false, label: localeText(localeCode, '停用', 'Disabled') },
              ]}
            />
          </ManagementQueryField>
        </ManagementQueryPanel>
      </div>
      <DockerAdminTable
        rowKey="id"
        loading={templatesQuery.isLoading}
        dataSource={page.items}
        columns={columns}
        scroll={{ x: 860 }}
        pagination={pageTablePagination(page, false, setFilters)}
        actions={
          canCreateTemplates ? (
            <>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null)
                  form.setFieldsValue({
                    templateKind: 'compose',
                    composeContent: DEFAULT_COMPOSE,
                    enabled: true,
                  })
                  setCurrentStep(0)
                  setDrawerOpen(true)
                }}
              >
                {localeText(localeCode, '新增模板', 'Add template')}
              </Button>
            </>
          ) : null
        }
        refreshing={templatesQuery.isFetching}
        onRefresh={() => templatesQuery.refetch()}
      />
      <StepFormModal
        title={
          editing
            ? localeText(localeCode, '编辑模板', 'Edit template')
            : localeText(localeCode, '新增模板', 'Add template')
        }
        current={currentStep}
        form={form}
        loading={saveMutation.isPending}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCurrentChange={setCurrentStep}
        onFinish={(values) => saveMutation.mutate(values)}
        steps={[
          {
            title: localeText(localeCode, '基本信息', 'Basic information'),
            fieldNames: ['name', 'templateKind'],
            children: (
              <>
                <Form.Item
                  name="name"
                  label={localeText(localeCode, '名称', 'Name')}
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
                <div className="grid gap-3 md:grid-cols-2">
                  <Form.Item name="templateKind" label={localeText(localeCode, '类型', 'Type')}>
                    <Select options={[{ value: 'compose', label: 'compose' }]} />
                  </Form.Item>
                  <Form.Item
                    name="enabled"
                    label={localeText(localeCode, '启用', 'Enabled')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </div>
                <Form.Item name="description" label={localeText(localeCode, '描述', 'Description')}>
                  <Input />
                </Form.Item>
              </>
            ),
          },
          {
            title: localeText(localeCode, '模板内容', 'Template content'),
            fieldNames: ['composeContent'],
            children: (
              <Tabs
                items={[
                  {
                    key: 'compose',
                    label: 'Compose',
                    children: (
                      <Form.Item name="composeContent" rules={[{ required: true }]}>
                        <TextArea rows={16} spellCheck={false} />
                      </Form.Item>
                    ),
                  },
                  {
                    key: 'env',
                    label: '.env',
                    children: (
                      <Form.Item name="envContent">
                        <TextArea rows={10} spellCheck={false} />
                      </Form.Item>
                    ),
                  },
                ]}
              />
            ),
          },
        ]}
        submitText={localeText(localeCode, '保存', 'Save')}
        width={760}
      />
    </>
  )
}

export function DockerTemplatesPage() {
  return <ManagementDataPage className="soha-docker-page" tableNode={<TemplatesTable />} />
}
