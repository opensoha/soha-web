import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Alert,
  Button,
  Card,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd'
import {
  CommentOutlined,
  HeartFilled,
  HeartOutlined,
  MoreOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { PersonalFeedItem, PersonalFeedSettings } from '@opensoha/contracts/gen/ts/sohaapi'
import { workbenchQueries } from '../queries'
import { workbenchMutations } from '../mutations'
import { workbenchKeys } from '../keys'
import { safeSourceURL, WorkbenchMarkdown } from './markdown'

export function PersonalFeed({
  owner,
  onDiscuss,
}: {
  owner?: string
  onDiscuss: (item: PersonalFeedItem) => void
}) {
  const { message, modal } = App.useApp()
  const client = useQueryClient()
  const query = useInfiniteQuery(workbenchQueries.feed(owner, true))
  const page = query.data?.pages[0]?.data
  const items = query.data?.pages.flatMap((page) => page.data?.items ?? []) ?? []
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [form] = Form.useForm<PersonalFeedSettings>()
  const invalidate = () => void client.invalidateQueries({ queryKey: workbenchKeys.feed(owner) })
  const onError = (error: Error) => void message.error(error.message || '操作未完成，请重试')
  const settings = useMutation({
    ...workbenchMutations.feed.settings(),
    onSuccess: () => {
      setSettingsOpen(false)
      invalidate()
    },
    onError,
  })
  const refresh = useMutation({
    ...workbenchMutations.feed.refresh(),
    onSuccess: invalidate,
    onError,
  })
  const feedback = useMutation({
    ...workbenchMutations.feed.feedback(),
    onSuccess: invalidate,
    onError,
  })
  const running = page?.state === 'queued' || page?.state === 'running'
  const available = page?.searchTools.some((tool) => tool.name === page.settings.searchTool)
  return (
    <section className="soha-personal-feed" aria-label="个人动态">
      <header>
        <div>
          <Typography.Title level={2}>动态</Typography.Title>
          <Typography.Text type="secondary">围绕最近的兴趣，发现值得继续聊的内容。</Typography.Text>
        </div>
        <Space>
          <Button
            icon={<SettingOutlined />}
            aria-label="动态偏好"
            disabled={!page}
            onClick={() => {
              form.setFieldsValue(page!.settings)
              setSettingsOpen(true)
            }}
          >
            偏好
          </Button>
          <Button
            icon={<ReloadOutlined />}
            loading={running || refresh.isPending}
            disabled={!available}
            onClick={() => refresh.mutate()}
          >
            更新
          </Button>
        </Space>
      </header>
      {page?.lastUpdatedAt ? (
        <Typography.Text type="secondary">
          更新于 {new Date(page.lastUpdatedAt).toLocaleString()}
        </Typography.Text>
      ) : null}
      {query.isLoading ? <Spin /> : null}
      {query.isError ? (
        <Alert
          type="error"
          title="动态加载失败"
          action={<Button onClick={() => void query.refetch()}>重试</Button>}
        />
      ) : null}
      {page?.error ? <Alert type="warning" title={page.error} /> : null}
      {page && !page.searchTools.length ? (
        <Alert
          type="info"
          title="尚未接入可用的网页搜索工具"
          description="接入并授权只读网页搜索能力后，可在动态偏好里选择。"
        />
      ) : null}
      {page && page.searchTools.length > 0 && !available ? (
        <Alert
          type="info"
          title="选择内容来源后开始更新"
          action={
            <Button
              onClick={() => {
                form.setFieldsValue(page.settings)
                setSettingsOpen(true)
              }}
            >
              设置偏好
            </Button>
          }
        />
      ) : null}
      {running ? (
        <div className="soha-personal-feed__processing" role="status">
          <Spin size="small" /> 正在整理与你相关的内容
        </div>
      ) : null}
      {page && !items.length && !running ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="还没有动态。设置偏好后，点击更新。"
        />
      ) : null}
      <div className="soha-personal-feed__items">
        {items.map((item) => (
          <Card key={item.id} className="soha-personal-feed__item">
            <div className="soha-personal-feed__item-heading">
              <Typography.Text type="secondary">
                {new Date(item.createdAt).toLocaleString()}
              </Typography.Text>
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    { key: 'why', label: '为什么创建这条内容' },
                    { key: 'hide', label: '不再显示' },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'hide') feedback.mutate({ id: item.id, input: { hidden: true } })
                    else
                      modal.info({
                        title: '为什么创建这条内容',
                        content: item.reason || '根据最近讨论的兴趣与动态偏好整理。',
                      })
                  },
                }}
              >
                <Button
                  type="text"
                  aria-label={`动态选项：${item.title}`}
                  icon={<MoreOutlined />}
                />
              </Dropdown>
            </div>
            <Typography.Title level={3}>{item.title}</Typography.Title>
            <WorkbenchMarkdown content={item.body} />
            <div className="soha-personal-feed__sources" aria-label="内容来源">
              {item.sources.map((source) => {
                const url = safeSourceURL(source.url)
                return url ? (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                    {source.title}
                  </a>
                ) : (
                  <span key={source.title}>{source.title}</span>
                )
              })}
            </div>
            <Space>
              <Button
                type="text"
                aria-label={item.liked ? '取消喜欢' : '喜欢'}
                aria-pressed={item.liked}
                icon={item.liked ? <HeartFilled /> : <HeartOutlined />}
                disabled={feedback.isPending}
                onClick={() => feedback.mutate({ id: item.id, input: { liked: !item.liked } })}
              />
              <Button type="text" icon={<CommentOutlined />} onClick={() => onDiscuss(item)}>
                讨论
              </Button>
            </Space>
          </Card>
        ))}
      </div>
      {query.hasNextPage ? (
        <Button block loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          更早动态
        </Button>
      ) : null}
      <Modal
        title="动态偏好"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={settings.isPending}
        okText="保存"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(value) => settings.mutate({ ...value, searchTool: value.searchTool || '' })}
        >
          <Form.Item
            label="希望看到什么"
            name="instructions"
            rules={[{ required: true, message: '写下你的内容偏好' }, { max: 2000 }]}
          >
            <Input.TextArea rows={4} maxLength={2000} />
          </Form.Item>
          <Form.Item label="网页搜索来源" name="searchTool">
            <Select
              placeholder="选择已授权的只读搜索工具"
              allowClear
              options={page?.searchTools.map((tool) => ({ value: tool.name, label: tool.title }))}
              onClear={() => form.setFieldValue('searchTool', '')}
            />
          </Form.Item>
          <Form.Item label="每天自动更新" name="autoUpdate" valuePropName="checked">
            <Switch disabled={!page?.searchTools.length} />
          </Form.Item>
          <Typography.Text type="secondary">
            默认关闭。开启后，后台每天更新一次；每次最多生成 3 条动态。
          </Typography.Text>
        </Form>
      </Modal>
    </section>
  )
}
