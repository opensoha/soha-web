import { WorkloadDetailShell } from '../shared/detail-shell'
import { ReplicaDetailOverview } from '../shared/replica-detail-overview'
import type { ReplicaSetDetail } from './types'

export function ReplicaSetDetailPage() {
  return (
    <WorkloadDetailShell
      paramKey="replicaSetName"
      resource="replicasets"
      title="ReplicaSet"
      extraOverview={(detail) => (
        <ReplicaDetailOverview detail={detail as unknown as ReplicaSetDetail} title="ReplicaSet" />
      )}
    />
  )
}
