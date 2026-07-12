import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Switch,
  Tag,
  Tabs,
  Typography,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { ManagementIconButton } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import { systemMutations } from '../mutations'
import { systemQueries } from '../queries'
import { buildAnnouncementLifecycle, type Announcement } from '../system-model'
import './styles.css'

const { Paragraph, Text } = Typography
const MODAL_FORM_LAYOUT = {
  labelAlign: 'left' as const,
  labelCol: { flex: '120px' },
  wrapperCol: { flex: 'auto' },
}

export function AnnouncementsPage() {
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [previewing, setPreviewing] = useState<Announcement | null>(null)
  const [statusView, setStatusView] = useState('all')
  const canManageAnnouncements = hasPermission(
    permissionSnapshotQuery.data?.data,
    'system.announcements.manage',
  )

  const { data: announcements = [], isLoading } = useQuery(systemQueries.announcements())
  const createMutation = useMutation(systemMutations.announcements.create(queryClient))
  const updateMutation = useMutation(systemMutations.announcements.update(queryClient))
  const publishMutation = useMutation(systemMutations.announcements.publish(queryClient))
  const withdrawMutation = useMutation(systemMutations.announcements.withdraw(queryClient))
  const deleteMutation = useMutation(systemMutations.announcements.remove(queryClient))

  const normalizeAnnouncementFormValues = (values: Record<string, unknown>) => ({
    ...values,
    startsAt: values.startsAt ? dayjs(values.startsAt as dayjs.Dayjs).toISOString() : null,
    endsAt: values.endsAt ? dayjs(values.endsAt as dayjs.Dayjs).toISOString() : null,
    audience: 'all',
  })

  const handleSubmit = (values: Record<string, unknown>) => {
    const payload = normalizeAnnouncementFormValues(values)
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values: payload },
        {
          onSuccess: () => {
            void message.success('公告更新成功')
            setModalVisible(false)
            setEditing(null)
          },
          onError: (error) => void message.error(error.message),
        },
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          void message.success('公告创建成功')
          setModalVisible(false)
        },
        onError: (error) => void message.error(error.message),
      })
    }
  }

  const announcementSummary = useMemo(() => {
    const published = announcements.filter(
      (item) => buildAnnouncementLifecycle(item) === 'published',
    ).length
    const draft = announcements.filter(
      (item) => buildAnnouncementLifecycle(item) === 'draft',
    ).length
    const scheduled = announcements.filter(
      (item) => buildAnnouncementLifecycle(item) === 'scheduled',
    ).length
    const sticky = announcements.filter((item) => item.sticky).length
    return { published, draft, scheduled, sticky }
  }, [announcements])

  const filteredAnnouncements = useMemo(() => {
    if (statusView === 'all') return announcements
    return announcements.filter((item) => buildAnnouncementLifecycle(item) === statusView)
  }, [announcements, statusView])

  const announcementTabs = [
    { key: 'all', label: `全部 (${announcements.length})` },
    { key: 'published', label: `已发布 (${announcementSummary.published})` },
    { key: 'draft', label: `草稿 (${announcementSummary.draft})` },
    { key: 'scheduled', label: `待生效 (${announcementSummary.scheduled})` },
  ]

  const renderAnnouncementActions = (record: Announcement) => (
    <Space className="soha-row-action-icons">
      <ManagementIconButton
        aria-label="预览公告"
        icon={<EyeOutlined />}
        size="small"
        tooltip="预览"
        onClick={() => setPreviewing(record)}
      />
      {canManageAnnouncements ? (
        <ManagementIconButton
          aria-label="编辑公告"
          icon={<EditOutlined />}
          size="small"
          tooltip="编辑"
          onClick={() => {
            setEditing(record)
            setModalVisible(true)
          }}
        />
      ) : null}
      {canManageAnnouncements && buildAnnouncementLifecycle(record) !== 'published' ? (
        <ManagementIconButton
          aria-label="发布公告"
          icon={<SendOutlined />}
          size="small"
          tooltip="发布"
          onClick={() =>
            publishMutation.mutate(record.id, {
              onSuccess: () => void message.success('公告已发布'),
              onError: (error) => void message.error(error.message),
            })
          }
          loading={publishMutation.isPending && publishMutation.variables === record.id}
        />
      ) : null}
      {canManageAnnouncements && buildAnnouncementLifecycle(record) === 'published' ? (
        <ManagementIconButton
          aria-label="撤回公告"
          icon={<PauseCircleOutlined />}
          size="small"
          tooltip="撤回"
          onClick={() =>
            withdrawMutation.mutate(record.id, {
              onSuccess: () => void message.success('公告已撤回'),
              onError: (error) => void message.error(error.message),
            })
          }
          loading={withdrawMutation.isPending && withdrawMutation.variables === record.id}
        />
      ) : null}
      {canManageAnnouncements ? (
        <Popconfirm
          title="确认删除？"
          onConfirm={() =>
            deleteMutation.mutate(record.id, {
              onSuccess: () => void message.success('公告已删除'),
              onError: (error) => void message.error(error.message),
            })
          }
        >
          <ManagementIconButton
            aria-label="删除公告"
            danger
            icon={<DeleteOutlined />}
            size="small"
            tooltip="删除"
          />
        </Popconfirm>
      ) : null}
    </Space>
  )

  return (
    <div className="soha-page">
      <div className="soha-system-overview-grid">
        <Card variant="outlined" className="soha-system-metric-card">
          <Statistic title="已发布" value={announcementSummary.published} />
          <Text type="secondary">当前对用户可见的公告</Text>
        </Card>
        <Card variant="outlined" className="soha-system-metric-card">
          <Statistic title="草稿" value={announcementSummary.draft} />
          <Text type="secondary">仍在编辑，尚未推送</Text>
        </Card>
        <Card variant="outlined" className="soha-system-metric-card">
          <Statistic title="待生效" value={announcementSummary.scheduled} />
          <Text type="secondary">已配置时间窗，等待生效</Text>
        </Card>
        <Card variant="outlined" className="soha-system-metric-card">
          <Statistic title="置顶公告" value={announcementSummary.sticky} />
          <Text type="secondary">优先出现在用户端弹窗与铃铛中</Text>
        </Card>
      </div>

      <Card
        variant="outlined"
        className="soha-system-panel-card"
        extra={
          canManageAnnouncements ? (
            <Button
              size="small"
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => {
                setEditing(null)
                setModalVisible(true)
              }}
            >
              新建公告
            </Button>
          ) : null
        }
      >
        <Tabs
          activeKey={statusView}
          onChange={setStatusView}
          items={announcementTabs.map((item) => ({
            key: item.key,
            label: item.label,
            children: (
              <List
                className="soha-system-announcement-list"
                itemLayout="vertical"
                loading={isLoading}
                dataSource={filteredAnnouncements}
                locale={{ emptyText: <Alert type="info" showIcon title="当前分组下暂无公告" /> }}
                renderItem={(record: Announcement) => {
                  const lifecycle = buildAnnouncementLifecycle(record)
                  return (
                    <List.Item
                      key={record.id}
                      actions={[renderAnnouncementActions(record)]}
                      extra={
                        <div className="soha-system-announcement-extra">
                          <Text type="secondary">{`发布时间 ${formatDateTime(record.publishedAt || record.updatedAt || record.createdAt)}`}</Text>
                          <Text type="secondary">{`生效窗口 ${formatDateTime(record.startsAt)} ~ ${formatDateTime(record.endsAt)}`}</Text>
                        </div>
                      }
                    >
                      <List.Item.Meta
                        title={
                          <Space size={8} wrap>
                            <Button
                              type="link"
                              className="soha-system-linklike"
                              onClick={() => setPreviewing(record)}
                            >
                              {record.title}
                            </Button>
                            <StatusTag value={record.level} />
                            <StatusTag value={record.status} />
                            {record.sticky ? <Tag color="purple">置顶</Tag> : null}
                            {lifecycle === 'scheduled' ? <Tag color="gold">待生效</Tag> : null}
                            {lifecycle === 'expired' ? <Tag>已过期</Tag> : null}
                          </Space>
                        }
                        description={
                          record.summary ? (
                            <Text>{record.summary}</Text>
                          ) : (
                            <Text type="secondary">无摘要</Text>
                          )
                        }
                      />
                      <Paragraph
                        className="soha-system-announcement-content"
                        ellipsis={{ rows: 3, expandable: true, symbol: '展开正文' }}
                      >
                        {record.content}
                      </Paragraph>
                    </List.Item>
                  )
                }}
              />
            ),
          }))}
        />
      </Card>
      <Modal
        title={editing ? '编辑公告' : '新建公告'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditing(null)
        }}
        footer={null}
        destroyOnHidden
      >
        <Form
          {...MODAL_FORM_LAYOUT}
          onFinish={(values) => {
            if (!canManageAnnouncements) return
            handleSubmit(values as Record<string, unknown>)
          }}
          initialValues={
            editing
              ? {
                  title: editing.title,
                  summary: editing.summary,
                  content: editing.content,
                  level: editing.level,
                  status: editing.status,
                  sticky: editing.sticky,
                  startsAt: editing.startsAt ? dayjs(editing.startsAt) : null,
                  endsAt: editing.endsAt ? dayjs(editing.endsAt) : null,
                }
              : { level: 'info', status: 'draft', sticky: false }
          }
        >
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <Input />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="level" label="级别">
            <Select
              options={[
                { value: 'info', label: '信息' },
                { value: 'warning', label: '警告' },
                { value: 'critical', label: '严重' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: 'draft', label: '草稿' },
                { value: 'published', label: '已发布' },
              ]}
            />
          </Form.Item>
          <Form.Item name="sticky" label="置顶" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="startsAt" label="生效开始">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endsAt" label="生效结束">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <div className="soha-form-actions">
            <Button onClick={() => setModalVisible(false)}>取消</Button>
            {canManageAnnouncements ? (
              <Button
                htmlType="submit"
                type="primary"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? '更新' : '创建'}
              </Button>
            ) : null}
          </div>
        </Form>
      </Modal>
      <Drawer
        title={previewing?.title || '公告详情'}
        open={Boolean(previewing)}
        onClose={() => setPreviewing(null)}
        size={560}
        destroyOnHidden
      >
        {previewing ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: 'status',
                  label: '状态',
                  children: (
                    <Space size={8} wrap>
                      <StatusTag value={previewing.level} />
                      <StatusTag value={previewing.status} />
                      {previewing.sticky ? <Tag color="purple">置顶</Tag> : null}
                    </Space>
                  ),
                },
                {
                  key: 'publishedAt',
                  label: '发布时间',
                  children: formatDateTime(
                    previewing.publishedAt || previewing.updatedAt || previewing.createdAt,
                  ),
                },
                {
                  key: 'window',
                  label: '生效窗口',
                  children: `${formatDateTime(previewing.startsAt)} ~ ${formatDateTime(previewing.endsAt)}`,
                },
              ]}
            />
            {previewing.summary ? <Alert type="info" showIcon title={previewing.summary} /> : null}
            <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
              {previewing.content}
            </Paragraph>
          </Space>
        ) : null}
      </Drawer>
    </div>
  )
}
