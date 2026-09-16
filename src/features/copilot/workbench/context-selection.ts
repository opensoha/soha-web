import type { WorkbenchTextAttachment } from '@opensoha/contracts/gen/ts/sohaapi'

export const textAttachmentAccept = '.txt,.log,.md,.json,.yaml,.yml,.toml,.ini,.conf,.cfg,.csv,.xml'

export async function readTextAttachment(file: File): Promise<WorkbenchTextAttachment> {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!textAttachmentAccept.split(',').includes(extension) || file.size > 65_536) {
    throw new Error('请选择不超过 64 KiB 的文本、日志或配置文件。')
  }
  const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  if (content.includes('\0')) throw new Error('不支持二进制文件。')
  return { id: crypto.randomUUID(), name: file.name, content }
}

export function contextSnapshotSummary(
  value: unknown,
  providerUsage?: unknown,
): { label: string; value: string }[] {
  if (!value || typeof value !== 'object') return []
  const snapshot = value as Record<string, unknown>
  const budget = snapshot.budgetUsage as
    | { evidenceTokens?: number; evidenceItems?: number }
    | undefined
  const citations = Array.isArray(snapshot.citations) ? snapshot.citations : []
  const toolSources = Array.isArray(snapshot.toolSources) ? snapshot.toolSources : []
  const usage =
    providerUsage && typeof providerUsage === 'object'
      ? (providerUsage as Record<string, unknown>)
      : undefined
  return [
    { label: '快照', value: typeof snapshot.id === 'string' ? snapshot.id : '未知' },
    {
      label: '证据',
      value: `${budget?.evidenceItems ?? 0} 条 · 估算 ${budget?.evidenceTokens ?? 0} tokens`,
    },
    {
      label: '来源',
      value:
        [...citations, ...toolSources]
          .map((item) =>
            typeof item?.documentTitle === 'string'
              ? item.documentTitle
              : typeof item?.title === 'string'
                ? item.title
                : item?.id,
          )
          .filter(Boolean)
          .join('、') || '无',
    },
    {
      label: '裁剪',
      value:
        Array.isArray(snapshot.truncations) && snapshot.truncations.length
          ? snapshot.truncations.join('；')
          : '无证据裁剪',
    },
    {
      label: '计量来源',
      value:
        snapshot.usageProvenance === 'estimated_characters'
          ? '按字符估算，仅含证据；模型完整输入用量未知'
          : '未知',
    },
    {
      label: '历史裁剪',
      value: snapshot.historyTruncated ? '历史已按消息数或字符预算裁剪' : '无历史裁剪记录',
    },
    ...(typeof usage?.inputTokens === 'number' &&
    Number.isFinite(usage.inputTokens) &&
    usage.inputTokens > 0
      ? [
          {
            label: '助手回报用量',
            value: `累计输入 ${usage.inputTokens} tokens；模型窗口未知，不换算占用百分比`,
          },
        ]
      : []),
  ]
}
