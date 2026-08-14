import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  CodeOutlined,
  CompressOutlined,
  DownOutlined,
  ExpandOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { Button, Spin, Tabs, Tooltip } from 'antd'
import { useI18n } from '@/i18n'
import type { RealtimeSession } from './types'
import './session-dock.css'

const PodLogViewer = lazy(async () => {
  const module = await import('@/components/pod-log-viewer')
  return { default: module.PodLogViewer }
})

const PodTerminal = lazy(async () => {
  const module = await import('@/components/pod-terminal')
  return { default: module.PodTerminal }
})

interface RealtimeSessionDockPanelProps {
  activeClusterId: string | null
  activeSessionKeys: Record<string, string>
  maximized: boolean
  onActiveSessionChange: (clusterId: string, sessionId: string) => void
  onCloseSession: (sessionId: string) => void
  onMaximize: () => void
  onMinimize: () => void
  sessions: RealtimeSession[]
  visible: boolean
}

interface DockResizeState {
  pointerId: number
  startHeight: number
  startY: number
}

const DOCK_MIN_HEIGHT = 240
const DOCK_TOP_GAP = 64
const DOCK_KEYBOARD_STEP = 32
const DOCK_DESKTOP_MIN_HEIGHT = 300
const DOCK_DESKTOP_MAX_HEIGHT = 520

function dockHeightBounds() {
  const max = Math.max(120, window.innerHeight - DOCK_TOP_GAP)
  return { min: Math.min(DOCK_MIN_HEIGHT, max), max }
}

function clampDockHeight(height: number) {
  const { min, max } = dockHeightBounds()
  return Math.min(Math.max(height, min), max)
}

function defaultDockHeight() {
  const preferred = window.innerHeight * (window.innerWidth <= 768 ? 0.56 : 0.44)
  return clampDockHeight(
    window.innerWidth <= 768
      ? preferred
      : Math.min(Math.max(preferred, DOCK_DESKTOP_MIN_HEIGHT), DOCK_DESKTOP_MAX_HEIGHT),
  )
}

function SessionContent({ session }: { session: RealtimeSession }) {
  return (
    <div className="soha-realtime-session-pane">
      <Suspense
        fallback={
          <div className="soha-realtime-session-loading">
            <Spin size="large" />
          </div>
        }
      >
        {session.kind === 'logs' ? (
          <PodLogViewer
            active
            clusterId={session.clusterId}
            namespace={session.namespace}
            podName={session.podName}
            container={session.container}
            streamingDisabledReason={session.streamingDisabledReason}
          />
        ) : (
          <PodTerminal
            clusterId={session.clusterId}
            namespace={session.namespace}
            podName={session.podName}
            container={session.container}
            shell={session.shell}
          />
        )}
      </Suspense>
    </div>
  )
}

