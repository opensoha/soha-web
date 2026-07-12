import { Navigate, useLocation } from 'react-router-dom'
import {
  getAIOperationsPath,
  getAIToolsPath,
  getAIWorkbenchPathForMode,
} from '../workbench/navigation'

export function AIWorkbenchModeRedirect() {
  const location = useLocation()
  return (
    <Navigate
      to={getAIWorkbenchPathForMode(
        new URLSearchParams(location.search).get('mode'),
        location.search,
      )}
      replace
    />
  )
}

export function AIWorkbenchFixedModeRedirect({ mode }: { mode: string }) {
  const location = useLocation()
  return <Navigate to={getAIWorkbenchPathForMode(mode, location.search)} replace />
}

export function AIWorkbenchRootCauseRedirect() {
  return <AIWorkbenchFixedModeRedirect mode="root_cause" />
}

export function AIWorkbenchPerformanceRedirect() {
  return <AIWorkbenchFixedModeRedirect mode="performance" />
}

export function AIWorkbenchOperationsRedirect() {
  const location = useLocation()
  return <Navigate to={getAIOperationsPath(location.search)} replace />
}

export function AIWorkbenchToolsRedirect() {
  const location = useLocation()
  return <Navigate to={getAIToolsPath(location.search)} replace />
}
