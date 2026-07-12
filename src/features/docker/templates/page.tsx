import { useState } from 'react'
import {
  App,
  Button,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
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
import { dockerApi } from '../docker-api'
import { dockerQueries } from '../queries'
import type { DockerTemplate, DockerTemplateInput } from '../docker-types'
import {
  DEFAULT_COMPOSE,
  DockerAdminTable,
  DrawerFooter,
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
  const [filters, setFilters] = useState<DockerFilterState>({ page: 1, pageSize: 10 })
  const [filterForm] = Form.useForm<DockerFilterState>()
  const [form] = Form.useForm<DockerTemplateInput>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<DockerTemplate | null>(null)
  const { dockerModuleEnabled, canManageTemplates } = useDockerPermissions()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const templatesQuery = useQuery(dockerQueries.templates(filters, dockerModuleEnabled))
  const saveMutation = useMutation({
    mutationFn: (values: DockerTemplateInput) =>
      editing
        ? dockerApi.updateTemplate(editing.id, buildTemplatePayload(values))
        : dockerApi.createTemplate(buildTemplatePayload(values)),
    onSuccess: () => {
      message.success(editing ? '模板已更新' : '模板已创建')
      setDrawerOpen(false)
      setEditing(null)
      form.resetFields()
      refreshDocker(queryClient)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: dockerApi.deleteTemplate,
    onSuccess: () => {
      message.success('模板已删除')
      refreshDocker(queryClient)
    },
  })
  const page = normalizePage(templatesQuery.data, filters.page ?? 1, filters.pageSize ?? 10)
  const columns: ColumnsType<DockerTemplate> = [
    {
      title: '模板',
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
    { title: '类型', dataIndex: 'templateKind', width: 130, render: (value) => value || 'compose' },
    { title: '状态', dataIndex: 'enabled', width: 100, render: boolTag },
    {
      title: '变量',
      dataIndex: 'variables',
      width: 130,
      render: (value) => Object.keys(value ?? {}).length,
    },
    { title: '更新时间', dataIndex: 'updatedAt', width: 155, render: formatDateTime },
    {
      title: '操作',
      align: 'center',
      fixed: 'right',
      width: 96,
      render: (_value, record) =>
        canManageTemplates ? (
          <Space className="soha-row-action-icons">
            <ManagementIconButton
              aria-label="编辑模板"
              size="small"
              tooltip="编辑"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(record)
                form.setFieldsValue(record)
                setDrawerOpen(true)
              }}
            />
            <Popconfirm title="确认删除模板？" onConfirm={() => deleteMutation.mutate(record.id)}>
              <ManagementIconButton
                aria-label="删除模板"
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
      <div className="soha-vrt-query">
        <ManagementQueryPanel
          form={filterForm}
          actions={
            <ManagementQueryActions
              loading={templatesQuery.isFetching}
              onReset={() => {
                filterForm.resetFields()
                setFilters({ page: 1, pageSize: filters.pageSize ?? 10 })
              }}
            />
          }
          onFinish={(values) => setFilters((current) => ({ ...current, ...values, page: 1 }))}
        >
          <ManagementKeywordField placeholder="模板名称或描述" />
          <ManagementQueryField minWidth={132} width={150} name="kind" label="类型">
            <Select
              allowClear
              placeholder="全部"
              options={[{ value: 'compose', label: 'compose' }]}
            />
          </ManagementQueryField>
          <ManagementQueryField minWidth={132} width={150} name="enabled" label="启用">
            <Select
              allowClear
              placeholder="全部"
              options={[
                { value: true, label: '启用' },
                { value: false, label: '停用' },
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
          canManageTemplates ? (
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
                  setDrawerOpen(true)
                }}
              >
                新增模板
              </Button>
            </>
          ) : null
        }
        refreshing={templatesQuery.isFetching}
        onRefresh={() => templatesQuery.refetch()}
      />
      <Drawer
        title={editing ? '编辑模板' : '新增模板'}
        size="large"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <DrawerFooter
            form={form}
            loading={saveMutation.isPending}
            onCancel={() => setDrawerOpen(false)}
          />
        }
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="templateKind" label="类型">
              <Select options={[{ value: 'compose', label: 'compose' }]} />
            </Form.Item>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Form.Item name="description" label="描述">
            <Input />
          </Form.Item>
          <Tabs
            items={[
              {
                key: 'compose',
                label: 'Compose',
                children: (
                  <Form.Item name="composeContent">
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
        </Form>
      </Drawer>
    </>
  )
}

export function DockerTemplatesPage() {
  return <ManagementDataPage className="soha-docker-page" tableNode={<TemplatesTable />} />
}