export function RealtimeSessionDockPanel({
  activeClusterId,
  activeSessionKeys,
  maximized,
  onActiveSessionChange,
  onCloseSession,
  onMaximize,
  onMinimize,
  sessions,
  visible,
}: RealtimeSessionDockPanelProps) {
  const { localeCode } = useI18n()
  const dockRef = useRef<HTMLElement>(null)
  const resizeRef = useRef<DockResizeState | null>(null)
  const [dockHeight, setDockHeight] = useState<number>()
  const clusterGroups = useMemo(() => {
    const groups = new Map<string, RealtimeSession[]>()
    sessions.forEach((session) => {
      groups.set(session.clusterId, [...(groups.get(session.clusterId) ?? []), session])
    })
    return Array.from(groups.entries())
  }, [sessions])
  const activeClusterHasSessions = Boolean(
    activeClusterId && clusterGroups.some(([clusterId]) => clusterId === activeClusterId),
  )
  const title = localeCode === 'zh_CN' ? '实时会话' : 'Live sessions'
  const resizeLabel = localeCode === 'zh_CN' ? '调整实时会话高度' : 'Resize live sessions'

  const currentDockHeight = () => {
    const measuredHeight = dockRef.current?.getBoundingClientRect().height
    return dockHeight ?? (measuredHeight ? measuredHeight : defaultDockHeight())
  }

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (maximized || event.button !== 0) return
    event.preventDefault()
    resizeRef.current = {
      pointerId: event.pointerId,
      startHeight: currentDockHeight(),
      startY: event.clientY,
    }
  }

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const { min, max } = dockHeightBounds()
    const nextHeight =
      event.key === 'ArrowUp'
        ? currentDockHeight() + DOCK_KEYBOARD_STEP
        : event.key === 'ArrowDown'
          ? currentDockHeight() - DOCK_KEYBOARD_STEP
          : event.key === 'Home'
            ? min
            : event.key === 'End'
              ? max
              : null
    if (nextHeight === null) return
    event.preventDefault()
    setDockHeight(clampDockHeight(nextHeight))
  }

  useEffect(() => {
    if (!visible) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (maximized) onMaximize()
      else onMinimize()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [maximized, onMaximize, onMinimize, visible])

  useEffect(() => {
    if (!visible || maximized) return undefined
    const handlePointerMove = (event: PointerEvent) => {
      const resize = resizeRef.current
      if (!resize || resize.pointerId !== event.pointerId) return
      event.preventDefault()
      setDockHeight(clampDockHeight(resize.startHeight + resize.startY - event.clientY))
    }
    const handlePointerEnd = (event: PointerEvent) => {
      if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      resizeRef.current = null
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [maximized, visible])

  useEffect(() => {
    window.dispatchEvent(new Event('soha:session-dock-layout'))
  }, [dockHeight, maximized, visible])

  return (
    <section
      ref={dockRef}
      aria-label={title}
      className={`soha-realtime-session-dock${maximized ? ' is-maximized' : ''}`}
      hidden={!visible}
      style={
        dockHeight === undefined
          ? undefined
          : ({ '--soha-realtime-session-height': `${dockHeight}px` } as CSSProperties)
      }
    >
      {!maximized ? (
        <div
          aria-label={resizeLabel}
          aria-orientation="horizontal"
          aria-valuemax={dockHeightBounds().max}
          aria-valuemin={dockHeightBounds().min}
          aria-valuenow={Math.round(currentDockHeight())}
          className="soha-realtime-session-dock__resize-handle"
          role="separator"
          tabIndex={0}
          onKeyDown={handleResizeKeyDown}
          onPointerDown={handleResizePointerDown}
        />
      ) : null}
      <div className="soha-realtime-session-dock__header">
        <div className="soha-realtime-session-dock__identity">
          <CodeOutlined />
          <strong>{title}</strong>
          {activeClusterId ? (
            <span className="soha-realtime-session-dock__scope" title={activeClusterId}>
              {activeClusterId}
            </span>
          ) : null}
        </div>
        <div className="soha-realtime-session-dock__actions">
          <Tooltip
            title={
              maximized
                ? localeCode === 'zh_CN'
                  ? '还原实时会话'
                  : 'Restore live sessions'
                : localeCode === 'zh_CN'
                  ? '最大化实时会话'
                  : 'Maximize live sessions'
            }
          >
            <Button
              aria-label={
                maximized
                  ? localeCode === 'zh_CN'
                    ? '还原实时会话'
                    : 'Restore live sessions'
                  : localeCode === 'zh_CN'
                    ? '最大化实时会话'
                    : 'Maximize live sessions'
              }
              icon={maximized ? <CompressOutlined /> : <ExpandOutlined />}
              size="small"
              type="text"
              onClick={onMaximize}
            />
          </Tooltip>
          <Tooltip title={localeCode === 'zh_CN' ? '收起实时会话' : 'Minimize live sessions'}>
            <Button
              aria-label={localeCode === 'zh_CN' ? '收起实时会话' : 'Minimize live sessions'}
              icon={<DownOutlined />}
              size="small"
              type="text"
              onClick={onMinimize}
            />
          </Tooltip>
        </div>
      </div>
      <div className="soha-realtime-session-dock__body">
        {clusterGroups
          .filter(([clusterId]) => clusterId === activeClusterId)
          .map(([clusterId, clusterSessions]) => {
            const requestedActiveKey = activeSessionKeys[clusterId]
            const activeKey = clusterSessions.some((session) => session.id === requestedActiveKey)
              ? requestedActiveKey
              : clusterSessions[clusterSessions.length - 1]?.id
            return (
              <div
                key={clusterId}
                className="soha-realtime-session-cluster"
                data-cluster-id={clusterId}
                hidden={clusterId !== activeClusterId}
              >
                <Tabs
                  activeKey={activeKey}
                  animated={false}
                  destroyOnHidden
                  hideAdd
                  items={clusterSessions.map((session) => {
                    const kindLabel =
                      session.kind === 'logs'
                        ? localeCode === 'zh_CN'
                          ? '日志'
                          : 'Logs'
                        : localeCode === 'zh_CN'
                          ? '终端'
                          : 'Terminal'
                    const fullLabel = [
                      kindLabel,
                      session.clusterId,
                      session.namespace,
                      session.podName,
                      session.container,
                    ]
                      .filter(Boolean)
                      .join(' / ')
                    return {
                      key: session.id,
                      label: (
                        <span className="soha-realtime-session-tab-label" title={fullLabel}>
                          {session.kind === 'logs' ? <FileTextOutlined /> : <CodeOutlined />}
                          <span>{kindLabel}</span>
                          <span className="soha-realtime-session-tab-label__pod">
                            {session.podName}
                          </span>
                          {session.container ? (
                            <span className="soha-realtime-session-tab-label__container">
                              / {session.container}
                            </span>
                          ) : null}
                        </span>
                      ),
                      children: <SessionContent session={session} />,
                    }
                  })}
                  size="small"
                  type="editable-card"
                  onChange={(sessionId) => onActiveSessionChange(clusterId, sessionId)}
                  onEdit={(targetKey, action) => {
                    if (action === 'remove' && typeof targetKey === 'string') {
                      onCloseSession(targetKey)
                    }
                  }}
                />
              </div>
            )
          })}
        {!activeClusterHasSessions ? (
          <div className="soha-realtime-session-empty" role="status">
            <CodeOutlined />
            <span>
              {activeClusterId
                ? localeCode === 'zh_CN'
                  ? '当前集群暂无实时会话'
                  : 'No live sessions in the current cluster'
                : localeCode === 'zh_CN'
                  ? '尚未选择集群'
                  : 'No cluster selected'}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  )
}
