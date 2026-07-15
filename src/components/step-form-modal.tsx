import type { ReactNode } from 'react'
import { Modal } from 'antd'
import type { FormInstance, FormProps, ModalProps } from 'antd'
import { StepForm } from './step-form'
import type { StepFormStep } from './step-form'

interface StepFormModalProps<Values> {
  current: number
  form: FormInstance<Values>
  initialValues?: FormProps<Values>['initialValues']
  loading?: boolean
  onClose: () => void
  onCurrentChange: (current: number) => void
  onFinish: (values: Values) => void
  open: boolean
  steps: StepFormStep[]
  submitText?: ReactNode
  title: ReactNode
  width?: ModalProps['width']
}

export function StepFormModal<Values>({
  current,
  form,
  initialValues,
  loading,
  onClose,
  onCurrentChange,
  onFinish,
  open,
  steps,
  submitText,
  title,
  width = 720,
}: StepFormModalProps<Values>) {
  return (
    <Modal
      destroyOnHidden
      footer={null}
      mask={{ closable: false }}
      open={open}
      title={title}
      width={width}
      onCancel={onClose}
    >
      <StepForm
        current={current}
        form={form}
        initialValues={initialValues}
        loading={loading}
        onCancel={onClose}
        onCurrentChange={onCurrentChange}
        onFinish={onFinish}
        steps={steps}
        submitText={submitText}
      />
    </Modal>
  )
}
