import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Card, Select, Space, Switch, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import '@/components/resource-operation-panels.css'
import { withStreamTicket } from '@/features/auth'
import { downloadText } from '@/utils/download'
import { dockerQueries } from '../queries'
import {
  appendLogLine,
  dockerRuntimeWebSocketURL,
  runtimeServiceSelector,
  splitLogContent,
  type DockerRuntimePanelProps,
  type TerminalMessage,
} from './shared'
import './styles.css'

const { Text } = Typography

export function DockerProjectLogsPanel({
  enabled,
  projectId,
  projectName,
  serviceName,
  serviceOptions,
  servicesLoading,
  onServiceChange,
}: DockerRuntimePanelProps) {
  const socketRef = useRef<WebSocket | null>(null)
  const streamRunRef = useRef(0)
  const [tailLines, setTailLines] = useState(200)
  const [streaming, setStreaming] = useState(true)
  const [connectionState, setConnectionState] = useState<
    'idle' | 'connecting' | 'connected' | 'closed' | 'error'
  >('idle')
  const [lines, setLines] = useState<string[]>([])
  const canReadRuntime = enabled && Boolean(projectId && serviceName)

  const logsQuery = useQuery(
    dockerQueries.projectLogs(projectId, { serviceName, tailLines }, canReadRuntime && !streaming),
  )

  useEffect(() => {
    if (logsQuery.data) {
      setLines(splitLogContent(logsQuery.data.content))
    }
  }, [logsQuery.data])

  const streamURL = useMemo(() => {
    if (!canReadRuntime) return ''
    return dockerRuntimeWebSocketURL(projectId, 'logs/stream', { serviceName, tailLines })
  }, [canReadRuntime, projectId, serviceName, tailLines])

  const closeStream = useCallback(() => {
    streamRunRef.current += 1
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'close' }))
    }
    socket?.close()
    socketRef.current = null
  }, [])

  useEffect(() => {
    closeStream()
    if (!streaming || !streamURL) {
      setConnectionState('idle')
      return undefined
    }
    const runId = streamRunRef.current + 1
    streamRunRef.current = runId
    setConnectionState('connecting')
    setLines([])
    void (async () => {
      let ticketedURL: string
      try {
        ticketedURL = await withStreamTicket(streamURL)
      } catch {
        if (streamRunRef.current !== runId) return
        setConnectionState('error')
        return
      }
      if (streamRunRef.current !== runId) return
      const socket = new WebSocket(ticketedURL)
      socketRef.current = socket
      socket.onopen = () => {
        if (socketRef.current !== socket) return
        setConnectionState('connected')
      }
      socket.onmessage = (event) => {
        if (socketRef.current !== socket) return
        const message = JSON.parse(event.data) as TerminalMessage
        if (message.type === 'log' && message.data !== undefined) {
          setLines((current) => appendLogLine(current, message.data || ''))
        }
        if (message.type === 'exit') {
          setConnectionState('closed')
        }
        if (message.type === 'error') {
          setConnectionState('error')
          if (message.message) {
            setLines((current) => appendLogLine(current, `[error] ${message.message}`))
          }
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
    })()
    return () => {
      closeStream()
    }
  }, [closeStream, streamURL, streaming])

  const statusColor =
    connectionState === 'connected' ? 'green' : connectionState === 'error' ? 'red' : 'default'

  if (!enabled) {
    return (
      <Card className="soha-docker-runtime-card" size="small">
        <ManagementState
          compact
          kind="no-permission"
          title="运行时日志不可用"
          description="Docker 模块或当前权限不允许读取运行时日志。"
        />
      </Card>
    )
  }

  if (serviceOptions.length === 0 && !servicesLoading) {
    return (
      <Card className="soha-docker-runtime-card" size="small">
        <ManagementState
          compact
          kind="empty"
          title="没有可用服务"
          description="该项目还没有同步到可用于运行时访问的服务记录。"
        />
      </Card>
    )
  }

  return (
    <Card
      className="soha-docker-runtime-card soha-log-card"
      size="small"
      title="日志"
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
            options={[100, 200, 500, 1000, 2000].map((value) => ({ label: `${value} 行`, value }))}
            popupMatchSelectWidth={false}
            size="small"
            value={tailLines}
            onChange={setTailLines}
          />
          <Switch
            disabled={!enabled}
            checked={streaming}
            checkedChildren="实时"
            size="small"
            unCheckedChildren="快照"
            onChange={setStreaming}
          />
          <Button
            disabled={!enabled}
            icon={<ReloadOutlined />}
            loading={logsQuery.isFetching}
            size="small"
            onClick={() => (streaming ? setLines([]) : logsQuery.refetch())}
          >
            刷新
          </Button>
          <Button
            icon={<DownloadOutlined />}
            size="small"
            onClick={() =>
              downloadText(
                `${projectName || projectId}-${serviceName || 'service'}.log`,
                lines.join('\n'),
              )
            }
          >
            下载
          </Button>
        </Space>
      }
    >
      <Space className="soha-terminal-toolbar" size={8}>
        <Tag color={statusColor}>{streaming ? connectionState : 'snapshot'}</Tag>
        <Text type="secondary">{serviceName || '未选择服务'}</Text>
      </Space>
      <div className="soha-log-shell">
        {lines.length === 0 ? (
          <div className="soha-log-loading">
            {logsQuery.isFetching || connectionState === 'connecting'
              ? '正在读取日志...'
              : '暂无日志'}
          </div>
        ) : (
          lines.map((line, index) => (
            <div className="soha-log-row soha-log-row-plain" key={`${index}-${line.slice(0, 32)}`}>
              <span className="soha-log-row-text">{line}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
