import { useMemo, useState } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementState,
  ManagementTableToolbar,
  ManagementToolbarSearch,
} from '@/components/management-list'
import { MetadataTag, StatusTag } from '@/components/status-tag'
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
              <MetadataTag key={value} label={value} />
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
      table={{
        title: 'Agent Runs',
        columnSettingIconOnly: true,
        columnSettingPlacement: 'header',
        headerExtra: (
          <ManagementTableToolbar>
            <ManagementToolbarSearch
              value={keyword}
              placeholder="搜索 Run、Provider 或能力"
              onChange={setKeyword}
            />
            <ManagementIconButton
              aria-label="刷新 Agent Runs"
              tooltip="刷新"
              icon={<ReloadOutlined />}
              loading={runsQuery.isFetching}
              onClick={() => void runsQuery.refetch()}
            />
          </ManagementTableToolbar>
        ),
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
