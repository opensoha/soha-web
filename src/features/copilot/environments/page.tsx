import { useState } from 'react'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Popconfirm, Select } from 'antd'
import { ProductionOperationsPage } from '../production/operations-page'
import { AIWorkbenchFeatureGate } from '../production/feature-gate'
import { environmentMutations } from './mutations'
import { environmentQueries } from './queries'
import type { CreateEnvironmentTemplateInput } from './types'
export function EnvironmentsPage() {
  return (
    <AIWorkbenchFeatureGate features={['agent.environment_management']}>
      <EnvironmentsPageContent />
    </AIWorkbenchFeatureGate>
  )
}

function EnvironmentsPageContent() {
  const c = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<CreateEnvironmentTemplateInput>()
  const templates = useQuery(environmentQueries.templates())
  const leases = useQuery(environmentQueries.leases())
  const create = useMutation(environmentMutations.create(c))
  const release = useMutation(environmentMutations.release(c))
  const gc = useMutation(environmentMutations.gc(c))
  const submit = async () => {
    await create.mutateAsync(await form.validateFields())
    form.resetFields()
    setOpen(false)
  }
  return (
    <ProductionOperationsPage
      refreshing={templates.isFetching || leases.isFetching}
      onRefresh={() => void Promise.all([templates.refetch(), leases.refetch()])}
      actions={
        <>
          <Popconfirm title="确认运行环境 GC？" onConfirm={() => gc.mutate()}>
            <Button icon={<DeleteOutlined />}>运行 GC</Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            新建模板
          </Button>
        </>
      }
      tabs={[
        {
          key: 'templates',
          label: 'Templates',
          records: templates.data?.data ?? [],
          loading: templates.isLoading,
          error: templates.isError,
          emptyDescription: '创建 container 或 Kubernetes 隔离模板。',
        },
        {
          key: 'leases',
          label: 'Leases',
          records: leases.data?.data ?? [],
          loading: leases.isLoading,
          error: leases.isError,
          emptyDescription: 'Agent 或 Evaluation 获取环境后会显示租约。',
          actions: (row) => (
            <Popconfirm title="确认释放环境租约？" onConfirm={() => release.mutate(row.id)}>
              <Button danger type="link">
                释放
              </Button>
            </Popconfirm>
          ),
        },
      ]}
    >
      <Modal
        title="新建 Environment Template"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        confirmLoading={create.isPending}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={{ backend: 'container', isolationMode: 'read-only' }}
        >
          <Form.Item name="id" label="ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="backend" label="Backend" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'container', label: 'Container' },
                { value: 'kubernetes', label: 'Kubernetes' },
              ]}
            />
          </Form.Item>
          <Form.Item name="isolationMode" label="隔离模式" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'read-only', label: 'Read only' },
                { value: 'disposable-write', label: 'Disposable write' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </ProductionOperationsPage>
  )
}
