import { ConfigurationDataWorkspace } from '../shared/data-workspace'
import type { ConfigMapDetail } from './types'

export function ConfigMapDataTab(props: {
  blocked?: boolean
  applying?: boolean
  canEdit: boolean
  detail: ConfigMapDetail
  onApply: (data: Record<string, string>) => void | Promise<unknown>
}) {
  return <ConfigurationDataWorkspace {...props} />
}
