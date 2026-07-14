import { useState } from 'react'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Select } from 'antd'
import { ProductionOperationsPage } from '../production/operations-page'
import { AIWorkbenchFeatureGate } from '../production/feature-gate'
import { aiProductionOperationsMutations } from './mutations'
import { aiProductionOperationsQueries } from './queries'
import type { StartAIOperationInput } from './types'
export function AIProductionOperationsPage() {
  return (
    <AIWorkbenchFeatureGate features={['ai.production_operations']}>
      <AIProductionOperationsPageContent />
    </AIWorkbenchFeatureGate>
  )
}

function AIProductionOperationsPageContent() {
  const c = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<StartAIOperationInput>()
  const snapshots = useQuery(aiProductionOperationsQueries.snapshots())
  const evidence = useQuery(aiProductionOperationsQueries.evidence())
  const start = useMutation(aiProductionOperationsMutations.start(c))
  const submit = async () => {
    await start.mutateAsync(await form.validateFields())
    form.resetFields()
    setOpen(false)
  }
  return (
    <ProductionOperationsPage
      title="AI Operations"
      description="统一查看 AI 平台容量、SLO、备份恢复、索引重建与演练证据。"
      notice={
        <Alert
          showIcon
          type="info"
          title="生产操作需要审计证据"
          description="恢复、重建和演练必须保留 operation ID、耗时、结果与 runbook 版本。"
        />
      }
      refreshing={snapshots.isFetching || evidence.isFetching}
      onRefresh={() => void Promise.all([snapshots.refetch(), evidence.refetch()])}
      actions={
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setOpen(true)}>
          启动操作
        </Button>
      }
      tabs={[
        {
          key: 'capacity',
          label: 'Capacity & SLO',
          records: snapshots.data?.data ?? [],
          loading: snapshots.isLoading,
          error: snapshots.isError,
          emptyDescription: '采集 queue age、吞吐、成本与 deletion lag 后显示。',
        },
        {
          key: 'evidence',
          label: 'Runbook Evidence',
          records: evidence.data?.data ?? [],
          loading: evidence.isLoading,
          error: evidence.isError,
          emptyDescription: '完成备份恢复或演练后显示证据。',
        },
      ]}
    >
      <Modal
        title="启动 AI 生产操作"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        confirmLoading={start.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ kind: 'drill' }}>
          <Form.Item name="kind" label="操作" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'backup', label: 'Backup' },
                { value: 'restore', label: 'Restore' },
                { value: 'index_rebuild', label: 'Index Rebuild' },
                { value: 'drill', label: 'Drill' },
              ]}
            />
          </Form.Item>
          <Form.Item name="targetRef" label="Target Ref" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="runbookId" label="Runbook ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </ProductionOperationsPage>
  )
}
