import { ManagementDataPage } from '@/components/management-data-page'
import { OperationsTable } from './table'

export function DockerOperationsPage() {
  return <ManagementDataPage className="soha-docker-page" tableNode={<OperationsTable />} />
}
