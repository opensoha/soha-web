import { useEffect } from 'react'
import { Button, Form, Input, Modal, Select, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  assignmentSubjectOptions,
  identityPolicyInputFromValues,
  policyFormValues,
  type IdentityPolicyFormValues,
} from '../policy-form-model'
import type { IdentityApplicationPolicy, IdentityApplicationPolicyInput } from '../types'

const { Text } = Typography

interface PolicyFormModalProps {
  editing: IdentityApplicationPolicy | null
  onCancel: () => void
  onSubmit: (input: IdentityApplicationPolicyInput) => void
  open: boolean
  submitting: boolean
}

export function PolicyFormModal({
  editing,
  onCancel,
  onSubmit,
  open,
  submitting,
}: PolicyFormModalProps) {
  const [form] = Form.useForm<IdentityPolicyFormValues>()

  useEffect(() => {
    if (open && editing) form.setFieldsValue(policyFormValues(editing))
  }, [editing, form, open])

  return (
    <Modal
      destroyOnHidden
      footer={null}
      onCancel={onCancel}
      open={open}
      title={editing ? `访问策略: ${editing.applicationName}` : '访问策略'}
      width={760}
    >
      <Form
        form={form}
        className="soha-identity-policy-form"
        initialValues={{ assignments: [] }}
        layout="vertical"
        onFinish={(values) => onSubmit(identityPolicyInputFromValues(values))}
      >
        <Form.List name="assignments">
          {(fields, { add, remove }) => (
            <div className="soha-identity-policy-assignment-editor">
              <div className="soha-identity-policy-assignment-header">
                <Text strong>Assignments</Text>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => add({ effect: 'allow', subjectId: '', subjectType: 'role' })}
                  size="small"
                >
                  添加
                </Button>
              </div>
              {fields.length ? (
                fields.map((field) => (
                  <div className="soha-identity-policy-assignment-row" key={field.key}>
                    <Form.Item name={[field.name, 'subjectType']} rules={[{ required: true }]}>
                      <Select options={assignmentSubjectOptions} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'subjectId']}
                      rules={[{ required: true, message: '请输入 subject id' }]}
                    >
                      <Input placeholder="admin / team-a / user-id" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'effect']}>
                      <Select disabled options={[{ label: 'Allow', value: 'allow' }]} />
                    </Form.Item>
                    <Button
                      aria-label="删除 assignment"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(field.name)}
                    />
                  </div>
                ))
              ) : (
                <Text type="secondary">未配置 assignment 时，所有已登录用户可访问该应用。</Text>
              )}
            </div>
          )}
        </Form.List>

        <div className="soha-identity-policy-form-actions">
          <Button onClick={onCancel}>取消</Button>
          <Button htmlType="submit" loading={submitting} type="primary">
            保存
          </Button>
        </div>
      </Form>
    </Modal>
  )
}
