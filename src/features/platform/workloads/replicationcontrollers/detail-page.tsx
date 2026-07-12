import { WorkloadYAMLOnlyDetailPage } from '../shared/yaml-only-detail-page'

export function ReplicationControllerDetailPage() {
  return (
    <WorkloadYAMLOnlyDetailPage
      paramKey="replicationControllerName"
      resource="replicationcontrollers"
      title="ReplicationController"
    />
  )
}
