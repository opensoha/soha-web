import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, List, Modal, Popover, Space, Tag, Tabs, Typography, message } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { HeaderActionButton } from '@/components/header-action-button'
import { ManagementState } from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import { markAnnouncementRead } from './api'
import { announcementKeys } from './keys'
import type { AnnouncementInboxItem } from './types'
import { useAnnouncementInbox } from './use-inbox'

export type { AnnouncementInboxItem } from './types'

const { Paragraph, Text, Title } = Typography

export const announcementInboxQueryKey = announcementKeys.inboxRoot

function levelTag(level: string) {
  const normalized = String(level || '').toLowerCase()
  if (normalized === 'critical') return <Tag color="red">严重</Tag>
  if (normalized === 'warning') return <Tag color="gold">警告</Tag>
  return <Tag color="blue">信息</Tag>
}

function formatAnnouncementTime(item: AnnouncementInboxItem) {
  return formatDateTime(item.publishedAt || item.updatedAt || item.createdAt)
}

function AnnouncementList({
  items,
  onRead,
  onPreview,
  readingID,
}: {
  items: AnnouncementInboxItem[]
  onRead: (id: string) => void
  onPreview: (item: AnnouncementInboxItem) => void
  readingID?: string | null
}) {
  if (items.length === 0) {
    return (
      <ManagementState
        bordered={false}
        compact
        title="暂无公告"
        description="当前没有需要处理的公告。"
      />
    )
  }

  return (
    <List
      dataSource={items}
      renderItem={(item) => (
        <List.Item
          className="soha-announcement-center-item"
          actions={[
            <Button key="preview" size="small" type="link" onClick={() => onPreview(item)}>
              查看
            </Button>,
            item.isRead ? (
              <Text type="secondary" key="read">
                {item.readAt ? `已读 ${formatDateTime(item.readAt)}` : '已读'}
              </Text>
            ) : (
              <Button
                key="mark-read"
                size="small"
                type="link"
                loading={readingID === item.id}
                onClick={() => onRead(item.id)}
              >
                标记已读
              </Button>
            ),
          ]}
        >
          <List.Item.Meta
            title={
              <Space size={8} wrap>
                <Button
                  type="link"
                  className="soha-system-linklike"
                  onClick={() => onPreview(item)}
                >
                  {item.title}
                </Button>
                {item.sticky ? <Tag color="purple">置顶</Tag> : null}
                {levelTag(item.level)}
              </Space>
            }
            description={
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                {item.summary ? <Text>{item.summary}</Text> : null}
                <Paragraph
                  style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
                  ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
                >
                  {item.content}
                </Paragraph>
                <Text type="secondary">{formatAnnouncementTime(item)}</Text>
              </Space>
            }
          />
        </List.Item>
      )}
    />
  )
}

export function AnnouncementBell() {
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canViewAnnouncements = hasPermission(
    permissionSnapshotQuery.data?.data,
    'system.announcements.view',
  )
  const inboxQuery = useAnnouncementInbox(10)
  const [modalItem, setModalItem] = useState<AnnouncementInboxItem | null>(null)
  const [autoOpenedID, setAutoOpenedID] = useState<string | null>(null)

  const items = inboxQuery.data?.data.items ?? []
  const unreadCount = inboxQuery.data?.data.unreadCount ?? 0
  const unreadItems = useMemo(() => items.filter((item) => !item.isRead), [items])
  const topUnread = useMemo(() => unreadItems[0] ?? null, [unreadItems])

  useEffect(() => {
    if (!canViewAnnouncements) return
    if (!topUnread) return
    if (autoOpenedID === topUnread.id) return
    setModalItem(topUnread)
    setAutoOpenedID(topUnread.id)
  }, [autoOpenedID, canViewAnnouncements, topUnread])

  const markReadMutation = useMutation({
    mutationFn: markAnnouncementRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: announcementInboxQueryKey })
      void message.success('公告已标记为已读')
    },
    onError: (err: Error) => void message.error(err.message),
  })

  const handleMarkRead = async (announcementID: string) => {
    await markReadMutation.mutateAsync(announcementID)
    setModalItem((current) => (current?.id === announcementID ? null : current))
  }

  if (!canViewAnnouncements) return null

  return (
    <>
      <Popover
        placement="bottomRight"
        trigger="click"
        content={
          <div style={{ width: 420, maxWidth: 'min(92vw, 420px)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Title level={5} style={{ margin: 0 }}>
                公告中心
              </Title>
              <Text type="secondary">{`${unreadCount} 条未读`}</Text>
            </div>
            <Tabs
              size="small"
              items={[
                {
                  key: 'unread',
                  label: `未读 (${unreadCount})`,
                  children: (
                    <AnnouncementList
                      items={unreadItems}
                      onRead={handleMarkRead}
                      onPreview={setModalItem}
                      readingID={markReadMutation.variables as string | null}
                    />
                  ),
                },
                {
                  key: 'all',
                  label: `全部 (${items.length})`,
                  children: (
                    <AnnouncementList
                      items={items}
                      onRead={handleMarkRead}
                      onPreview={setModalItem}
                      readingID={markReadMutation.variables as string | null}
                    />
                  ),
                },
              ]}
            />
          </div>
        }
      >
        <HeaderActionButton
          ariaLabel={unreadCount > 0 ? `公告中心，${unreadCount} 条未读` : '公告中心'}
          className="soha-header-bell"
          icon={
            <Badge count={unreadCount} size="small" overflowCount={99}>
              <BellOutlined />
            </Badge>
          }
        />
      </Popover>

      <Modal
        open={Boolean(modalItem)}
        title={modalItem?.title || '公告'}
        onCancel={() => setModalItem(null)}
        footer={[
          <Button key="close" onClick={() => setModalItem(null)}>
            稍后查看
          </Button>,
          <Button
            key="read"
            type="primary"
            loading={markReadMutation.isPending}
            onClick={() => {
              if (modalItem) void handleMarkRead(modalItem.id)
            }}
          >
            已读
          </Button>,
        ]}
        destroyOnHidden
      >
        {modalItem ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Space size={8} wrap>
              {modalItem.sticky ? <Tag color="purple">置顶</Tag> : null}
              {levelTag(modalItem.level)}
              <Text type="secondary">{formatAnnouncementTime(modalItem)}</Text>
            </Space>
            {modalItem.summary ? <Text>{modalItem.summary}</Text> : null}
            <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
              {modalItem.content}
            </Paragraph>
          </Space>
        ) : null}
      </Modal>
    </>
  )
}
