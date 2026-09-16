import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeftOutlined,
  CloseOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { Button, Drawer, Grid } from 'antd'
import { Link, useLocation } from 'react-router-dom'

export function WorkbenchShell({
  alerts,
  children,
  sidebar,
  toolbar,
  panelOpen,
  onClosePanel,
}: {
  alerts?: ReactNode
  children: ReactNode
  sidebar: ReactNode
  toolbar: ReactNode
  panelOpen: boolean
  onClosePanel: () => void
}) {
  const screens = Grid.useBreakpoint()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const sidebarVisible = Boolean(screens.lg && !collapsed && (!panelOpen || screens.xxl))

  useEffect(() => setSessionsOpen(false), [location.pathname, location.search])

  const sessionNavigation = (
    <>
      {sidebar}
      <Link className="soha-ai-workbench__back" to={`/ai-workbench/overview${location.search}`}>
        <ArrowLeftOutlined /> 返回工作台
      </Link>
    </>
  )

  return (
    <div className="soha-ai-workbench-page">
      <div className="soha-ai-workbench">
        {alerts}
        <div className="soha-ai-workbench__toolbar">
          <Button
            aria-label={sidebarVisible ? '收起会话列表' : '展开会话列表'}
            aria-expanded={sidebarVisible || sessionsOpen}
            type="text"
            icon={sidebarVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={() => {
              if (!screens.lg) {
                onClosePanel()
                setSessionsOpen(true)
              } else if (panelOpen && !screens.xxl) {
                onClosePanel()
                setCollapsed(false)
              } else {
                setCollapsed(!collapsed)
              }
            }}
          />
          {toolbar}
        </div>
        <section
          className={`soha-ai-workbench__workspace${sidebarVisible ? ' has-sidebar' : ''}${panelOpen && screens.lg ? ' has-detail' : ''}`}
        >
          <div className="soha-ai-workbench__session-slot" hidden={!sidebarVisible}>
            {screens.lg ? sessionNavigation : null}
          </div>
          {children}
        </section>
      </div>
      {!screens.lg ? (
        <Drawer
          title="会话记录"
          placement="left"
          size="min(320px, 100vw)"
          open={sessionsOpen}
          onClose={() => setSessionsOpen(false)}
        >
          <div className="soha-ai-workbench__session-slot">{sessionNavigation}</div>
        </Drawer>
      ) : null}
    </div>
  )
}

export function WorkbenchPanel({
  title,
  open,
  onClose,
  extra,
  footer,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  extra?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  const screens = Grid.useBreakpoint()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open || !screens.lg) return
    triggerRef.current = document.activeElement as HTMLElement | null
    headingRef.current?.focus()
  }, [open, screens.lg])

  const closePanel = () => {
    if (triggerRef.current?.isConnected) triggerRef.current.focus()
    onClose()
  }

  if (!screens.lg) {
    return (
      <Drawer
        title={title}
        open={open}
        onClose={onClose}
        size="100%"
        extra={extra}
        footer={footer}
        rootClassName="soha-ai-workbench__mobile-detail"
      >
        {children}
      </Drawer>
    )
  }
  if (!open) return null
  return (
    <aside
      className="soha-ai-workbench__detail"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          closePanel()
        }
      }}
    >
      <div className="soha-ai-workbench__detail-header">
        <div className="soha-ai-workbench__detail-title">
          <h2 ref={headingRef} tabIndex={-1}>
            {title}
          </h2>
          <Button
            type="text"
            aria-label={`关闭${title}`}
            icon={<CloseOutlined />}
            onClick={closePanel}
          />
        </div>
        {extra}
      </div>
      <div className="soha-ai-workbench__detail-body">{children}</div>
      {footer ? <div className="soha-ai-workbench__detail-footer">{footer}</div> : null}
    </aside>
  )
}
