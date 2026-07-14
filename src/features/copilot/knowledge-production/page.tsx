import { useState } from 'react'
import { PlusOutlined, SafetyCertificateOutlined, SyncOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Select, Space } from 'antd'
import { ProductionOperationsPage } from '../production/operations-page'
import { AIWorkbenchFeatureGate } from '../production/feature-gate'
import { knowledgeProductionMutations } from './mutations'
import { knowledgeProductionQueries } from './queries'
import type { ConnectorFormValues, CreateConnectorInput, StartSyncInput } from './types'

export function KnowledgeProductionPage() {
  return (
    <AIWorkbenchFeatureGate
      features={['knowledge.external_connectors', 'knowledge.async_ingestion']}
    >
      <KnowledgeProductionPageContent />
    </AIWorkbenchFeatureGate>
  )
}

function KnowledgeProductionPageContent() {
  const client = useQueryClient()
  const [connectorOpen, setConnectorOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [connectorForm] = Form.useForm<ConnectorFormValues>()
  const [syncForm] = Form.useForm<StartSyncInput>()
  const connectors = useQuery(knowledgeProductionQueries.connectors())
  const jobs = useQuery(knowledgeProductionQueries.jobs())
  const createConnector = useMutation(knowledgeProductionMutations.createConnector(client))
  const validateConnector = useMutation(knowledgeProductionMutations.validateConnector(client))
  const startSync = useMutation(knowledgeProductionMutations.startSync(client))
  const jobAction = useMutation(knowledgeProductionMutations.jobAction(client))
  const submitConnector = async () => {
    const values = await connectorForm.validateFields()
    const input: CreateConnectorInput = {
      knowledgeBaseId: values.knowledgeBaseId,
      name: values.name,
      kind: values.kind,
      version: values.version,
      secretRef: values.secretRef,
      config: JSON.parse(values.configJson) as Record<string, unknown>,
      syncPolicy: { mode: 'manual' },
    }
    await createConnector.mutateAsync(input)
    connectorForm.resetFields()
    setConnectorOpen(false)
  }
  const submitSync = async () => {
    await startSync.mutateAsync(await syncForm.validateFields())
    syncForm.resetFields()
    setSyncOpen(false)
  }
  return (
    <ProductionOperationsPage
      title="Knowledge Pipelines"
      description="管理外部 Connector、异步 Ingestion、索引修订与 Retrieval Playground 的生产操作。"
      refreshing={connectors.isFetching || jobs.isFetching}
      onRefresh={() => void Promise.all([connectors.refetch(), jobs.refetch()])}
      actions={
        <>
          <Button icon={<PlusOutlined />} onClick={() => setConnectorOpen(true)}>
            新建 Connector
          </Button>
          <Button type="primary" icon={<SyncOutlined />} onClick={() => setSyncOpen(true)}>
            启动同步
          </Button>
        </>
      }
      tabs={[
        {
          key: 'connectors',
          label: 'Connectors',
          records: connectors.data?.data ?? [],
          loading: connectors.isLoading,
          error: connectors.isError,
          emptyDescription: '配置 HTTP、Git 或 Object Store Connector。',
          actions: (row) => (
            <Button
              type="link"
              icon={<SafetyCertificateOutlined />}
              onClick={() => validateConnector.mutate(row.id)}
            >
              验证
            </Button>
          ),
        },
        {
          key: 'pipeline',
          label: 'Pipeline Jobs',
          records: jobs.data?.data ?? [],
          loading: jobs.isLoading,
          error: jobs.isError,
          emptyDescription: '同步或重建后会显示分阶段任务。',
          actions: (row) => (
            <Space>
              <Button type="link" onClick={() => jobAction.mutate({ id: row.id, action: 'retry' })}>
                重试
              </Button>
              <Button
                danger
                type="link"
                onClick={() => jobAction.mutate({ id: row.id, action: 'cancel' })}
              >
                取消
              </Button>
            </Space>
          ),
        },
        {
          key: 'revisions',
          label: 'Revisions',
          records: [],
          emptyDescription: '索引发布修订由 Knowledge Center 中的知识库视图展示。',
        },
        {
          key: 'playground',
          label: 'Retrieval Playground',
          records: [],
          emptyDescription: '检索验证继续使用 Knowledge Center 的可追溯搜索面板。',
        },
      ]}
    >
      <Modal
        title="新建 Connector"
        open={connectorOpen}
        onCancel={() => setConnectorOpen(false)}
        onOk={() => void submitConnector()}
        confirmLoading={createConnector.isPending}
        destroyOnHidden
      >
        <Form
          form={connectorForm}
          layout="vertical"
          initialValues={{
            kind: 'http',
            version: 'v1',
            configJson: JSON.stringify(
              {
                url: 'https://docs.example.com/',
                allowedHosts: ['docs.example.com'],
                maxBytes: 8388608,
              },
              null,
              2,
            ),
          }}
        >
          <Form.Item name="knowledgeBaseId" label="Knowledge Base ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="kind" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'http', label: 'HTTP' },
                { value: 'git', label: 'Git' },
                { value: 'object', label: 'Object Store' },
              ]}
            />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="secretRef" label="Secret Ref" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="configJson"
            label="Connector Config"
            rules={[
              { required: true },
              {
                validator: async (_, value: string) => {
                  try {
                    const parsed = JSON.parse(value) as unknown
                    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
                      throw new Error('config must be an object')
                    }
                  } catch {
                    throw new Error('请输入有效的 JSON 对象')
                  }
                },
              },
            ]}
          >
            <Input.TextArea autoSize={{ minRows: 7, maxRows: 14 }} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="启动同步"
        open={syncOpen}
        onCancel={() => setSyncOpen(false)}
        onOk={() => void submitSync()}
        confirmLoading={startSync.isPending}
        destroyOnHidden
      >
        <Form form={syncForm} layout="vertical">
          <Form.Item name="knowledgeBaseId" label="Knowledge Base ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sourceId" label="Source ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </ProductionOperationsPage>
  )
}
