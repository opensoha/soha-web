import { WorkloadDetailShell } from '../shared/detail-shell'
import { ReplicaDetailOverview } from '../shared/replica-detail-overview'
import type { ReplicationControllerDetail } from './types'

export function ReplicationControllerDetailPage() {
  return (
    <WorkloadDetailShell
      paramKey="replicationControllerName"
      resource="replicationcontrollers"
      title="ReplicationController"
      extraOverview={(detail) => (
        <ReplicaDetailOverview
          detail={detail as unknown as ReplicationControllerDetail}
          title="ReplicationController"
        />
      )}
    />
  )
}
