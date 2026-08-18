import type { ReactNode } from 'react'
import { Modal } from 'antd'
import type { FormInstance, FormProps, ModalProps } from 'antd'
import { visuallyHiddenModalTitleStyle } from './modal-styles'
import { StepForm } from './step-form'
import type { StepFormStep } from './step-form'

interface StepFormModalProps<Values> {
  contentMaxWidth?: number | string
  current: number
  disabled?: FormProps<Values>['disabled']
  form: FormInstance<Values>
  initialValues?: FormProps<Values>['initialValues']
  loading?: boolean
  onClose: () => void
  onCurrentChange: (current: number) => void
  onFinish: (values: Values) => void
  open: boolean
  steps: StepFormStep[]
  submitText?: ReactNode
  title: string
  width?: ModalProps['width']
}

export function StepFormModal<Values>({
  contentMaxWidth,
  current,
  disabled,
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
      styles={{
        header: { minHeight: 32 },
        title: visuallyHiddenModalTitleStyle,
      }}
      title={title}
      width={width}
      onCancel={onClose}
    >
      <StepForm
        contentMaxWidth={contentMaxWidth}
        current={current}
        disabled={disabled}
        form={form}
        initialValues={initialValues}
        loading={loading}
        onCancel={onClose}
        onCurrentChange={onCurrentChange}
        onFinish={onFinish}
        preserve={false}
        steps={steps}
        submitText={submitText}
      />
    </Modal>
  )
}
