import { ReadFeedback } from '@/components/request-feedback'
import { useOperationMutation } from '@/components/use-operation-mutation'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useAuthStore } from '@/stores/auth-store'
import { queryAccessDenied, readableQueryData } from '@/utils/query-feedback'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, Input, Modal, Popconfirm, Select, Space, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { memoryApi } from '../../memory/api'
import { memoryKeys } from '../../memory/keys'
import type { MemoryRecord } from '../../memory/types'

export function ChatMemory({
  initialFact = '',
  sourceRefs = [],
  selected,
  onSelect,
  onClose,
}: {
  initialFact?: string
  sourceRefs?: string[]
  selected: string[]
  onSelect: (ids: string[]) => void
  onClose: () => void
}) {
  const client = useQueryClient()
  const ownerId = useAuthStore((state) => state.user?.userId)
  const permissions = usePermissionSnapshot().data?.data
  const canRead = hasPermission(permissions, 'ai.memory.view')
  const canWrite = canRead && hasPermission(permissions, 'ai.memory.update')
  const records = useQuery({
    queryFn: () => memoryApi.records.list(),
    queryKey: memoryKeys.chatRecords(ownerId),
    enabled: canRead,
  })
  const policies = useQuery({
    queryFn: () => memoryApi.policies.list(),
    queryKey: memoryKeys.chatPolicies(ownerId),
    enabled: canRead,
  })
  const [fact, setFact] = useState(initialFact.slice(0, 2000))
  const [editing, setEditing] = useState<MemoryRecord>()
  const [policyKey, setPolicyKey] = useState<string>()
  const denied = !canRead || queryAccessDenied(records) || queryAccessDenied(policies)
  const enabledPolicies = (denied ? [] : (readableQueryData(policies)?.data ?? [])).filter(
    (item) => item.enabled && item.explicitWriteOnly && item.ownerTypes.includes('user'),
  )
  const policy = policyKey
    ? enabledPolicies.find((item) => item.id + ':' + item.version === policyKey)
    : enabledPolicies[0]
  useEffect(() => {
    if (!denied && !policyKey && enabledPolicies[0])
      setPolicyKey(enabledPolicies[0].id + ':' + enabledPolicies[0].version)
  }, [denied, policyKey, enabledPolicies[0]?.id, enabledPolicies[0]?.version])
  const save = useOperationMutation(
    {
      mutationFn: async () => {
        if (!canWrite || denied || !ownerId || !policy || !fact.trim())
          throw new Error('请选择有效策略并填写记忆内容。')
        const now = new Date()
        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode('user:' + ownerId),
        )
        const scopeHash =
          'sha256:' +
          Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
            '',
          )
        return memoryApi.records.put({
          policyId: policy.id,
          policyVersion: policy.version,
          record: {
            id: editing?.id ?? crypto.randomUUID(),
            ownerType: 'user',
            ownerId,
            scopeHash,
            fact: fact.trim(),
            sourceType: 'explicit_user',
            sourceRefs: editing?.sourceRefs ?? sourceRefs,
            confidence: 1,
            validFrom: now.toISOString(),
            expiresAt: new Date(now.getTime() + policy.defaultTtl / 1e6).toISOString(),
            policyVersion: policy.version,
            status: 'active',
            createdAt: now.toISOString(),
          },
        })
      },
      onSuccess: async () => {
        await client.invalidateQueries({ queryKey: memoryKeys.records() })
        setFact('')
        setEditing(undefined)
      },
    },
    {
      label: ['保存个人记忆', 'Save personal memory'],
      target: () => `${editing?.id ?? '个人记忆'} · ${policy?.id}:${policy?.version}`,
      receipt: () => ({ message: '个人记忆已保存；仅勾选的条目用于背景。' }),
    },
  )
  const remove = useOperationMutation(
    {
      mutationFn: memoryApi.records.delete,
      onSuccess: async (_, id) => {
        onSelect(selected.filter((item) => item !== id))
        await client.invalidateQueries({ queryKey: memoryKeys.records() })
      },
    },
    { label: ['删除个人记忆', 'Delete personal memory'], target: (id) => id },
  )
  const blocked = save.blocked || remove.blocked
  const accessDenied = denied || queryAccessDenied(save) || queryAccessDenied(remove)
  useEffect(() => {
    if (!accessDenied) return
    setFact('')
    setEditing(undefined)
    setPolicyKey(undefined)
    if (selected.length) onSelect([])
  }, [accessDenied, selected.length, onSelect])
  return (
    <Modal
      title="个人记忆"
      open
      onCancel={() => {
        if (!blocked) onClose()
      }}
      closable={!blocked}
      keyboard={!blocked}
      mask={{ closable: !blocked }}
      footer={
        <Button disabled={blocked} onClick={onClose}>
          完成
        </Button>
      }
    >
      <Typography.Paragraph type="secondary">
        仅显式保存。勾选的记忆用于下次发送；删除后不再作为背景使用，历史对话保留。
      </Typography.Paragraph>
      {selected.length > 0 ? (
        <Button size="small" type="text" disabled={blocked} onClick={() => onSelect([])}>
          清除本次记忆引用
        </Button>
      ) : null}
      {!canRead ? (
        <Typography.Paragraph type="secondary">当前无权读取个人记忆。</Typography.Paragraph>
      ) : null}
      <ReadFeedback query={records} label="个人记忆" canRead={canRead} />
      <ReadFeedback query={policies} label="记忆策略" canRead={canRead} />
      {save.feedback}
      {remove.feedback}
      {(accessDenied ? [] : (readableQueryData(records)?.data ?? [])).map((record) => (
        <div key={record.id} style={{ marginBottom: 16 }}>
          <Checkbox
            disabled={
              blocked ||
              !enabledPolicies.some(
                (policy) =>
                  policy.id === record.policyId && policy.version === record.policyVersion,
              )
            }
            checked={selected.includes(record.id)}
            onChange={(event) =>
              onSelect(
                event.target.checked
                  ? [...selected, record.id].slice(0, 20)
                  : selected.filter((id) => id !== record.id),
              )
            }
          >
            {record.fact}
          </Checkbox>
          <Typography.Paragraph type="secondary">
            有效期至 {record.expiresAt ? new Date(record.expiresAt).toLocaleString() : '未知'} ·
            来源 {record.sourceRefs?.join('、') || '显式输入'}
          </Typography.Paragraph>
          {canWrite && !accessDenied ? (
            <Space>
              <Button
                size="small"
                disabled={blocked}
                onClick={() => {
                  setEditing(record)
                  setFact(record.fact)
                  setPolicyKey(record.policyId + ':' + record.policyVersion)
                }}
              >
                改正
              </Button>
              <Popconfirm
                title="删除这条个人记忆？"
                disabled={blocked}
                onConfirm={() => remove.mutateAsync(record.id)}
              >
                <Button size="small" danger disabled={blocked}>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          ) : null}
        </div>
      ))}
      {canWrite && !accessDenied ? (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Typography.Text strong>{editing ? '改正记忆' : '显式保存新记忆'}</Typography.Text>
          <Input.TextArea
            aria-label="记忆内容"
            value={accessDenied ? '' : fact}
            disabled={blocked}
            onChange={(event) => setFact(event.target.value)}
            maxLength={2000}
            rows={4}
          />
          <Select
            aria-label="记忆保留策略"
            disabled={blocked}
            style={{ width: '100%' }}
            value={policyKey}
            onChange={setPolicyKey}
            placeholder="需要启用显式记忆策略"
            options={enabledPolicies.map((item) => ({
              value: item.id + ':' + item.version,
              label: item.id + ' · 保留 ' + Math.round(item.defaultTtl / 864e11) + ' 天',
            }))}
          />
          {policyKey && !policy ? (
            <Typography.Text type="warning">原记忆策略已变化或不可用，请重新选择。</Typography.Text>
          ) : null}
          <Button
            type="primary"
            disabled={blocked || !policy || !fact.trim()}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            确认保存个人记忆
          </Button>
        </Space>
      ) : null}
    </Modal>
  )
}
