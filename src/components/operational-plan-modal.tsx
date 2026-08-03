import { Alert, Descriptions, Modal } from 'antd'
import type { OperationalPlan } from '@opensoha/contracts/gen/ts/sohaapi'
import { StatusTag } from './status-tag'

interface OperationalPlanModalProps {
  confirmText?: string
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
  plan: OperationalPlan | null
  title: string
}

export function OperationalPlanModal({
  confirmText = '确认执行',
  loading,
  onCancel,
  onConfirm,
  plan,
  title,
}: OperationalPlanModalProps) {
  return (
    <Modal
      destroyOnHidden
      confirmLoading={loading}
      mask={{ closable: false }}
      okButtonProps={{ disabled: !plan?.ready }}
      okText={confirmText}
      onCancel={onCancel}
      onOk={onConfirm}
      open={Boolean(plan)}
      title={title}
      width={720}
    >
      {plan ? (
        <div className="space-y-4">
          <Descriptions
            bordered
            column={2}
            size="small"
            items={[
              { key: 'target', label: '目标', children: plan.target },
              {
                key: 'risk',
                label: '风险级别',
                children: <StatusTag value={plan.riskLevel} />,
              },
              { key: 'capability', label: '能力', children: plan.capability },
              {
                key: 'approval',
                label: '审批',
                children: plan.requiresApproval ? '需要审批' : '无需审批',
              },
            ]}
          />
          {plan.warnings.length > 0 ? (
            <Alert
              description={
                <ul className="list-disc pl-5">
                  {plan.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              }
              showIcon
              title="执行提示"
              type="warning"
            />
          ) : null}
          <Descriptions
            bordered
            column={1}
            size="small"
            title="计划变更"
            items={plan.changes.map((change, index) => ({
              key: `${change.action}-${change.resource}-${index}`,
              label: `${change.action} · ${change.resource}`,
              children: change.summary,
            }))}
          />
          {!plan.ready ? (
            <Alert showIcon title="计划存在阻止项，请返回修改后重新生成。" type="error" />
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}
