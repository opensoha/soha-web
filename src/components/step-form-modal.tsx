import type { CSSProperties, ReactNode } from 'react'
import { Modal } from 'antd'
import type { FormInstance, FormProps, ModalProps } from 'antd'
import { StepForm } from './step-form'
import type { StepFormStep } from './step-form'

const visuallyHiddenModalTitleStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

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
  title: string
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
      styles={{
        header: { minHeight: 32 },
        title: visuallyHiddenModalTitleStyle,
      }}
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
