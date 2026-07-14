import { useState } from 'react'
import { PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, InputNumber, Modal, Space } from 'antd'
import { ProductionOperationsPage } from '../production/operations-page'
import { AIWorkbenchFeatureGate } from '../production/feature-gate'
import { providerFleetMutations } from './mutations'
import { providerFleetQueries } from './queries'
import type { CreateRolloutInput } from './types'
export function ProviderFleetPage() {
  return (
    <AIWorkbenchFeatureGate features={['agent.fleet_rollout', 'agent.conformance_suite']}>
      <ProviderFleetPageContent />
    </AIWorkbenchFeatureGate>
  )
}

function ProviderFleetPageContent() {
  const c = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<CreateRolloutInput>()
  const rollouts = useQuery(providerFleetQueries.rollouts())
  const runs = useQuery(providerFleetQueries.conformance())
  const rollout = useMutation(providerFleetMutations.rollout(c))
  const action = useMutation(providerFleetMutations.action(c))
  const submit = async () => {
    const v = await form.validateFields()
    await rollout.mutateAsync({
      ...v,
      environments: String(v.environments || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    } as CreateRolloutInput)
    form.resetFields()
    setOpen(false)
  }
  return (
    <ProductionOperationsPage
      title="Provider Fleet"
      description="以 canary、批次与 LKG 约束 Agent Provider fleet rollout，并运行 adapter conformance。"
      refreshing={rollouts.isFetching || runs.isFetching}
      onRefresh={() => void Promise.all([rollouts.refetch(), runs.refetch()])}
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          新建 Rollout
        </Button>
      }
      tabs={[
        {
          key: 'rollouts',
          label: 'Rollouts',
          records: rollouts.data?.data ?? [],
          loading: rollouts.isLoading,
          error: rollouts.isError,
          emptyDescription: '选择目标环境和期望修订后启动 canary。',
          actions: (row) => (
            <Space>
              <Button type="link" onClick={() => action.mutate({ id: row.id, action: 'pause' })}>
                暂停
              </Button>
              <Button type="link" onClick={() => action.mutate({ id: row.id, action: 'resume' })}>
                继续
              </Button>
              <Button
                danger
                type="link"
                onClick={() => action.mutate({ id: row.id, action: 'rollback' })}
              >
                回滚
              </Button>
            </Space>
          ),
        },
        {
          key: 'conformance',
          label: 'Conformance',
          records: runs.data?.data ?? [],
          loading: runs.isLoading,
          error: runs.isError,
          emptyDescription: 'Provider 与 Environment 组合验证后显示结果。',
        },
      ]}
    >
      <Modal
        title="新建 Provider Rollout"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        confirmLoading={rollout.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ canaryPercent: 10 }}>
          <Form.Item name="id" label="ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="desiredRevision" label="Desired Revision" rules={[{ required: true }]}>
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="environments" label="Environment IDs" rules={[{ required: true }]}>
            <Input placeholder="env-a, env-b" />
          </Form.Item>
          <Form.Item name="canaryPercent" label="Canary %" rules={[{ required: true }]}>
            <InputNumber min={1} max={100} />
          </Form.Item>
        </Form>
      </Modal>
    </ProductionOperationsPage>
  )
}
