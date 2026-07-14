import { useState } from 'react'
import {
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Tag,
  Tabs,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { ManagementDataPage } from '@/components/management-data-page'
import { ManagementState, ManagementTableToolbar } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { knowledgeMutations } from './mutations'
import { knowledgeQueries } from './queries'
import type {
  CreateKnowledgeBaseInput,
  CreateKnowledgeSourceInput,
  KnowledgeBase,
  KnowledgeSearchInput,
} from './types'

const { Text } = Typography

export function KnowledgeCenterPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [selectedBase, setSelectedBase] = useState<KnowledgeBase | null>(null)
  const [createForm] = Form.useForm<CreateKnowledgeBaseInput>()
  const [searchForm] = Form.useForm<KnowledgeSearchInput>()
  const [sourceForm] = Form.useForm<CreateKnowledgeSourceInput>()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const basesQuery = useQuery(knowledgeQueries.bases())
  const sourcesQuery = useQuery(knowledgeQueries.sources(selectedBase?.id))
  const documentsQuery = useQuery(knowledgeQueries.documents(selectedBase?.id))
  const syncRunsQuery = useQuery(knowledgeQueries.syncRuns(selectedBase?.id))
  const revisionsQuery = useQuery(knowledgeQueries.indexRevisions(selectedBase?.id))
  const createMutation = useMutation(knowledgeMutations.createBase(queryClient))
  const deleteMutation = useMutation(knowledgeMutations.deleteBase(queryClient))
  const searchMutation = useMutation(knowledgeMutations.search())
  const createSourceMutation = useMutation(
    knowledgeMutations.createSource(queryClient, selectedBase?.id ?? ''),
  )
  const syncSourceMutation = useMutation(
    knowledgeMutations.syncSource(queryClient, selectedBase?.id ?? ''),
  )
  const bases = basesQuery.data?.data ?? []
  const canManage = hasPermission(permissionSnapshotQuery.data?.data, 'ai.knowledge.manage')

  const columns: TableColumnsType<KnowledgeBase> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value) => <StatusTag value={String(value || 'unknown')} />,
    },
    {
      title: '来源',
      dataIndex: 'sourceCount',
      key: 'sourceCount',
      width: 90,
      render: (value) => value ?? '-',
    },
    {
      title: '文档',
      dataIndex: 'documentCount',
      key: 'documentCount',
      width: 90,
      render: (value) => value ?? '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 190,
      render: (value) => value || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<EyeOutlined />}
            aria-label={`查看知识库 ${record.name}`}
            onClick={() => setSelectedBase(record)}
          />
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            aria-label={`删除知识库 ${record.name}`}
            loading={deleteMutation.isPending && deleteMutation.variables === record.id}
            disabled={!canManage}
            onClick={() => void deleteMutation.mutateAsync(record.id)}
          />
        </Space>
      ),
    },
  ]

  const submitCreate = async () => {
    const values = await createForm.validateFields()
    await createMutation.mutateAsync(values)
    createForm.resetFields()
    setCreateOpen(false)
  }

  const submitSource = async () => {
    const values = await sourceForm.validateFields()
    await createSourceMutation.mutateAsync(values)
    sourceForm.resetFields()
    setSourceOpen(false)
  }

  return (
    <ManagementDataPage
      className="soha-ai-knowledge-center"
      header={{
        title: 'Knowledge Center',
        description: '管理知识库并验证检索结果。知识内容仅在服务端按当前身份和作用域授权。',
        actions: (
          <ManagementTableToolbar>
            {canManage ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                新建知识库
              </Button>
            ) : null}
          </ManagementTableToolbar>
        ),
      }}
      beforeQuery={
        <Card size="small" variant="outlined" title="检索验证">
          <Form
            form={searchForm}
            layout="inline"
            initialValues={{ topK: 8, filters: {} }}
            onFinish={(values) => searchMutation.mutate(values)}
          >
            <Form.Item
              name="query"
              rules={[{ required: true, message: '请输入检索问题' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="输入要从知识库检索的问题" allowClear />
            </Form.Item>
            <Form.Item
              name="knowledgeBaseIds"
              rules={[{ required: true, message: '请选择知识库' }]}
            >
              <Select
                mode="multiple"
                placeholder="选择知识库"
                options={bases.map((base) => ({ label: base.name, value: base.id }))}
                style={{ minWidth: 240 }}
              />
            </Form.Item>
            <Button
              htmlType="submit"
              type="primary"
              icon={<SearchOutlined />}
              loading={searchMutation.isPending}
            >
              检索
            </Button>
          </Form>
          {searchMutation.isError ? (
            <Alert
              type="error"
              showIcon
              title="检索失败"
              description="知识服务暂时不可用或当前身份无权检索。"
            />
          ) : null}
          {searchMutation.data?.data ? (
            <List
              header={
                <Space wrap>
                  <Text>命中 {searchMutation.data.data.hits?.length ?? 0} 条</Text>
                  <Tag>{searchMutation.data.data.timingMs ?? '-'} ms</Tag>
                  {searchMutation.data.data.noAnswer ? <Tag color="warning">证据不足</Tag> : null}
                </Space>
              }
              dataSource={searchMutation.data.data.hits ?? []}
              renderItem={(hit) => (
                <List.Item>
                  <List.Item.Meta
                    title={hit.title || hit.documentId || '检索片段'}
                    description={hit.content || hit.source || '-'}
                  />
                  {typeof hit.score === 'number' ? <Tag>{hit.score.toFixed(3)}</Tag> : null}
                </List.Item>
              )}
            />
          ) : null}
        </Card>
      }
      table={
        basesQuery.isError
          ? {
              columns,
              dataSource: [],
              rowKey: 'id',
              empty: <ManagementState kind="error" title="知识库加载失败" />,
            }
          : {
              columns,
              dataSource: bases,
              loading: basesQuery.isLoading,
              rowKey: 'id',
              empty: (
                <ManagementState
                  title="暂无知识库"
                  description="创建知识库后可添加来源并构建索引。"
                />
              ),
            }
      }
    >
      <Modal
        open={createOpen}
        title="新建知识库"
        okText="创建"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        destroyOnHidden
        onCancel={() => setCreateOpen(false)}
        onOk={() => void submitCreate()}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            scope: { visibility: 'private' },
            retrievalPolicy: {
              defaultTopK: 5,
              maxTopK: 20,
              lexicalWeight: 0.45,
              vectorWeight: 0.55,
              minScore: 0.05,
            },
          }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input autoFocus maxLength={120} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <Form.Item name={['scope', 'visibility']} label="可见范围" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '仅本人', value: 'private' },
                { label: '受限成员', value: 'restricted' },
                { label: '当前平台公开', value: 'public' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        open={Boolean(selectedBase)}
        title={selectedBase?.name || '知识库详情'}
        size="large"
        destroyOnHidden
        extra={
          canManage ? (
            <Button icon={<PlusOutlined />} onClick={() => setSourceOpen(true)}>
              添加来源
            </Button>
          ) : null
        }
        onClose={() => setSelectedBase(null)}
      >
        <Tabs
          items={[
            {
              key: 'sources',
              label: `来源 (${sourcesQuery.data?.data.length ?? 0})`,
              children: (
                <List
                  loading={sourcesQuery.isLoading}
                  dataSource={sourcesQuery.data?.data ?? []}
                  locale={{ emptyText: sourcesQuery.isError ? '来源加载失败' : '暂无来源' }}
                  renderItem={(item) => (
                    <List.Item
                      extra={
                        <Space>
                          <StatusTag value={item.status} />
                          {canManage ? (
                            <Button
                              type="text"
                              icon={<SyncOutlined />}
                              aria-label={`同步来源 ${item.name}`}
                              loading={
                                syncSourceMutation.isPending &&
                                syncSourceMutation.variables === item.id
                              }
                              onClick={() => syncSourceMutation.mutate(item.id)}
                            />
                          ) : null}
                        </Space>
                      }
                    >
                      <List.Item.Meta
                        title={item.name}
                        description={`${item.kind}${item.lastError ? ` · ${item.lastError}` : ''}`}
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'documents',
              label: `文档 (${documentsQuery.data?.data.length ?? 0})`,
              children: (
                <List
                  loading={documentsQuery.isLoading}
                  dataSource={documentsQuery.data?.data ?? []}
                  locale={{ emptyText: documentsQuery.isError ? '文档加载失败' : '暂无文档' }}
                  renderItem={(item) => (
                    <List.Item extra={<Tag>{item.chunkCount ?? 0} chunks</Tag>}>
                      <List.Item.Meta
                        title={item.title}
                        description={item.uri || item.version || '-'}
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'sync-runs',
              label: `同步运行 (${syncRunsQuery.data?.data.length ?? 0})`,
              children: (
                <List
                  loading={syncRunsQuery.isLoading}
                  dataSource={syncRunsQuery.data?.data ?? []}
                  locale={{
                    emptyText: syncRunsQuery.isError ? '同步记录加载失败' : '暂无同步记录',
                  }}
                  renderItem={(item) => (
                    <List.Item extra={<StatusTag value={item.status} />}>
                      <List.Item.Meta
                        title={item.id}
                        description={`${item.documentsStored ?? 0} documents · ${item.chunksStored ?? 0} chunks`}
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'revisions',
              label: `索引版本 (${revisionsQuery.data?.data.length ?? 0})`,
              children: (
                <List
                  loading={revisionsQuery.isLoading}
                  dataSource={revisionsQuery.data?.data ?? []}
                  locale={{
                    emptyText: revisionsQuery.isError ? '索引版本加载失败' : '暂无索引版本',
                  }}
                  renderItem={(item) => (
                    <List.Item extra={<StatusTag value={item.status} />}>
                      <List.Item.Meta
                        title={`Revision ${item.revision}`}
                        description={`${item.documentCount ?? 0} documents · ${item.chunkCount ?? 0} chunks`}
                      />
                    </List.Item>
                  )}
                />
              ),
            },
          ]}
        />
      </Drawer>
      <Modal
        open={sourceOpen}
        title="添加 Inline 来源"
        okText="添加"
        cancelText="取消"
        width={720}
        confirmLoading={createSourceMutation.isPending}
        destroyOnHidden
        onCancel={() => setSourceOpen(false)}
        onOk={() => void submitSource()}
      >
        <Form
          form={sourceForm}
          layout="vertical"
          initialValues={{
            kind: 'inline',
            syncPolicy: { mode: 'manual' },
            config: { documents: [{ externalId: '', title: '', content: '' }] },
          }}
        >
          <Form.Item name="name" label="来源名称" rules={[{ required: true }]}>
            <Input maxLength={120} />
          </Form.Item>
          <Form.List name={['config', 'documents']}>
            {(fields, { add, remove }) => (
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`文档 ${index + 1}`}
                    extra={
                      fields.length > 1 ? (
                        <Button
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          aria-label={`移除文档 ${index + 1}`}
                          onClick={() => remove(field.name)}
                        />
                      ) : null
                    }
                  >
                    <Form.Item
                      name={[field.name, 'externalId']}
                      label="External ID"
                      rules={[{ required: true }]}
                    >
                      <Input maxLength={200} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'title']}
                      label="标题"
                      rules={[{ required: true }]}
                    >
                      <Input maxLength={300} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'content']}
                      label="内容"
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea rows={6} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'uri']} label="来源 URI">
                      <Input placeholder="https://docs.example.com/page" />
                    </Form.Item>
                  </Card>
                ))}
                <Button icon={<PlusOutlined />} onClick={() => add()}>
                  添加文档
                </Button>
              </Space>
            )}
          </Form.List>
          <Form.Item name="kind" hidden>
            <Input />
          </Form.Item>
          <Form.Item name={['syncPolicy', 'mode']} hidden>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </ManagementDataPage>
  )
}
