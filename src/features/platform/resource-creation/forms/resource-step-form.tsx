import { useEffect, useState } from 'react'
import { Form } from 'antd'
import { StepForm } from '@/components/step-form'
import type { StepFormStep } from '@/components/step-form'
import type { ResourceFormRendererProps } from './types'

export function ResourceStepForm<Values extends object>({
  cancelText,
  loading,
  onCancel,
  onChange,
  onSubmit,
  steps,
  submitText,
  value,
}: ResourceFormRendererProps<Values> & { steps: StepFormStep[] }) {
  const [form] = Form.useForm<Values>()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    form.setFieldsValue(value as Parameters<typeof form.setFieldsValue>[0])
  }, [form, value])

  return (
    <StepForm
      cancelText={cancelText}
      current={current}
      form={form}
      initialValues={value}
      loading={loading}
      onCancel={onCancel}
      onCurrentChange={setCurrent}
      onFinish={(values) => onSubmit?.(values as Values)}
      onValuesChange={(_, values) => onChange(values as Values)}
      steps={steps}
      submitText={submitText ?? '生成 Manifest'}
    />
  )
}
