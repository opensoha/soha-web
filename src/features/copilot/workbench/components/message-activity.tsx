import { useState } from 'react'
import { App, Button, Space, Tag, Typography } from 'antd'
import type { WorkbenchSource } from '@opensoha/contracts/gen/ts/sohaapi'
import {
  CopyOutlined,
  LikeOutlined,
  DislikeOutlined,
  BookOutlined,
  BranchesOutlined,
} from '@ant-design/icons'
import type { ConversationMessage } from '../conversation'
import {
  metadataAgentStatus,
  metadataSources,
  metadataToolExecutions,
} from '../stream-presentation'
import { MessageApproval } from './message-approval'
import { MessageSpecialist } from './message-specialist'

export function MessageActivity({
  message: item,
  hasArtifact,
  onSource,
  onBranch,
  onSaveMemory,
  onFeedback,
}: {
  message: ConversationMessage
  hasArtifact: boolean
  onSource?: (source: WorkbenchSource) => void
  onBranch?: () => void
  onSaveMemory?: () => void
  onFeedback?: (disposition: 'accepted' | 'rejected') => void
}) {
  const { message } = App.useApp()
  const [view, setView] = useState<'sources' | null>(null)
  const sources = metadataSources(item.metadata)
  const tools = metadataToolExecutions(item.metadata)
  const terminal = ['succeeded', 'failed', 'cancelled'].includes(
    metadataAgentStatus(item.metadata)?.status ?? '',
  )
  if (item.role !== 'assistant' || item.metadata?.source === 'agent-runtime-queued') return null
  return (
    <div className="soha-ai-workbench__message-activity">
      <Space size={4} wrap>
        <Button
          size="small"
          type="text"
          icon={<CopyOutlined />}
          aria-label="复制回复"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(item.content)
              void message.success('已复制回复')
            } catch {
              void message.error('复制失败，请手动选择正文。')
            }
          }}
        />
        {onFeedback ? (
          <>
            <Button
              size="small"
              type="text"
              aria-label="有帮助"
              title="有帮助"
              icon={<LikeOutlined />}
              onClick={() => onFeedback('accepted')}
            />
            <Button
              size="small"
              type="text"
              aria-label="有问题"
              title="有问题"
              icon={<DislikeOutlined />}
              onClick={() => onFeedback('rejected')}
            />
          </>
        ) : null}
        {onSaveMemory ? (
          <Button
            size="small"
            type="text"
            aria-label="保存为个人记忆"
            title="保存为个人记忆"
            icon={<BookOutlined />}
            onClick={onSaveMemory}
          />
        ) : null}
        {onBranch ? (
          <Button
            size="small"
            type="text"
            aria-label="从此处分支"
            title="从此处分支"
            icon={<BranchesOutlined />}
            onClick={onBranch}
          />
        ) : null}
        {sources.length > 0 ? (
          <Button
            size="small"
            type="text"
            onClick={() => setView(view === 'sources' ? null : 'sources')}
          >
            来源
          </Button>
        ) : null}
      </Space>
      {view === 'sources' ? (
        <div>
          {sources.map((source) => (
            <div key={source.id}>
              <Button type="link" size="small" onClick={() => onSource?.(source)}>
                {source.title}
              </Button>
              <Typography.Paragraph type="secondary">
                {source.summary || source.kind}
              </Typography.Paragraph>
            </div>
          ))}
        </div>
      ) : null}
      {tools.length > 0 ? (
        <details
          className="soha-ai-tool-activity"
          open={tools.some(
            (tool) =>
              tool.toolName === 'change.request' ||
              ['running', 'failed', 'error'].includes(tool.status),
          )}
        >
          <summary>
            执行记录 {tools.length}
            {hasArtifact ? ' · 含生成成果' : ''}
          </summary>
          {tools.map((tool) => {
            const related = tool.output?.relatedIds as Record<string, unknown> | undefined
            const requestId = related?.approvalRequestId ?? related?.confirmationRequestId
            const approvalId =
              tool.toolName === 'change.request' && typeof requestId === 'string'
                ? requestId
                : undefined
            const interrupted = terminal && tool.status === 'running'
            const failed = interrupted || ['failed', 'error'].includes(tool.status)
            const running = !terminal && tool.status === 'running'
            const duration =
              tool.startedAt && tool.completedAt
                ? Math.max(
                    0,
                    new Date(tool.completedAt).getTime() - new Date(tool.startedAt).getTime(),
                  )
                : undefined
            const input =
              tool.input?.input && typeof tool.input.input === 'object'
                ? (tool.input.input as Record<string, unknown>)
                : tool.input
            const target = [
              input?.clusterId,
              input?.namespace,
              input?.nodeName,
              input?.serviceName,
              input?.query,
              input?.title,
            ]
              .filter((value): value is string => typeof value === 'string' && !!value)
              .join(' / ')
            const label =
              (
                {
                  'knowledge.search': '检索知识库',
                  'k8s.workloads.overview': '读取工作负载概览',
                  'k8s.nodes.detail': '读取节点详情',
                  'k8s.services.backends': '检查服务后端',
                  'artifact.preview': '生成静态草稿',
                  'change.request': '提交变更申请',
                  'agent.delegate': '专业只读核验',
                } as Record<string, string>
              )[tool.toolName] || tool.toolName
            return (
              <details key={tool.id} open={running || failed || !!approvalId}>
                <summary>
                  <Space size={8} wrap>
                    <span>{label}</span>
                    <Tag color={failed ? 'error' : running ? 'processing' : 'success'}>
                      {failed
                        ? '失败'
                        : running
                          ? '进行中'
                          : approvalId
                            ? '已提交'
                            : tool.toolName === 'agent.delegate'
                              ? '已委派'
                              : '已完成'}
                    </Tag>
                    {duration !== undefined && Number.isFinite(duration) ? (
                      <Typography.Text type="secondary">
                        {(duration / 1000).toFixed(1)} 秒
                      </Typography.Text>
                    ) : null}
                  </Space>
                </summary>
                {target ? (
                  <Typography.Paragraph type="secondary">{target}</Typography.Paragraph>
                ) : null}
                {!approvalId ? (
                  <Typography.Paragraph type={failed ? 'danger' : 'secondary'}>
                    {interrupted ? '任务已结束，未收到该步骤的结果。' : tool.summary}
                  </Typography.Paragraph>
                ) : null}
                {approvalId ? <MessageApproval id={approvalId} /> : null}
                {tool.toolName === 'agent.delegate' &&
                typeof related?.childRunId === 'string' &&
                typeof related?.sessionId === 'string' ? (
                  <MessageSpecialist id={related.childRunId} sessionId={related.sessionId} />
                ) : null}
              </details>
            )
          })}
        </details>
      ) : null}
    </div>
  )
}
