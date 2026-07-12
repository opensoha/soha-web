import { WorkloadYAMLOnlyDetailPage } from '../shared/yaml-only-detail-page'

export function ReplicaSetDetailPage() {
  return (
    <WorkloadYAMLOnlyDetailPage
      paramKey="replicaSetName"
      resource="replicasets"
      title="ReplicaSet"
    />
  )
}
