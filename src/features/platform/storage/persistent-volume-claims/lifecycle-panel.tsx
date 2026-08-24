import { Alert, Steps } from 'antd'
import { useI18n } from '@/i18n'
import type { PersistentVolumeClaimDetail } from '@/types/platform'
import { assessPersistentVolumeClaim } from './lifecycle-model'

export function PersistentVolumeClaimLifecyclePanel({
  claim,
}: {
  claim: PersistentVolumeClaimDetail
}) {
  const { localeCode } = useI18n()
  const assessment = assessPersistentVolumeClaim(claim)
  const messages = assessment.risks.map((risk) => {
    const zh = {
      lost: 'PVC 已进入 Lost 状态，请检查对应 PV 与存储后端。',
      pending: 'PVC 仍在等待绑定，请检查 StorageClass、容量和拓扑约束。',
      unmounted: 'PVC 已绑定，但当前没有 Pod 挂载。',
      'multi-node-rwo': 'ReadWriteOnce PVC 同时出现在多个节点，存在 Multi-Attach 风险。',
      truncated: 'Pod 关系已截断，实际挂载范围可能更大。',
    }[risk]
    const en = {
      lost: 'The PVC is Lost; inspect the PV and storage backend.',
      pending: 'The PVC is waiting for binding; inspect StorageClass, capacity, and topology.',
      unmounted: 'The PVC is bound but is not currently mounted by a Pod.',
      'multi-node-rwo':
        'A ReadWriteOnce PVC appears on multiple nodes and may hit Multi-Attach errors.',
      truncated: 'Pod relationships are truncated; the actual mount scope may be larger.',
    }[risk]
    return localeCode === 'zh_CN' ? zh : en
  })

  return (
    <div className="soha-detail-stack">
      <Steps
        current={assessment.currentStep}
        size="small"
        items={[
          { title: localeCode === 'zh_CN' ? '已申请' : 'Provisioned' },
          { title: localeCode === 'zh_CN' ? '已绑定' : 'Bound' },
          { title: localeCode === 'zh_CN' ? '已挂载' : 'Mounted' },
        ]}
      />
      {messages.map((message, index) => (
        <Alert
          key={assessment.risks[index]}
          showIcon
          type={
            assessment.risks[index] === 'lost' || assessment.risks[index] === 'multi-node-rwo'
              ? 'error'
              : assessment.risks[index] === 'unmounted'
                ? 'info'
                : 'warning'
          }
          title={message}
        />
      ))}
    </div>
  )
}
