import { useLocation } from 'react-router-dom'
import { operationPresetFromSearch } from '../virtualization-model'
import { OperationsTable } from './operations-table'

export function VirtualizationOperationsPage() {
  const location = useLocation()
  const preset = operationPresetFromSearch(location.search)

  return (
    <div className="soha-page soha-virtualization-page">
      <OperationsTable initialPreset={preset} />
    </div>
  )
}
