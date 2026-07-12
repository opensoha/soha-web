import { Alert, Form, Input, Select, Switch } from 'antd'
import type { FormInstance } from 'antd'
import type { DirectoryConnectionInput } from './types'

export function DirectoryPolicyForm({
  canManagePeople,
  form,
  onRequestEnablePeople,
}: {
  canManagePeople: boolean
  form: FormInstance<DirectoryConnectionInput>
  onRequestEnablePeople: () => void
}) {
  const mode = Form.useWatch(['policy', 'mode'], form)
  const syncPeople = Form.useWatch(['policy', 'syncPeople'], form)

  return (
    <>
      <Alert
        showIcon
        type="info"
        title="组织始终同步"
        description="目录连接会同步组织结构；人员和成员关系默认不会同步。"
      />
      <Form.Item name={['policy', 'syncOrganizations']} label="同步组织" valuePropName="checked">
        <Switch disabled checked checkedChildren="已开启" />
      </Form.Item>
      <Form.Item label="同步人员">
        <Switch
          aria-label="同步人员"
          checked={Boolean(syncPeople)}
          disabled={!canManagePeople}
          onChange={(checked) => {
            if (checked) {
              onRequestEnablePeople()
              return
            }
            form.setFieldValue(['policy', 'syncPeople'], false)
          }}
        />
      </Form.Item>
      {syncPeople ? (
        <Alert
          showIcon
          type="warning"
          title="人员同步已开启"
          description="同步可能创建或更新用户、身份关联和组织成员关系；解绑抑制仍会阻止自动重绑。"
        />
      ) : null}
      {!canManagePeople ? <Alert showIcon type="warning" title="缺少开启人员同步的权限" /> : null}
      <Form.Item name={['policy', 'mode']} label="同步方式">
        <Select
          options={[
            { value: 'manual', label: '手动' },
            { value: 'scheduled', label: '定时' },
            { value: 'scheduled_and_realtime', label: '定时 + 实时事件' },
          ]}
        />
      </Form.Item>
      {mode !== 'manual' ? (
        <Form.Item
          name={['policy', 'schedule']}
          label="同步计划"
          rules={[{ required: true, message: '请输入 Cron 表达式' }]}
          extra="使用五段 Cron 表达式，例如每小时执行一次：0 * * * *"
        >
          <Input placeholder="0 * * * *" />
        </Form.Item>
      ) : null}
      {syncPeople ? (
        <Form.Item name={['policy', 'provisionMode']} label="人员创建策略">
          <Select
            options={[
              { value: 'review_before_link', label: '人工确认后关联' },
              { value: 'create_and_link', label: '自动创建并关联' },
            ]}
          />
        </Form.Item>
      ) : null}
    </>
  )
}
