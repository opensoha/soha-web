import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Badge } from 'antd'
import { CodeOutlined } from '@ant-design/icons'
import { HeaderActionButton } from '@/components/header-action-button'
import { useI18n } from '@/i18n'
import { usePlatformScopeStore } from '@/stores/platform-scope-store'
import { normalizeRealtimeSession, type RealtimeSession, type RealtimeSessionInput } from './types'

const RealtimeSessionDockPanel = lazy(async () => {
  const module = await import('./session-dock-panel')
  return { default: module.RealtimeSessionDockPanel }
})

interface RealtimeSessionDockContextValue {
  activeClusterId: string | null
  activeSessionKeys: Record<string, string>
  closeSession: (sessionId: string) => void
  dockOpen: boolean
  maximizeDock: () => void
  maximized: boolean
  minimizeDock: () => void
  openSession: (input: RealtimeSessionInput) => void
  sessions: RealtimeSession[]
  setActiveSession: (clusterId: string, sessionId: string) => void
  toggleDock: () => void
}

const RealtimeSessionDockContext = createContext<RealtimeSessionDockContextValue | null>(null)

export function useRealtimeSessionDock() {
  const context = useContext(RealtimeSessionDockContext)
  if (!context) {
    throw new Error('useRealtimeSessionDock must be used inside RealtimeSessionDockProvider')
  }
  return context
}

export function RealtimeSessionDockProvider({
  children,
  visible,
}: {
  children: ReactNode
  visible: boolean
}) {
  const activeClusterId = usePlatformScopeStore((state) => state.clusterId)
  const [sessions, setSessions] = useState<RealtimeSession[]>([])
  const [activeSessionKeys, setActiveSessionKeys] = useState<Record<string, string>>({})
  const [dockOpen, setDockOpen] = useState(false)
  const [maximized, setMaximized] = useState(false)

  const openSession = useCallback((input: RealtimeSessionInput) => {
    const session = normalizeRealtimeSession(input)
    if (!session) return

    setSessions((current) => {
      const existing = current.findIndex((item) => item.id === session.id)
      if (existing < 0) return [...current, session]
      return current.map((item, index) => (index === existing ? session : item))
    })
    setActiveSessionKeys((current) => ({ ...current, [session.clusterId]: session.id }))
    setDockOpen(true)
  }, [])

  const replaceSession = useCallback((sessionId: string, input: RealtimeSessionInput) => {
    const replacement = normalizeRealtimeSession(input)
    if (!replacement) return

    setSessions((current) => {
      const index = current.findIndex((session) => session.id === sessionId)
      if (index < 0) return current
      const next = current.filter(
        (session) => session.id !== sessionId && session.id !== replacement.id,
      )
      next.splice(Math.min(index, next.length), 0, replacement)
      return next
    })
    setActiveSessionKeys((current) => ({
      ...current,
      [replacement.clusterId]: replacement.id,
    }))
  }, [])

  const closeSession = useCallback(
    (sessionId: string) => {
      const closing = sessions.find((session) => session.id === sessionId)
      if (!closing) return
      const remaining = sessions.filter((session) => session.id !== sessionId)
      setSessions(remaining)
      setActiveSessionKeys((current) => {
        if (current[closing.clusterId] !== sessionId) return current
        const clusterSessions = remaining.filter(
          (session) => session.clusterId === closing.clusterId,
        )
        const replacement = clusterSessions[clusterSessions.length - 1]
        const next = { ...current }
        if (replacement) next[closing.clusterId] = replacement.id
        else delete next[closing.clusterId]
        return next
      })
      if (remaining.length === 0) {
        setDockOpen(false)
        setMaximized(false)
      }
    },
    [sessions],
  )

  const setActiveSession = useCallback((clusterId: string, sessionId: string) => {
    setActiveSessionKeys((current) => ({ ...current, [clusterId]: sessionId }))
  }, [])

  const toggleDock = useCallback(() => {
    if (dockOpen) setMaximized(false)
    setDockOpen(!dockOpen)
  }, [dockOpen])

  const minimizeDock = useCallback(() => {
    setDockOpen(false)
    setMaximized(false)
  }, [])

  const maximizeDock = useCallback(() => {
    setDockOpen(true)
    setMaximized((current) => !current)
  }, [])

  const contextValue = useMemo<RealtimeSessionDockContextValue>(
    () => ({
      activeClusterId,
      activeSessionKeys,
      closeSession,
      dockOpen,
      maximizeDock,
      maximized,
      minimizeDock,
      openSession,
      sessions,
      setActiveSession,
      toggleDock,
    }),
    [
      activeClusterId,
      activeSessionKeys,
      closeSession,
      dockOpen,
      maximizeDock,
      maximized,
      minimizeDock,
      openSession,
      sessions,
      setActiveSession,
      toggleDock,
    ],
  )

  return (
    <RealtimeSessionDockContext.Provider value={contextValue}>
      {children}
      {visible && dockOpen ? (
        <Suspense fallback={null}>
          <RealtimeSessionDockPanel
            activeClusterId={activeClusterId}
            activeSessionKeys={activeSessionKeys}
            maximized={maximized}
            sessions={sessions}
            visible={visible && dockOpen}
            onActiveSessionChange={setActiveSession}
            onCloseSession={closeSession}
            onMaximize={maximizeDock}
            onMinimize={minimizeDock}
            onReplaceSession={replaceSession}
          />
        </Suspense>
      ) : null}
    </RealtimeSessionDockContext.Provider>
  )
}

export function RealtimeSessionDockTrigger() {
  const { localeCode } = useI18n()
  const { activeClusterId, dockOpen, sessions, toggleDock } = useRealtimeSessionDock()
  const sessionCount = activeClusterId
    ? sessions.filter((session) => session.clusterId === activeClusterId).length
    : 0
  const label = localeCode === 'zh_CN' ? '实时会话' : 'Live sessions'
  const ariaLabel = sessionCount > 0 ? `${label} (${sessionCount})` : label

  return (
    <HeaderActionButton
      ariaLabel={ariaLabel}
      className="soha-header-realtime-sessions"
      icon={
        <Badge count={sessionCount} overflowCount={99} size="small">
          <CodeOutlined />
        </Badge>
      }
      label={label}
      title={ariaLabel}
      pressed={dockOpen}
      onClick={toggleDock}
    />
  )
}
