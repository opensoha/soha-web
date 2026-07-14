import { Navigate, useLocation } from 'react-router-dom'

const AI_GATEWAY_TAB_PATHS: Record<string, string> = {
  overview: '/ai-workbench/overview',
  relay: '/ai-gateway/relay',
  upstreams: '/ai-gateway/relay',
  'model-routes': '/ai-gateway/relay',
  manifest: '/ai-gateway/manifest',
  clients: '/ai-gateway/clients',
  tokens: '/ai-gateway/tokens',
  'service-accounts': '/ai-gateway/tokens',
  grants: '/ai-gateway/governance',
  policies: '/ai-gateway/governance',
  bindings: '/ai-gateway/governance',
  governance: '/ai-gateway/governance',
  approvals: '/ai-gateway/governance',
  'model-calls': '/ai-gateway/relay',
  audit: '/ai-gateway/call-logs',
  'call-logs': '/ai-gateway/call-logs',
}

export function getAIGatewayRedirectTarget(search: string) {
  const params = new URLSearchParams(search)
  const requestedTab = params.get('tab')?.trim() ?? ''
  const hasApprovalFocus = Boolean(params.get('approvalRequestId')?.trim())
  const targetPath =
    AI_GATEWAY_TAB_PATHS[requestedTab] ??
    (hasApprovalFocus ? '/ai-gateway/governance' : '/ai-workbench/overview')

  if (
    ['overview', 'relay', 'manifest', 'clients', 'tokens', 'governance', 'call-logs'].includes(
      requestedTab,
    )
  ) {
    params.delete('tab')
  }

  const suffix = params.toString()
  return `${targetPath}${suffix ? `?${suffix}` : ''}`
}

export function AIGatewayRedirectPage() {
  const location = useLocation()
  return <Navigate to={getAIGatewayRedirectTarget(location.search)} replace />
}

export function AIGatewayOverviewRedirectPage() {
  const location = useLocation()
  return <Navigate to={`/ai-workbench/overview${location.search}`} replace />
}

export function AIGatewayUpstreamsRedirectPage() {
  return <Navigate to="/ai-gateway/relay?tab=upstreams" replace />
}

export function AIGatewayModelRoutesRedirectPage() {
  return <Navigate to="/ai-gateway/relay?tab=model-routes" replace />
}

export function AIGatewayWildcardRedirectPage() {
  return <Navigate to="/ai-workbench/overview" replace />
}
