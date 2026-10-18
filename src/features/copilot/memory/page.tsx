import { useOperationMutation } from '@/components/use-operation-mutation'
import { queryAccessDenied, readableQueryData } from '@/utils/query-feedback'
import { PlusOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Select } from 'antd'
import { useEffect, useState } from 'react'
import { AIWorkbenchFeatureGate } from '../production/feature-gate'
import { ProductionOperationsPage } from '../production/operations-page'
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
  const remove = useOperationMutation(memoryMutations.deleteRecord(c), {
    label: ['删除 Memory', 'Delete memory'],
    target: (id) => id,
  })
  const create = useOperationMutation(memoryMutations.createPolicy(c), {
    label: ['创建 Memory 策略', 'Create memory policy'],
    target: (v) => v.id,
    receipt: (r) => ({ message: '创建 Memory 策略请求已返回', evidence: r.data.id }),
  })
  const writeBlocked = remove.blocked || create.blocked
  const blocked = writeBlocked || queryAccessDenied(records) || queryAccessDenied(policies)
  const openDenied = queryAccessDenied(create) || queryAccessDenied(policies)
  useEffect(() => {
    if (openDenied) {
      setOpen(false)
      form.resetFields()
    }
  }, [openDenied, form])
  const submit = async () => {
    if (blocked) return
    await create.mutateAsync(await form.validateFields())
    form.resetFields()
    setOpen(false)
  }
  return (
    <ProductionOperationsPage
      feedback={
        <>
          {' '}
          {remove.feedback}
          {!open ? create.feedback : null}{' '}
        </>
      }
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
        <Button
          disabled={blocked}
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            if (!blocked) {
              form.resetFields()
              create.reset()
              setOpen(true)
            }
          }}
        >
          新建策略
        </Button>
      }
      tabs={[
        {
          key: 'policies',
          label: 'Policies',
          records: readableQueryData(policies)?.data ?? [],
          loading: policies.isLoading,
          error: policies.error,
          hasReadData: policies.data !== undefined,
          emptyDescription: '创建显式同意和 TTL 策略。',
        },
        {
          key: 'records',
          label: 'Records',
          records: readableQueryData(records)?.data ?? [],
          loading: records.isLoading,
          error: records.error,
          hasReadData: records.data !== undefined,
          emptyDescription: '启用策略并产生可信事实后显示 Memory。',
          actions: (row) => (
            <Popconfirm
              disabled={blocked}
              title="确认删除并传播该 Memory？"
              onConfirm={() => remove.mutate(row.id)}
            >
              <Button disabled={blocked} danger type="link">
                删除并传播
              </Button>
            </Popconfirm>
          ),
        },
      ]}
    >
      <Modal
        title="新建 Memory Policy"
        open={open && !openDenied}
        closable={!writeBlocked}
        keyboard={!writeBlocked}
        mask={{ closable: !writeBlocked }}
        okButtonProps={{ disabled: blocked }}
        cancelButtonProps={{ disabled: writeBlocked }}
        onCancel={() => {
          if (!writeBlocked) {
            setOpen(false)
            form.resetFields()
          }
        }}
        onOk={() => void submit().catch(() => undefined)}
        confirmLoading={create.isPending}
        destroyOnHidden
      >
        <> {create.feedback} </>
        <Form
          disabled={blocked}
          form={form}
          layout="vertical"
          preserve={false}
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
