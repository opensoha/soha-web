import { Navigate, useParams } from 'react-router-dom'

export function LegacySourceConnectionDetailRedirect() {
  const { integrationId = '' } = useParams<{ integrationId: string }>()
  return <Navigate replace to={`/settings/source-control/${encodeURIComponent(integrationId)}`} />
}
