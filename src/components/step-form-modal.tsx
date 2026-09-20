import type { ReactNode } from 'react'
import { Modal } from 'antd'
import type { FormInstance, FormProps, ModalProps } from 'antd'
import { scrollableModalBodyStyle } from './modal-styles'
import { StepForm } from './step-form'
import type { StepFormStep } from './step-form'

interface StepFormModalBaseProps {
  bodyClassName?: string
  onClose: () => void
  open: boolean
  title: ReactNode
  width?: ModalProps['width']
}

interface ManagedStepFormModalProps<Values> extends StepFormModalBaseProps {
  children?: never
  contentMaxWidth?: number | string
  current: number
  disabled?: FormProps<Values>['disabled']
  form: FormInstance<Values>
  initialValues?: FormProps<Values>['initialValues']
  loading?: boolean
  onCurrentChange: (current: number) => void
  onFinish: (values: Values) => void
  steps: StepFormStep[]
  submitText?: ReactNode
}

interface ComposedStepFormModalProps extends StepFormModalBaseProps {
  children: ReactNode
}

type StepFormModalProps<Values> = ManagedStepFormModalProps<Values> | ComposedStepFormModalProps

export function StepFormModal<Values>(props: StepFormModalProps<Values>) {
  const { bodyClassName, onClose, open, title, width = 720 } = props
  return (
    <Modal
      style={{ top: 32, marginTop: 0 }}
      classNames={{
        body: ['soha-step-form-modal__body', bodyClassName].filter(Boolean).join(' '),
      }}
      destroyOnHidden
      footer={null}
      mask={{ closable: false }}
      open={open}
      styles={{
        body: { ...scrollableModalBodyStyle, maxHeight: 'calc(100dvh - 160px)' },
        header: {
          minHeight: 32,
          display: 'flex',
          alignItems: 'center',
          marginBottom: 16,
          paddingBottom: 0,
          paddingInlineEnd: 32,
        },
      }}
      title={title}
      width={width}
      onCancel={onClose}
    >
      {'children' in props ? (
        props.children
      ) : (
        <StepForm
          contentMaxWidth={props.contentMaxWidth}
          current={props.current}
          disabled={props.disabled}
          form={props.form}
          initialValues={props.initialValues}
          loading={props.loading}
          onCancel={onClose}
          onCurrentChange={props.onCurrentChange}
          onFinish={props.onFinish}
          preserve={false}
          steps={props.steps}
          submitText={props.submitText}
        />
      )}
    </Modal>
  )
}
