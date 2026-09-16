import { useState } from 'react'
import { App, Button, Checkbox, Input, Modal, Popconfirm, Select, Space, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { memoryApi } from '../../memory/api'
import { memoryQueries } from '../../memory/queries'
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
  const { message } = App.useApp()
  const client = useQueryClient()
  const ownerId = useAuthStore((state) => state.user?.userId)
  const permissions = usePermissionSnapshot().data?.data
  const canWrite = hasPermission(permissions, 'ai.memory.update')
  const records = useQuery(memoryQueries.records())
  const policies = useQuery(memoryQueries.policies())
  const [fact, setFact] = useState(initialFact.slice(0, 2000))
  const [editing, setEditing] = useState<MemoryRecord>()
  const [policyKey, setPolicyKey] = useState<string>()
  const enabledPolicies = (policies.data?.data ?? []).filter(
    (item) => item.enabled && item.explicitWriteOnly && item.ownerTypes.includes('user'),
  )
  const policy =
    enabledPolicies.find((item) => item.id + ':' + item.version === policyKey) ?? enabledPolicies[0]
  const save = useMutation({
    mutationFn: async () => {
      if (!ownerId || !policy || !fact.trim()) throw new Error('请选择有效策略并填写记忆内容。')
      const now = new Date()
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode('user:' + ownerId),
      )
      const scopeHash =
        'sha256:' +
        Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
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
      void message.success('个人记忆已保存；仅勾选的条目用于背景。')
    },
    onError: (error: Error) => void message.error(error.message),
  })
  const remove = useMutation({
    mutationFn: memoryApi.records.delete,
    onSuccess: async (_, id) => {
      onSelect(selected.filter((item) => item !== id))
      await client.invalidateQueries({ queryKey: memoryKeys.records() })
    },
    onError: (error: Error) => void message.error(error.message),
  })
  return (
    <Modal
      title="个人记忆"
      open
      onCancel={onClose}
      footer={<Button onClick={onClose}>完成</Button>}
    >
      <Typography.Paragraph type="secondary">
        仅显式保存。勾选的记忆用于下次发送；删除后不再作为背景使用，历史对话保留。
      </Typography.Paragraph>
      {selected.length > 0 ? (
        <Button size="small" type="text" onClick={() => onSelect([])}>
          清除本次记忆引用
        </Button>
      ) : null}
      {records.isError ? (
        <Typography.Paragraph type="danger">记忆功能未启用或当前无权读取。</Typography.Paragraph>
      ) : null}
      {(records.data?.data ?? []).map((record) => (
        <div key={record.id} style={{ marginBottom: 16 }}>
          <Checkbox
            disabled={
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
          {canWrite ? (
            <Space>
              <Button
                size="small"
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
                onConfirm={() => remove.mutateAsync(record.id)}
              >
                <Button size="small" danger>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          ) : null}
        </div>
      ))}
      {canWrite ? (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Typography.Text strong>{editing ? '改正记忆' : '显式保存新记忆'}</Typography.Text>
          <Input.TextArea
            aria-label="记忆内容"
            value={fact}
            onChange={(event) => setFact(event.target.value)}
            maxLength={2000}
            rows={4}
          />
          <Select
            aria-label="记忆保留策略"
            style={{ width: '100%' }}
            value={policy ? policy.id + ':' + policy.version : undefined}
            onChange={setPolicyKey}
            placeholder="需要启用显式记忆策略"
            options={enabledPolicies.map((item) => ({
              value: item.id + ':' + item.version,
              label: item.id + ' · 保留 ' + Math.round(item.defaultTtl / 864e11) + ' 天',
            }))}
          />
          <Button
            type="primary"
            disabled={!policy || !fact.trim()}
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
