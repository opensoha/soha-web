import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DeleteOutlined } from '@ant-design/icons'
import { Button, Card, Select, Space, Tag, Typography } from 'antd'
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { ManagementState } from '@/components/management-list'
import '@/components/resource-operation-panels.css'
import { withStreamTicket } from '@/features/auth'
import { readTerminalThemeColors } from '@/theme/app-theme'
import {
  dockerRuntimeWebSocketURL,
  runtimeServiceSelector,
  type DockerRuntimePanelProps,
  type TerminalMessage,
} from './shared'
import './styles.css'

const { Text } = Typography

export function DockerProjectTerminalPanel({
  enabled,
  projectId,
  serviceName,
  serviceOptions,
  servicesLoading,
  onServiceChange,
}: DockerRuntimePanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const terminalRunRef = useRef(0)
  const [shell, setShell] = useState('/bin/sh')
  const [connectionState, setConnectionState] = useState<
    'idle' | 'connecting' | 'connected' | 'closed' | 'error'
  >('idle')
  const canConnectRuntime = enabled && Boolean(projectId && serviceName)

  const terminalURL = useMemo(() => {
    if (!canConnectRuntime) return ''
    return dockerRuntimeWebSocketURL(projectId, 'terminal', { serviceName, shell })
  }, [canConnectRuntime, projectId, serviceName, shell])

  const disposeTerminal = useCallback(() => {
    terminalRunRef.current += 1
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'close' }))
    }
    socket?.close()
    socketRef.current = null
    terminalRef.current?.dispose()
    terminalRef.current = null
    fitAddonRef.current = null
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
  }, [])

  const connect = useCallback(() => {
    if (!enabled || !containerRef.current || !terminalURL) {
      return
    }
    void (async () => {
      disposeTerminal()
      const runId = terminalRunRef.current + 1
      terminalRunRef.current = runId
      setConnectionState('connecting')
      let ticketedURL: string
      try {
        ticketedURL = await withStreamTicket(terminalURL)
      } catch {
        if (terminalRunRef.current !== runId) return
        setConnectionState('error')
        return
      }
      const [{ Terminal: XTerm }, { FitAddon: XTermFitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ])
      if (terminalRunRef.current !== runId || !containerRef.current) {
        return
      }
      const terminal = new XTerm({
        cursorBlink: true,
        convertEol: true,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
        fontSize: 13,
        theme: readTerminalThemeColors(),
      })
      const fitAddon = new XTermFitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(containerRef.current)
      fitAddon.fit()
      terminal.writeln('Connecting to docker service...')
      terminalRef.current = terminal
      fitAddonRef.current = fitAddon

      const socket = new WebSocket(ticketedURL)
      socketRef.current = socket
      socket.onopen = () => {
        if (socketRef.current !== socket) return
        setConnectionState('connected')
        terminal.writeln('Connected.')
      }
      socket.onmessage = (event) => {
        if (socketRef.current !== socket) return
        const message = JSON.parse(event.data) as TerminalMessage
        if (message.type === 'stdout' || message.type === 'stderr') {
          terminal.write(message.data || '')
        }
        if (message.type === 'status' && message.message) {
          terminal.writeln(`\r\n${message.message}`)
        }
        if (message.type === 'error') {
          setConnectionState('error')
          terminal.writeln(`\r\n${message.message || 'terminal error'}`)
        }
        if (message.type === 'exit') {
          setConnectionState('closed')
          terminal.writeln('\r\nSession closed.')
        }
      }
      socket.onerror = () => {
        if (socketRef.current !== socket) return
        setConnectionState('error')
      }
      socket.onclose = () => {
        if (socketRef.current !== socket) return
        setConnectionState((current) => (current === 'error' ? 'error' : 'closed'))
      }
      terminal.onData((data) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'input', data }))
        }
      })
      resizeObserverRef.current = new ResizeObserver(() => fitAddon.fit())
      resizeObserverRef.current.observe(containerRef.current)
    })()
  }, [disposeTerminal, enabled, terminalURL])

  useEffect(() => {
    if (!terminalURL) {
      disposeTerminal()
    }
  }, [disposeTerminal, terminalURL])

  useEffect(() => disposeTerminal, [disposeTerminal])

  const statusColor =
    connectionState === 'connected' ? 'green' : connectionState === 'error' ? 'red' : 'default'

  if (!enabled) {
    return (
      <Card className="soha-docker-runtime-card" size="small">
        <ManagementState
          compact
          kind="no-permission"
          title="Shell 不可用"
          description="Docker 模块或当前权限不允许连接运行时 Shell。"
        />
      </Card>
    )
  }

  return (
    <Card
      className="soha-docker-runtime-card"
      size="small"
      title="Shell"
      extra={
        <Space size={8} wrap>
          {runtimeServiceSelector({
            disabled: !enabled,
            loading: servicesLoading,
            options: serviceOptions,
            serviceName,
            onChange: onServiceChange,
          })}
          <Select
            disabled={!enabled}
            options={[
              { value: '/bin/sh', label: 'sh' },
              { value: '/bin/bash', label: 'bash' },
            ]}
            popupMatchSelectWidth={false}
            size="small"
            value={shell}
            onChange={setShell}
          />
          <Button
            disabled={!enabled || !serviceName || connectionState === 'connecting'}
            size="small"
            type="primary"
            onClick={connect}
          >
            连接
          </Button>
          <Button icon={<DeleteOutlined />} size="small" onClick={disposeTerminal}>
            断开
          </Button>
        </Space>
      }
    >
      <Space className="soha-terminal-toolbar" size={8}>
        <Tag color={statusColor}>{connectionState}</Tag>
        <Text type="secondary">{serviceName || '未选择服务'}</Text>
      </Space>
      <div className="soha-terminal-shell">
        <div ref={containerRef} className="soha-terminal-shell-inner" />
      </div>
    </Card>
  )
}
