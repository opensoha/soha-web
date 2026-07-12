import type { ReactNode } from 'react'

export function WorkbenchShell({ alerts, children }: { alerts?: ReactNode; children: ReactNode }) {
  return (
    <div className="soha-page soha-ai-workbench-page">
      <div className="soha-ai-workbench">
        {alerts}
        <section className="soha-ai-workbench__workspace">{children}</section>
      </div>
    </div>
  )
}
