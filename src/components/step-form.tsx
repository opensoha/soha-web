import type { MouseEvent, ReactNode } from 'react'
import { Button, Form, Steps } from 'antd'
import type { FormInstance, FormProps } from 'antd'
import './step-form.css'

type StepFormFieldNames = Parameters<FormInstance['validateFields']>[0]

export interface StepFormStep {
  children: ReactNode
  fieldNames?: StepFormFieldNames
  title: ReactNode
}

interface StepFormProps extends Omit<FormProps, 'children'> {
  cancelText?: ReactNode
  contentMaxWidth?: number | string
  current: number
  loading?: boolean
  nextText?: ReactNode
  onCancel?: (event: MouseEvent<HTMLElement>) => void
  onCurrentChange: (current: number) => void
  previousText?: ReactNode
  steps: StepFormStep[]
  submitText?: ReactNode
}

export function StepForm({
  cancelText = '取消',
  className,
  contentMaxWidth = 640,
  current,
  form,
  layout = 'vertical',
  loading,
  nextText = '下一步',
  onCancel,
  onCurrentChange,
  previousText = '上一步',
  steps,
  submitText = '保存',
  ...formProps
}: StepFormProps) {
  const activeStep = steps[current]

  const stopFormSubmit = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const goNext = (event: MouseEvent<HTMLElement>) => {
    stopFormSubmit(event)
    const next = Math.min(current + 1, steps.length - 1)
    if (!form) {
      onCurrentChange(next)
      return
    }
    void form
      .validateFields(activeStep?.fieldNames)
      .then(() => onCurrentChange(next))
      .catch(() => undefined)
  }

  const goPrevious = (event: MouseEvent<HTMLElement>) => {
    stopFormSubmit(event)
    onCurrentChange(Math.max(current - 1, 0))
  }

  return (
    <Form
      {...formProps}
      className={['soha-step-form', className].filter(Boolean).join(' ')}
      form={form}
      layout={layout}
    >
      <Steps
        className="soha-step-form__steps"
        current={current}
        items={steps.map((step) => ({ title: step.title }))}
        size="small"
      />
      <div
        className="soha-step-form__content"
        style={{ maxWidth: contentMaxWidth }}
      >
        {steps.map((step, index) => (
          <div key={index} hidden={index !== current}>
            {step.children}
          </div>
        ))}
      </div>
      <div
        className="soha-step-form__actions"
        style={{ maxWidth: contentMaxWidth }}
      >
        {onCancel ? (
          <Button
            htmlType="button"
            onClick={(event) => {
              stopFormSubmit(event)
              onCancel(event)
            }}
          >
            {cancelText}
          </Button>
        ) : null}
        {current > 0 ? (
          <Button htmlType="button" onClick={goPrevious}>
            {previousText}
          </Button>
        ) : null}
        {current < steps.length - 1 ? (
          <Button htmlType="button" type="primary" onClick={goNext}>
            {nextText}
          </Button>
        ) : (
          <Button htmlType="submit" loading={loading} type="primary">
            {submitText}
          </Button>
        )}
      </div>
    </Form>
  )
}
