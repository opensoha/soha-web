import { useState } from 'react'
import { PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, InputNumber, Modal, Select } from 'antd'
import { ProductionOperationsPage } from '../production/operations-page'
import { AIWorkbenchFeatureGate } from '../production/feature-gate'
import { memoryMutations } from './mutations'
import { memoryQueries } from './queries'
import type { CreateMemoryPolicyInput } from './types'
export function MemoryPoliciesPage() {
  return (
    <AIWorkbenchFeatureGate features={['memory.long_term']}>
      <MemoryPoliciesPageContent />
    </AIWorkbenchFeatureGate>
  )
}

function MemoryPoliciesPageContent() {
  const c = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<CreateMemoryPolicyInput>()
  const records = useQuery(memoryQueries.records())
  const policies = useQuery(memoryQueries.policies())
  const remove = useMutation(memoryMutations.deleteRecord(c))
  const create = useMutation(memoryMutations.createPolicy(c))
  const submit = async () => {
    await create.mutateAsync(await form.validateFields())
    form.resetFields()
    setOpen(false)
  }
  return (
    <ProductionOperationsPage
      title="Memory Policies"
      description="管理长期 Memory 的同意、TTL、来源追踪与删除传播。"
      notice={
        <Alert
          showIcon
          type="info"
          title="长期 Memory 默认关闭"
          description="只有显式同意且命中启用策略时才能写入；删除和 ACL 变化必须 fail closed。"
        />
      }
      refreshing={records.isFetching || policies.isFetching}
      onRefresh={() => void Promise.all([records.refetch(), policies.refetch()])}
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          新建策略
        </Button>
      }
      tabs={[
        {
          key: 'policies',
          label: 'Policies',
          records: policies.data?.data ?? [],
          loading: policies.isLoading,
          error: policies.isError,
          emptyDescription: '创建显式同意和 TTL 策略。',
        },
        {
          key: 'records',
          label: 'Records',
          records: records.data?.data ?? [],
          loading: records.isLoading,
          error: records.isError,
          emptyDescription: '启用策略并产生可信事实后显示 Memory。',
          actions: (row) => (
            <Button danger type="link" onClick={() => remove.mutate(row.id)}>
              删除并传播
            </Button>
          ),
        },
        {
          key: 'provenance',
          label: 'Context Provenance',
          records: [],
          emptyDescription: 'Memory 记录的 SourceRef、TraceRef 和用户动作在详情证据中展示。',
        },
      ]}
    >
      <Modal
        title="新建 Memory Policy"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        confirmLoading={create.isPending}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ consentMode: 'explicit', ttlDays: 30 }}
        >
          <Form.Item name="id" label="ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="consentMode" label="Consent" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'explicit', label: 'Explicit' },
                { value: 'disabled', label: 'Disabled' },
              ]}
            />
          </Form.Item>
          <Form.Item name="ttlDays" label="TTL (days)" rules={[{ required: true }]}>
            <InputNumber min={1} max={365} />
          </Form.Item>
        </Form>
      </Modal>
    </ProductionOperationsPage>
  )
}
