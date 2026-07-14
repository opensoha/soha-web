import { useMemo, useState } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Space, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { ManagementDataPage } from '@/components/management-data-page'
import { ManagementState, ManagementTableToolbar } from '@/components/management-list'
import { StatusTag } from '@/components/status-tag'
import { workbenchQueries } from '../workbench/queries'
import type { WorkbenchAgentRun } from '../workbench/types'

export function AgentRunsPage() {
  const [keyword, setKeyword] = useState('')
  const runsQuery = useQuery(workbenchQueries.agentRuns.all())
  const runs = runsQuery.data?.data ?? []
  const filteredRuns = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return runs
    return runs.filter((run) =>
      [run.id, run.providerId, run.providerKind, run.capabilityId, run.status].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(normalized),
      ),
    )
  }, [keyword, runs])

  const columns: TableColumnsType<WorkbenchAgentRun> = [
    { title: 'Run ID', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: 'Provider', dataIndex: 'providerId', key: 'providerId', width: 170 },
    { title: '能力', dataIndex: 'capabilityId', key: 'capabilityId', width: 180 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value) => <StatusTag value={String(value)} />,
    },
    {
      title: 'Skills',
      dataIndex: 'skillIds',
      key: 'skillIds',
      width: 220,
      render: (values: string[] | undefined) =>
        values?.length ? (
          <Space size={4} wrap>
            {values.map((value) => (
              <Tag key={value}>{value}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 190,
      render: (value) => value || '-',
    },
  ]

  return (
    <ManagementDataPage
      header={{
        title: 'Agent Runs',
        description:
          '查看通过统一 Agent 运行合同执行的任务。Provider、能力和版本信息来自运行记录。',
        actions: (
          <ManagementTableToolbar>
            <Input.Search
              value={keyword}
              allowClear
              placeholder="搜索 Run、Provider 或能力"
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Button
              icon={<ReloadOutlined />}
              loading={runsQuery.isFetching}
              onClick={() => void runsQuery.refetch()}
            >
              刷新
            </Button>
          </ManagementTableToolbar>
        ),
      }}
      table={{
        columns,
        dataSource: filteredRuns,
        loading: runsQuery.isLoading,
        rowKey: 'id',
        empty: runsQuery.isError ? (
          <ManagementState kind="error" title="Agent Runs 加载失败" />
        ) : (
          <ManagementState
            title="暂无 Agent Run"
            description="Agent 任务开始执行后会在这里出现。"
          />
        ),
      }}
    />
  )
}
