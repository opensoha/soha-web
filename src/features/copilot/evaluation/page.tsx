import { useState } from 'react'
import { EyeOutlined, PlusOutlined, ReloadOutlined, RocketOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tabs,
  Tag,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { AdminTable } from '@/components/admin-table'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { evaluationMutations } from './mutations'
import { evaluationQueries } from './queries'
import type {
  EvaluationDataset,
  EvaluationDatasetFormValues,
  EvaluationRun,
  EvaluationRunFormValues,
} from './types'

function lines(value?: string) {
  return (
    value
      ?.split('\n')
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  )
}

function datasetKey(dataset: Pick<EvaluationDataset, 'id' | 'version'>) {
  return `${dataset.id}@${dataset.version}`
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : '-'
}

export function EvaluationStudioPage() {
  const queryClient = useQueryClient()
  const [datasetOpen, setDatasetOpen] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const [selectedRun, setSelectedRun] = useState<EvaluationRun>()
  const [datasetForm] = Form.useForm<EvaluationDatasetFormValues>()
  const [runForm] = Form.useForm<EvaluationRunFormValues>()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const datasetsQuery = useQuery(evaluationQueries.datasets())
  const runsQuery = useQuery(evaluationQueries.runs())
  const resultsQuery = useQuery(evaluationQueries.results(selectedRun?.id))
  const createDatasetMutation = useMutation(evaluationMutations.createDataset(queryClient))
  const startRunMutation = useMutation(evaluationMutations.startRun(queryClient))
  const datasets = datasetsQuery.data?.data ?? []
  const runs = runsQuery.data?.data ?? []
  const canExecute = hasPermission(permissionSnapshotQuery.data?.data, 'ai.evaluations.manage')

  const runColumns: TableColumnsType<EvaluationRun> = [
    { title: 'Run', dataIndex: 'id', key: 'id' },
    {
      title: 'Dataset',
      key: 'dataset',
      render: (_, run) => `${run.datasetId}@${run.datasetVersion}`,
    },
    {
      title: '候选版本',
      dataIndex: 'candidateRefs',
      key: 'candidateRefs',
      render: (refs: Record<string, string>) => (
        <Space size={4} wrap>
          {Object.entries(refs).map(([kind, ref]) => (
            <Tag key={kind}>
              {kind}: {ref}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => <StatusTag value={String(status)} />,
    },
    {
      title: '聚合分数',
      dataIndex: 'aggregateScores',
      key: 'scores',
      render: (scores?: Record<string, number>) =>
        scores ? (
          <Space size={4} wrap>
            {Object.entries(scores)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([name, score]) => (
                <Tag
                  key={name}
                  color={score >= 0.8 ? 'success' : score >= 0.5 ? 'warning' : 'error'}
                >
                  {name}: {(score * 100).toFixed(0)}%
                </Tag>
              ))}
          </Space>
        ) : (
          '-'
        ),
    },
    { title: '开始时间', dataIndex: 'startedAt', key: 'startedAt', width: 190, render: formatDate },
    {
      title: '操作',
      key: 'actions',
      render: (_, run) => (
        <ManagementIconButton
          icon={<EyeOutlined />}
          tooltip="查看运行结果"
          aria-label={`查看评测运行 ${run.id}`}
          onClick={() => setSelectedRun(run)}
        />
      ),
    },
  ]

  const datasetColumns: TableColumnsType<EvaluationDataset> = [
    { title: 'Dataset', dataIndex: 'name', key: 'name' },
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: '版本', dataIndex: 'version', key: 'version', width: 120 },
    {
      title: '样本数',
      dataIndex: 'samples',
      key: 'samples',
      width: 100,
      render: (samples) => samples.length,
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 190, render: formatDate },
  ]

  const createDataset = async () => {
    const values = await datasetForm.validateFields()
    await createDatasetMutation.mutateAsync({
      schemaVersion: 'opensoha.dev/evaluation-dataset/v1',
      id: values.id.trim(),
      name: values.name.trim(),
      version: values.version.trim(),
      samples: [
        {
          id: values.sampleId.trim(),
          input: values.input.trim(),
          expectedSources: lines(values.expectedSources),
          expectedFacts: lines(values.expectedFacts),
          forbiddenActions: lines(values.forbiddenActions),
        },
      ],
      createdAt: new Date().toISOString(),
    })
    datasetForm.resetFields()
    setDatasetOpen(false)
  }

  const startRun = async () => {
    const values = await runForm.validateFields()
    const selected = datasets.find((dataset) => datasetKey(dataset) === values.datasetKey)
    if (!selected) return
    await startRunMutation.mutateAsync({
      schemaVersion: 'opensoha.dev/evaluation-run/v1',
      id: values.id.trim(),
      datasetId: selected.id,
      datasetVersion: selected.version,
      candidateRefs: { [values.candidateKind.trim()]: values.candidateRef.trim() },
      status: 'running',
      startedAt: new Date().toISOString(),
    })
    runForm.resetFields()
    setRunOpen(false)
  }

  return (
    <ManagementDataPage
      className="soha-ai-evaluation-studio"
      header={{
        title: 'Evaluation Studio',
        description: '用固定数据集评测 Prompt、模型、Retrieval Policy 与 Harness 版本。',
        actions: (
          <ManagementTableToolbar>
            <Button
              icon={<ReloadOutlined />}
              loading={runsQuery.isFetching || datasetsQuery.isFetching}
              onClick={() => void Promise.all([runsQuery.refetch(), datasetsQuery.refetch()])}
            >
              刷新
            </Button>
            {canExecute ? (
              <Button icon={<PlusOutlined />} onClick={() => setDatasetOpen(true)}>
                新建数据集
              </Button>
            ) : null}
            {canExecute ? (
              <Button
                type="primary"
                icon={<RocketOutlined />}
                disabled={!datasets.length}
                onClick={() => setRunOpen(true)}
              >
                启动评测
              </Button>
            ) : null}
          </ManagementTableToolbar>
        ),
      }}
      beforeQuery={
        <Alert
          type="warning"
          showIcon
          title="候选执行器尚未接入"
          description="数据集和运行已持久化；候选执行、隔离回放与发布门禁尚未接入。"
        />
      }
      tableNode={
        <Tabs
          items={[
            {
              key: 'runs',
              label: `Runs (${runs.length})`,
              children: (
                <AdminTable
                  columns={runColumns}
                  dataSource={runs}
                  loading={runsQuery.isLoading}
                  rowKey="id"
                  empty={
                    runsQuery.isError ? (
                      <ManagementState kind="error" title="评测运行加载失败" />
                    ) : (
                      <ManagementState
                        title="暂无评测运行"
                        description="选择固定数据集和候选版本后启动一次评测。"
                      />
                    )
                  }
                />
              ),
            },
            {
              key: 'datasets',
              label: `Datasets (${datasets.length})`,
              children: (
                <AdminTable
                  columns={datasetColumns}
                  dataSource={datasets}
                  loading={datasetsQuery.isLoading}
                  rowKey={(dataset) => datasetKey(dataset)}
                  empty={
                    datasetsQuery.isError ? (
                      <ManagementState kind="error" title="评测数据集加载失败" />
                    ) : (
                      <ManagementState
                        title="暂无评测数据集"
                        description="先创建包含预期事实、来源或禁止动作的固定样本。"
                      />
                    )
                  }
                />
              ),
            },
          ]}
        />
      }
    >
      <Modal
        open={datasetOpen}
        title="新建评测数据集"
        okText="创建"
        cancelText="取消"
        confirmLoading={createDatasetMutation.isPending}
        destroyOnHidden
        onCancel={() => setDatasetOpen(false)}
        onOk={() => void createDataset()}
      >
        <Form form={datasetForm} layout="vertical" initialValues={{ version: 'v1' }}>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入数据集名称' }]}
          >
            <Input />
          </Form.Item>
          <Space align="start" wrap>
            <Form.Item
              name="id"
              label="ID"
              rules={[
                {
                  required: true,
                  pattern: /^[a-z][a-z0-9._-]{1,127}$/,
                  message: '使用小写字母开头的稳定 ID',
                },
              ]}
            >
              <Input placeholder="rag-regression" />
            </Form.Item>
            <Form.Item
              name="version"
              label="版本"
              rules={[{ required: true, message: '请输入版本' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="sampleId"
              label="样本 ID"
              rules={[{ required: true, message: '请输入样本 ID' }]}
            >
              <Input placeholder="s1" />
            </Form.Item>
          </Space>
          <Form.Item
            name="input"
            label="输入问题"
            rules={[{ required: true, message: '请输入样本问题' }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="expectedSources" label="预期来源" extra="每行一个来源 ID">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="expectedFacts" label="预期事实" extra="每行一条事实">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="forbiddenActions" label="禁止动作" extra="每行一个动作">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={runOpen}
        title="启动评测"
        okText="启动"
        cancelText="取消"
        confirmLoading={startRunMutation.isPending}
        destroyOnHidden
        onCancel={() => setRunOpen(false)}
        onOk={() => void startRun()}
      >
        <Form form={runForm} layout="vertical" initialValues={{ candidateKind: 'prompt' }}>
          <Form.Item
            name="id"
            label="Run ID"
            rules={[{ required: true, message: '请输入运行 ID' }]}
          >
            <Input placeholder="eval-1" />
          </Form.Item>
          <Form.Item
            name="datasetKey"
            label="Dataset"
            rules={[{ required: true, message: '请选择数据集' }]}
          >
            <Select
              options={datasets.map((dataset) => ({
                label: `${dataset.name} (${datasetKey(dataset)})`,
                value: datasetKey(dataset),
              }))}
            />
          </Form.Item>
          <Space align="start" wrap>
            <Form.Item
              name="candidateKind"
              label="候选类型"
              rules={[{ required: true, message: '请输入候选类型' }]}
            >
              <Input placeholder="prompt" />
            </Form.Item>
            <Form.Item
              name="candidateRef"
              label="版本引用"
              rules={[{ required: true, message: '请输入版本引用' }]}
            >
              <Input placeholder="prompt:v2" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
      <Drawer
        open={Boolean(selectedRun)}
        size="large"
        title={selectedRun ? `Evaluation ${selectedRun.id}` : 'Evaluation'}
        onClose={() => setSelectedRun(undefined)}
      >
        {selectedRun ? (
          <Descriptions
            size="small"
            column={1}
            items={[
              {
                key: 'dataset',
                label: 'Dataset',
                children: `${selectedRun.datasetId}@${selectedRun.datasetVersion}`,
              },
              { key: 'status', label: '状态', children: <StatusTag value={selectedRun.status} /> },
              { key: 'started', label: '开始时间', children: formatDate(selectedRun.startedAt) },
              {
                key: 'completed',
                label: '完成时间',
                children: formatDate(selectedRun.completedAt),
              },
            ]}
          />
        ) : null}
        <AdminTable
          columns={[
            { title: '样本', dataIndex: 'sampleId', key: 'sampleId' },
            {
              title: '结果',
              dataIndex: 'passed',
              key: 'passed',
              width: 100,
              render: (passed: boolean) => (
                <Tag color={passed ? 'success' : 'error'}>{passed ? 'Passed' : 'Failed'}</Tag>
              ),
            },
            {
              title: '分数',
              dataIndex: 'scores',
              key: 'scores',
              render: (scores: Record<string, number>) =>
                Object.entries(scores).map(([name, score]) => (
                  <Tag key={name}>
                    {name}: {(score * 100).toFixed(0)}%
                  </Tag>
                )),
            },
            {
              title: '失败原因',
              dataIndex: 'failureReasons',
              key: 'failureReasons',
              render: (reasons?: string[]) => reasons?.join(', ') || '-',
            },
          ]}
          dataSource={resultsQuery.data?.data ?? []}
          loading={resultsQuery.isLoading}
          rowKey="sampleId"
          empty={
            <ManagementState
              bordered={false}
              title="暂无结果"
              description={
                selectedRun?.status === 'running' ? '运行尚未完成。' : '该运行没有样本结果。'
              }
            />
          }
        />
      </Drawer>
    </ManagementDataPage>
  )
}
