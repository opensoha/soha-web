import { useMemo, useState } from 'react'
import { EditOutlined } from '@ant-design/icons'
import {
  App,
  Avatar,
  Badge,
  Button,
  Calendar,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd'
import type { CalendarProps, TableProps } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { AdminTable } from '@/components/admin-table'
import {
  ManagementDetailHeader,
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { formatDateTime } from '@/utils/time'
import '../observability-pages.css'
import {
  assignmentForDate,
  buildRotationConfigWithOverride,
  formatParticipantSummary,
  normalizeParticipantList,
  ONCALL_DATE_FORMAT,
  onCallUserOptions,
  participantAvatarText,
  readRotationOverrides,
  rotationModeLabel,
  shiftsForDate,
} from './model'
import { observabilityOncallMutations } from './mutations'
import { observabilityOncallQueries } from './queries'
import type { OnCallBoardView, OnCallRotationPayload, OnCallTask } from './types'

const { Text } = Typography

export function OnCallBoardPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canManageOnCall = hasPermission(permissionSnapshotQuery.data?.data, 'observe.oncall.manage')
  const [overrideForm] = Form.useForm<{ participants: string[] }>()
  const [view, setView] = useState<OnCallBoardView>('calendar')
  const [calendarValue, setCalendarValue] = useState<Dayjs>(dayjs())
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const [drawerDate, setDrawerDate] = useState<Dayjs | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideDate, setOverrideDate] = useState<Dayjs | null>(null)

  const schedulesQuery = useQuery(observabilityOncallQueries.schedules())
  const rotationsQuery = useQuery(observabilityOncallQueries.rotations())
  const tasksQuery = useQuery(observabilityOncallQueries.tasks())
  const usersQuery = useQuery(observabilityOncallQueries.users(canManageOnCall))
  const updateRotationOverride = useMutation({
    ...observabilityOncallMutations.updateRotation(queryClient),
    onError: (error) => message.error(error.message),
  })

  const schedules = schedulesQuery.data ?? []
  const rotations = rotationsQuery.data ?? []
  const tasks = tasksQuery.data ?? []
  const scheduleOptions = useMemo(
    () => schedules.map((item) => ({ value: item.id, label: item.name })),
    [schedules],
  )
  const effectiveScheduleId = selectedScheduleId || schedules[0]?.id || ''
  const selectedSchedule = useMemo(
    () => schedules.find((item) => item.id === effectiveScheduleId) ?? null,
    [effectiveScheduleId, schedules],
  )
  const selectedRotation = useMemo(
    () =>
      rotations.find((item) => item.scheduleId === effectiveScheduleId && item.enabled) ??
      rotations.find((item) => item.scheduleId === effectiveScheduleId) ??
      null,
    [effectiveScheduleId, rotations],
  )
  const overrides = useMemo(
    () => readRotationOverrides(selectedRotation?.rotationConfig),
    [selectedRotation],
  )
  const overrideEntries = useMemo(
    () => Object.entries(overrides).sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)),
    [overrides],
  )
  const today = dayjs()
  const todayAssignment = assignmentForDate(selectedRotation, today)
  const tomorrowAssignment = assignmentForDate(selectedRotation, today.add(1, 'day'))

  function openOverride(date: Dayjs) {
    if (!canManageOnCall) return
    if (!selectedRotation) {
      message.warning('当前排班尚未配置轮值，请先到值班设置中创建')
      return
    }
    setOverrideDate(date)
    overrideForm.setFieldsValue({
      participants: assignmentForDate(selectedRotation, date).participants,
    })
    setOverrideOpen(true)
  }

  function updateOverride(participants: string[]) {
    if (!selectedRotation || !overrideDate) return
    const payload: OnCallRotationPayload = {
      scheduleId: selectedRotation.scheduleId,
      name: selectedRotation.name,
      participants: normalizeParticipantList(selectedRotation.participants),
      rotationConfig: buildRotationConfigWithOverride(
        selectedRotation.rotationConfig,
        overrideDate.format(ONCALL_DATE_FORMAT),
        participants,
      ),
      enabled: selectedRotation.enabled,
    }
    updateRotationOverride.mutate(
      { id: selectedRotation.id, payload },
      {
        onSuccess: () => {
          message.success('值班覆盖已保存')
          setOverrideOpen(false)
        },
      },
    )
  }

  const cellRender: CalendarProps<Dayjs>['cellRender'] = (current, info) => {
    if (info.type !== 'date') return info.originNode
    const assignment = assignmentForDate(selectedRotation, current)
    if (assignment.participants.length === 0) {
      return (
        <div className="soha-oncall-cell soha-oncall-cell-empty">
          <Text type="secondary">未排班</Text>
        </div>
      )
    }
    const isToday = current.isSame(today, 'day')
    return (
      <Tooltip title={assignment.participants.join('、')}>
        <div
          className={`soha-oncall-cell${assignment.override ? ' soha-oncall-cell-override' : ''}${isToday ? ' soha-oncall-cell-today' : ''}`}
        >
          <Avatar.Group size="small" max={{ count: 3 }}>
            {assignment.participants.map((name) => (
              <Avatar
                key={name}
                style={{
                  backgroundColor: assignment.override
                    ? 'var(--soha-warning)'
                    : 'var(--soha-primary)',
                }}
              >
                {participantAvatarText(name)}
              </Avatar>
            ))}
          </Avatar.Group>
          {assignment.override ? <Badge status="warning" text="覆盖" /> : null}
        </div>
      </Tooltip>
    )
  }

  const taskColumns: TableProps<OnCallTask>['columns'] = [
    { title: '标题', dataIndex: 'title' },
    {
      title: '严重度',
      dataIndex: 'severity',
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <StatusTag value={value} />,
    },
    {
      title: '当前响应人',
      dataIndex: 'currentParticipant',
      render: (value: string) => value || '-',
    },
    {
      title: '分派规则',
      dataIndex: 'routeName',
      render: (value: string) => value || '-',
    },
    { title: '更新时间', dataIndex: 'updatedAt', render: formatDateTime },
  ]
  const drawerAssignment = drawerDate ? assignmentForDate(selectedRotation, drawerDate) : null

  return (
    <div className="soha-page">
      <ManagementDetailHeader
        title="值班协同"
        description="跟踪当前排班、轮值与待响应任务，必要时可临时覆盖某天的值班人。"
        actions={
          <ManagementTableToolbar>
            <Select
              style={{ minWidth: 220 }}
              placeholder="选择排班"
              value={effectiveScheduleId || undefined}
              options={scheduleOptions}
              onChange={setSelectedScheduleId}
            />
            <Button onClick={() => navigate('/monitoring-workbench/oncall/settings')}>
              值班设置
            </Button>
          </ManagementTableToolbar>
        }
      />
      {schedules.length === 0 ? (
        <Card>
          <ManagementState
            bordered={false}
            compact
            description="尚未创建排班，请前往值班设置新增。"
            kind="not-configured"
            actions={
              canManageOnCall ? (
                <Button
                  type="primary"
                  onClick={() => navigate('/monitoring-workbench/oncall/settings')}
                >
                  前往设置
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <>
          <Row gutter={16} className="soha-oncall-stats-row">
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="今日值班"
                  value={formatParticipantSummary(todayAssignment.participants)}
                  styles={{ content: { fontSize: 18 } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="明日值班"
                  value={formatParticipantSummary(tomorrowAssignment.participants)}
                  styles={{ content: { fontSize: 18 } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="轮换节奏"
                  value={
                    selectedRotation ? rotationModeLabel(selectedRotation.rotationConfig) : '未配置'
                  }
                  styles={{ content: { fontSize: 18 } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="待响应任务"
                  value={tasks.length}
                  suffix={
                    overrideEntries.length > 0 ? (
                      <Tag color="orange">覆盖 {overrideEntries.length}</Tag>
                    ) : null
                  }
                />
              </Card>
            </Col>
          </Row>
          <Card
            className="soha-oncall-board-card"
            title={
              <Space>
                <Text strong>{selectedSchedule?.name || '未选择排班'}</Text>
                {selectedRotation ? (
                  <Tag color="blue">{selectedRotation.name}</Tag>
                ) : (
                  <Tag>暂无轮值</Tag>
                )}
                {todayAssignment.override ? <Tag color="orange">今日已覆盖</Tag> : null}
              </Space>
            }
            extra={
              <Segmented
                value={view}
                onChange={(value) => setView(value as OnCallBoardView)}
                options={[
                  { value: 'calendar', label: '月历' },
                  { value: 'timeline', label: '时间轴' },
                  { value: 'list', label: '覆盖列表' },
                ]}
              />
            }
          >
            {view === 'calendar' ? (
              <Calendar
                value={calendarValue}
                onPanelChange={setCalendarValue}
                onSelect={(value, selectInfo) => {
                  setCalendarValue(value)
                  if (selectInfo?.source === 'date') setDrawerDate(value)
                }}
                cellRender={cellRender}
              />
            ) : null}
            {view === 'timeline' ? (
              <Timeline
                className="soha-oncall-timeline"
                items={Array.from({ length: 14 }).map((_, index) => {
                  const date = today.add(index, 'day')
                  const assignment = assignmentForDate(selectedRotation, date)
                  return {
                    color: assignment.override ? 'orange' : index === 0 ? 'blue' : 'gray',
                    children: (
                      <Space orientation="vertical" size={2}>
                        <Text strong>
                          {date.format('MM-DD ddd')}
                          {index === 0 ? ' · 今日' : ''}
                        </Text>
                        <Text>{formatParticipantSummary(assignment.participants)}</Text>
                        {assignment.override ? <Tag color="orange">手动覆盖</Tag> : null}
                      </Space>
                    ),
                  }
                })}
              />
            ) : null}
            {view === 'list' ? (
              overrideEntries.length === 0 ? (
                <ManagementState bordered={false} compact description="暂无覆盖记录" />
              ) : (
                <AdminTable
                  shellClassName="soha-management-table-shell"
                  columns={[
                    { title: '日期', dataIndex: 'date' },
                    {
                      title: '值班人',
                      dataIndex: 'participants',
                      render: formatParticipantSummary,
                    },
                    {
                      title: '操作',
                      dataIndex: 'date',
                      render: (value: string) =>
                        canManageOnCall ? (
                          <ManagementIconButton
                            aria-label="编辑覆盖记录"
                            size="small"
                            tooltip="编辑"
                            icon={<EditOutlined />}
                            onClick={() => openOverride(dayjs(value))}
                          />
                        ) : null,
                    },
                  ]}
                  dataSource={overrideEntries.map(([date, participants]) => ({
                    date,
                    participants,
                  }))}
                  rowKey="date"
                  pagination={false}
                />
              )
            ) : null}
          </Card>
          <Card title="待响应任务" className="soha-oncall-tasks-card">
            <AdminTable
              shellClassName="soha-management-table-shell"
              columns={taskColumns}
              dataSource={tasks}
              rowKey="id"
              loading={tasksQuery.isLoading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </>
      )}

      <Drawer
        title={drawerDate ? `${drawerDate.format('YYYY-MM-DD ddd')} 值班详情` : '值班详情'}
        open={Boolean(drawerDate)}
        onClose={() => setDrawerDate(null)}
        size={420}
      >
        {drawerDate && drawerAssignment ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="排班">{selectedSchedule?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="轮值">
                {selectedRotation?.name || '未配置'}
              </Descriptions.Item>
              <Descriptions.Item label="值班人">
                {formatParticipantSummary(drawerAssignment.participants)}
              </Descriptions.Item>
              <Descriptions.Item label="是否覆盖">
                {drawerAssignment.override ? (
                  <Tag color="orange">手动覆盖</Tag>
                ) : (
                  <Tag>遵循轮换</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
            {!drawerAssignment.override && selectedRotation ? (
              <Card size="small" title="当日班次">
                <Timeline
                  items={shiftsForDate(selectedRotation, drawerDate).map((slot) => ({
                    children: (
                      <Text>
                        {slot.start} - {slot.end} {slot.participant}
                      </Text>
                    ),
                  }))}
                />
              </Card>
            ) : null}
            {canManageOnCall ? (
              <Space>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => openOverride(drawerDate)}
                >
                  覆盖当日
                </Button>
                <Button onClick={() => navigate('/monitoring-workbench/oncall/settings')}>
                  调整轮值
                </Button>
              </Space>
            ) : null}
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title={overrideDate ? `${overrideDate.format(ONCALL_DATE_FORMAT)} 值班覆盖` : '值班覆盖'}
        open={overrideOpen}
        onCancel={() => setOverrideOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          layout="vertical"
          form={overrideForm}
          onFinish={({ participants }) => updateOverride(normalizeParticipantList(participants))}
        >
          <Form.Item name="participants" label="当日值班人员">
            <Select
              mode="multiple"
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              placeholder="选择当日值班人员"
              options={onCallUserOptions(usersQuery.data ?? [])}
            />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={updateRotationOverride.isPending}>
              保存覆盖
            </Button>
            <Button onClick={() => setOverrideOpen(false)}>取消</Button>
            <Button
              danger
              disabled={!overrideDate || !overrides[overrideDate.format(ONCALL_DATE_FORMAT)]}
              loading={updateRotationOverride.isPending}
              onClick={() => updateOverride([])}
            >
              清除覆盖
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
