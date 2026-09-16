import { useState } from 'react'
import { Button, Form, Modal, Select } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ManagementState } from '@/components/management-list'
import { deliveryQueries } from '../queries'
import type { WorkflowTemplate } from '../types'

export function UseWorkflowTemplateVersion({
  template,
  onClose,
}: {
  template: WorkflowTemplate
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [applicationId, setApplicationId] = useState<string>()
  const [bindingId, setBindingId] = useState<string>()
  const applications = useQuery(deliveryQueries.applications.list())
  const detail = useQuery(deliveryQueries.applications.detail(applicationId ?? ''))
  return (
    <Modal
      open
      title={`使用 ${template.name} · v${template.publishedVersion}`}
      okText="配置环境工作流"
      okButtonProps={{ disabled: !applicationId || !bindingId || detail.isError }}
      onCancel={onClose}
      onOk={() => {
        if (applicationId && bindingId)
          navigate(
            `/applications/${encodeURIComponent(applicationId)}/workflows/design?${new URLSearchParams({ bindingId, source: 'template', templateId: template.id, templateVersion: String(template.publishedVersion) })}`,
          )
      }}
    >
      {applications.isError || detail.isError ? (
        <ManagementState
          compact
          kind="error"
          title="应用环境读取失败"
          actions={
            <Button
              onClick={() => {
                void applications.refetch()
                if (applicationId) void detail.refetch()
              }}
            >
              重试
            </Button>
          }
        />
      ) : null}
      <Form layout="vertical">
        <Form.Item label="应用" required>
          <Select
            aria-label="使用模板的应用"
            showSearch={{ optionFilterProp: 'label' }}
            value={applicationId}
            loading={applications.isLoading}
            options={applications.data
              ?.filter((app) => app.enabled)
              .map((app) => ({ value: app.id, label: app.name }))}
            onChange={(value) => {
              setApplicationId(value)
              setBindingId(undefined)
            }}
          />
        </Form.Item>
        <Form.Item label="环境" required>
          <Select
            aria-label="使用模板的环境"
            value={bindingId}
            loading={detail.isLoading}
            disabled={!applicationId}
            options={detail.data?.bindings?.map((binding) => ({
              value: binding.applicationEnvironmentId,
              label: binding.environmentName || binding.environmentKey || binding.environmentId,
            }))}
            onChange={setBindingId}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
